import * as Residence from './model/residence'
import * as ResidenceUpdate from './model/residenceupdate'
import * as Owner from './model/owner'
import * as Billboard from './model/billboard'
import * as SocialCard from './model/socialcard'
import * as Nft from './model/nft'

import type { Handler } from 'worktop'

import { cloudflareFromId } from './cloudflarefromid'
import { idFromMintAddr, mintAddrFromId } from './mintaddrfromid'
import { nonoWords } from './nonowords'
import {
  fetchRPC,
  ownedTokenMintAddrs,
  ownedTwitterHandle,
  getNFTMetadataByMintAddress,
} from './helpers/solana'
import { sign } from 'tweetnacl'

import { checkSignerAddr } from './helpers/eth-lite';

declare const IMAGE_API_KEY: string;
declare const RUST_WORKER_SEC_KEY: string;

//eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import * as bs58 from 'base58-universal';

const FromBase64 = function (str: any) {
  return atob(str)
    .split('')
    .map(function (c) {
      return c.charCodeAt(0)
    })
}

const MINUTE = 1000 * 60
const inSpan = (date: number, span: number) =>
  Date.now() + span > date && date > Date.now() - span

export const save: Handler = async function (req, res) {
  const { story: storyParam, room: roomParam } = req.params
  const id = (parseInt(storyParam) - 1) * 20 + (parseInt(roomParam) - 1)
  const mintAddr = (await mintAddrFromId())[id]

  const { encodedMessage, signature, publicKey } = await req.body() as any

  const ownerAddr = bs58.encode(new Uint8Array(FromBase64(publicKey)));

  const isVerified = sign.detached.verify(
    new Uint8Array(FromBase64(encodedMessage)),
    new Uint8Array(FromBase64(signature)),
    new Uint8Array(FromBase64(publicKey)),
  )
  if (!isVerified) return res.send(422, { signature: 'invalid' })

  const rawMessage = new TextDecoder('utf8').decode(
    new Uint8Array(FromBase64(encodedMessage)),
  )

  try {
    JSON.parse(rawMessage) //Parsing raw message should throw an error
    throw new Error('Raw message should not be json serializable')
  } catch (e) {
    if ((e as Error)?.message === 'Raw message should not be json serializable')
      throw e
  }

  const [
    story,
    room,
    name,
    color,
    updated_at,
    nftlist_type,
    nftlist,
    nftsortedlist,
    billboardupload,
    bio,
    web3media,
  ] = (() => {
    const RPRTS = {
      NL: '(\\n|\\r|\\n)',
      CLR: '(#([0-9a-fA-F]{3}){1,2})',
      DIS: (...args: any[]) =>
        args[1] ? `(\\d{${args[0]},${args[1]}})` : `(\\d{${args[0]}})`,
      EXP: '(.*?)',
    }
    const regexpCore = `Update Residence ${RPRTS.DIS(1, 3)}-${RPRTS.DIS(1, 2)}${RPRTS.NL}${RPRTS.NL}Name: ${RPRTS.EXP}${RPRTS.NL}Color: ${RPRTS.CLR}${RPRTS.NL}Updated: ${RPRTS.DIS(13)}`

    try {
      const regexpExten = `${regexpCore}${RPRTS.NL}${RPRTS.NL}NFT List Type: (white|black)${RPRTS.NL}NFT List: \\[${RPRTS.EXP}\\]${RPRTS.NL}NFT Sorted: \\[${RPRTS.EXP}\\]`

      try {
        const regexpExten2 = `${regexpExten}${RPRTS.NL}${RPRTS.NL}Billboard Upload: (true|false)${RPRTS.NL}Bio: \\[${RPRTS.EXP}\\]`

        try {
          const regexpExten3 = `${regexpExten2}${RPRTS.NL}${RPRTS.NL}Web3 Media: \\[${RPRTS.EXP}\\]`

          return JSON.parse(
            rawMessage.replace(
              new RegExp(`^${regexpExten3}$`, 'gm'),
              `[$1, $2, "$5", "$7", $10, "$13", [$15], [$17], $20, $22, [$25]]`,
            ),
          )
        } catch (e) {
          console.error((e as any).stack.toString())

          return JSON.parse(
            rawMessage.replace(
              new RegExp(`^${regexpExten2}$`, 'gm'),
              `[$1, $2, "$5", "$7", $10, "$13", [$15], [$17], $20, $22]`,
            ),
          )
        }
      } catch (e) {
        console.error((e as any).stack.toString())

        return JSON.parse(
          rawMessage.replace(
            new RegExp(`^${regexpExten}$`, 'gm'),
            `[$1, $2, "$5", "$7", $10, "$13", [$15], [$17]]`,
          ),
        )
      }
    } catch (e) {
      console.error((e as any).stack.toString())

      return JSON.parse(
        rawMessage.replace(
          new RegExp(`^${regexpCore}$`, 'gm'),
          `[$1, $2, "$5", "$7", $10]`,
        ),
      )
    }
  })()

  if (story != storyParam) return res.send(422, { story: 'invalid' })
  if (room != roomParam) return res.send(422, { room: 'invalid' })

  if (nonoWords.some((w) => new RegExp(w).test(name.toLowerCase())))
    return res.send(422, { name: 'hasnonowords' })
  if (name.length > 50) return res.send(422, { name: 'toolong' })

  if (nonoWords.some((w) => new RegExp(w).test(bio.toLowerCase())))
    return res.send(422, { bio: 'hasnonowords' })
  if (bio && bio.length > 140) return res.send(422, { bio: 'toolong' })

  //Temporary tests for just audius support safely
  if ((web3media.length > 1) || (web3media.length == 1 && (web3media[0].type != "audius-playlist" || !web3media[0].id.match(/^[A-Za-z0-9]+$/g)))) return res.send(422, { web3media: 'invalid' })

  if (!inSpan(updated_at, MINUTE))
    return res.send(422, { updated_at: 'invalid' })

  const ownersNFTMintAddrs = await ownedTokenMintAddrs(ownerAddr);
  if (!ownersNFTMintAddrs.includes(mintAddr)) return res.send(422, { publicKey: 'invalid' })

  let billboarduploadURL;

  if (billboardupload) {
    const { result: { uploadURL }, success } = await fetch("https://api.cloudflare.com/client/v4/accounts/fd2cba8877a5be60badd9a7261b01cc6/images/v1/direct_upload", {
      headers: {
        "Authorization": `Bearer ${IMAGE_API_KEY}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    }).then(res => res.json() as any);

    if (success != true) return res.send(422, { billboardupload: 'invalid' })

    billboarduploadURL = uploadURL;
  }

  const result = await Residence.save(ownerAddr, {
    mintAddr,
    name,
    bio,
    color,
    updated_at,
    nftlist_type,
    nftlist,
    nftsortedlist,
    web3media,
  })

  try {
    const { result: { uploadURL } } = await fetch("https://api.cloudflare.com/client/v4/accounts/fd2cba8877a5be60badd9a7261b01cc6/images/v1/direct_upload", {
      headers: {
        "Authorization": `Bearer ${IMAGE_API_KEY}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    }).then(res => res.json() as any);

    const socialMediaImage = new Uint8Array(await fetch("https://tower-worker-rust.deno.dev", {
      body: JSON.stringify({
        "security_key": RUST_WORKER_SEC_KEY,
        "residence_name": name,
        "residence_story": story,
        "residence_room": room,
        "residence_nfts": nftsortedlist.slice(0, 10),
        "residence_color": color
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    }).then(res => res.arrayBuffer()) as ArrayBuffer);

    const body = new FormData();
    body.append('file', new Blob([socialMediaImage], { type: "image/png" }));

    const {
      result: { id: socialMediaImageId },
      success: uploadSuccess,
    } = await fetch(uploadURL, {
      method: "POST",
      body,
    }).then((res) => res.json() as any);

    if (uploadSuccess) {
      const prevItem = await SocialCard.find(mintAddr);

      if (prevItem?.imageId) await fetch(`https://api.cloudflare.com/client/v4/accounts/fd2cba8877a5be60badd9a7261b01cc6/images/v1/${prevItem?.imageId}`, {
        headers: {
          "Authorization": `Bearer ${IMAGE_API_KEY}`,
        },
        method: "DELETE"
      });

      await SocialCard.save({
        residenceMintAddr: mintAddr,
        imageId: socialMediaImageId,
      })
    } else {
      throw new Error("Upload failed!")
    }
  } catch (err) {
    console.error((err as any).stack.toString());
  }

  if (result) res.send(201, { result, billboarduploadURL })
  else res.send(500, 'Error creating item')
}

export const updateOwner: Handler = async function (req, res) {
  const { owner: ownerParam } = req.params

  const { encodedMessage, signature, publicKey, ethereum } = await req.body() as any;

  const isVerified = sign.detached.verify(
    new Uint8Array(FromBase64(encodedMessage)),
    new Uint8Array(FromBase64(signature)),
    new Uint8Array(FromBase64(publicKey)),
  )
  if (!isVerified) return res.send(422, { signature: 'invalid' })

  const rawMessage = new TextDecoder('utf8').decode(
    new Uint8Array(FromBase64(encodedMessage)),
  )

  try {
    JSON.parse(rawMessage) //Parsing raw message should throw an error
    throw new Error('Raw message should not be json serializable')
  } catch (e) {
    if ((e as Error)?.message === 'Raw message should not be json serializable')
      throw e
  }

  const [ethereumAddr, updated_at] = JSON.parse(
    rawMessage.replace(
      new RegExp(
        `^I verify my:\n\nEthereum Address: (.*?)\n\nUpdated: (.*?)$`,
        'gm',
      ),
      `["$1", $2]`,
    ),
  )

  const ethSignerAddr = checkSignerAddr(ethereum.message, ethereum.signedMessage);

  if (ethSignerAddr !== ethereumAddr) return res.send(422, { ethsignature: 'invalid' });

  if (!inSpan(updated_at, MINUTE))
    return res.send(422, { updated_at: 'invalid' })

  if (ownerParam != bs58.encode(new Uint8Array(FromBase64(publicKey))))
    return res.send(422, { publicKey: 'invalid' })

  const result = await Owner.save({
    ownerAddr: ownerParam,
    ethereumAddr,
    updated_at,
  })

  if (result) res.send(201, { result })
  else res.send(500, 'Error creating item')
}

export const find: Handler = async function (req, res) {
  const { story, room } = req.params
  const id = (parseInt(story) - 1) * 20 + (parseInt(room) - 1)
  const mintAddr = (await mintAddrFromId())[id]
  const item = await Residence.find(mintAddr)

  if (item) res.send(200, item)
  else res.send(404, 'Missing item')
}

export const residencesupdates: Handler = async function (req, res) {
  const { yyyy, mm, dd } = req.params

  const updateKeys = await ResidenceUpdate.list(yyyy, mm, dd);
  const updates = Object.fromEntries(await Promise.all(updateKeys.map(async (k) => [k, await ResidenceUpdate.find(k)])));
  
  res.send(200, updates)
}

const MAGICEDENPUBKEY = 'GUfCR9mK6azb9vcpsxgXyj7XRPAKJd4KMHTTVvtncGgp'
const SOLANARTPUBKEY = '3D49QorJyNaL4rcpiynbuS3pRH4Y7EXEM6v6ZGaqfFGK'
const EXCHANGEARTPUBKEY = 'BjaNzGdwRcFYeQGfuLYsc1BbaNRG1yxyWs1hZuGRT8J2'
const ALPHAARTPUBKEY = '4pUQS4Jo2dsfWzt3VgHXy3H6RYnEDd11oWPiaM2rdAPw'

const MARKETPLACES = [
  MAGICEDENPUBKEY,
  SOLANARTPUBKEY,
  EXCHANGEARTPUBKEY,
  ALPHAARTPUBKEY,
]

export const metadata: Handler = async function (req, res) {
  try {
    const { story, room } = req.params

    const mintAddrFromIdLocal = await mintAddrFromId();

    //const query = Object.fromEntries(req.query)
    const includeNFTs = true //query.includeNFTs == "false" ? false : true

    const id = (parseInt(story) - 1) * 20 + (parseInt(room) - 1)
    const mintAddr = mintAddrFromIdLocal[id]

    if (!mintAddr) res.send(500, 'Error finding room')

    const tokenLargestAccounts = (await fetchRPC('getTokenLargestAccounts', [
      mintAddr,
      { commitment: 'confirmed' },
    ])) as any[]

    const tokenHolder = tokenLargestAccounts.find(
      (val) => val.amount == 1,
    ).address

    const {
      data: {
        parsed: {
          info: { owner: ownerAddr },
        },
      },
    } = (await fetchRPC('getAccountInfo', [
      tokenHolder,
      { encoding: 'jsonParsed', commitment: 'confirmed' },
    ])) as any

    const ownersNFTMintAddrs = await (async () => {
      if (!includeNFTs || MARKETPLACES.includes(ownerAddr)) return null

      return (await ownedTokenMintAddrs(ownerAddr)).filter(
        (m: any) => m != mintAddr,
      )
    })()

    const owner = MARKETPLACES.includes(ownerAddr)
      ? {
        market:
          ownerAddr == SOLANARTPUBKEY
            ? 'SOLANART'
            : ownerAddr == MAGICEDENPUBKEY
              ? 'MAGICEDEN'
              : ownerAddr == EXCHANGEARTPUBKEY
                ? 'EXCHANGEART'
                : ownerAddr == ALPHAARTPUBKEY
                  ? 'ALPHAART'
                  : new Error('How?'),
      }
      : ownerAddr

    const ownerStored = await (async () => {
      if (MARKETPLACES.includes(ownerAddr)) return null

      return await Owner.find(owner)
    })()

    const ownersTwitterHandle = await (async () => {
      if (!includeNFTs || MARKETPLACES.includes(ownerAddr)) return null

      return await ownedTwitterHandle(owner)
    })()

    const ownersResidences = []

    const idFromMintAddrLocal = await idFromMintAddr();

    if (!MARKETPLACES.includes(ownerAddr)) {
      for (const ownersNFTMintAddr of ownersNFTMintAddrs ?? []) {
        if (!idFromMintAddrLocal[ownersNFTMintAddr]) continue
        ownersResidences.push([
          ownersNFTMintAddr,
          await Residence.find(ownersNFTMintAddr),
        ])
      }
    }

    const floormateResidences = []

    if (!MARKETPLACES.includes(ownerAddr)) {
      for (const floormateRoom of [...new Array(20)].map((_, ind) => ind)) {
        if (floormateRoom == parseInt(room)) continue

        const floormateId = (parseInt(story) - 1) * 20 + floormateRoom
        const floormateRoomMintAddr = mintAddrFromIdLocal[floormateId]

        floormateResidences.push([floormateRoom, await Residence.find(floormateRoomMintAddr)])
      }
    }

    return res.send(
      200,
      {
        mintAddr,
        residence: await Residence.find(mintAddr),
        owner,
        ownerStored,
        ownersNFTMintAddrs,
        ownersTwitterHandle,
        ownersResidences: Object.fromEntries(ownersResidences),
        floormateResidences: Object.fromEntries(floormateResidences),
      },
      { 'Cache-Control': 'public,max-age=60' },
    )
  } catch (err: any) {
    console.error((err as any).stack.toString());
    return res.send(500, err.toString())
  }
}

export const metadataMarketplace: Handler = async function (req, res) {
  try {
    const { story, room } = req.params

    const id = (parseInt(story) - 1) * 20 + (parseInt(room) - 1)
    const mintAddr = (await mintAddrFromId())[id]

    if (!mintAddr) res.send(500, 'Error finding room')

    const tokenLargestAccounts = (await fetchRPC('getTokenLargestAccounts', [
      mintAddr,
      { commitment: 'confirmed' },
    ])) as any[]

    const tokenHolder = tokenLargestAccounts.find(
      (val) => val.amount == 1,
    ).address

    const {
      data: {
        parsed: {
          info: { owner: ownerAddr },
        },
      },
    } = (await fetchRPC('getAccountInfo', [
      tokenHolder,
      { encoding: 'jsonParsed', commitment: 'confirmed' },
    ])) as any

    const owner = MARKETPLACES.includes(ownerAddr)
      ? {
        market:
          ownerAddr == SOLANARTPUBKEY
            ? 'SOLANART'
            : ownerAddr == MAGICEDENPUBKEY
              ? 'MAGICEDEN'
              : ownerAddr == EXCHANGEARTPUBKEY
                ? 'EXCHANGEART'
                : ownerAddr == ALPHAARTPUBKEY
                  ? 'ALPHAART'
                  : new Error('How?'),
      }
      : ownerAddr

    return res.send(
      200,
      {
        mintAddr,
        owner,
      },
      { 'Cache-Control': 'public,max-age=60' },
    )
  } catch (err: any) {
    console.error((err as any).stack.toString());
    return res.send(500, err.toString())
  }
}

export const owned: Handler = async function (req, res) {
  try {
    const { owner } = req.params

    const ownersNFTMintAddrs = await (async () => {
      if (MARKETPLACES.includes(owner)) return null

      return await ownedTokenMintAddrs(owner)
    })()
    const ownersTwitterHandle = await (async () => {
      if (MARKETPLACES.includes(owner)) return null

      return await ownedTwitterHandle(owner)
    })()

    const ownersResidences = []

    const idFromMintAddrLocal = await idFromMintAddr();

    for (const mintAddr of ownersNFTMintAddrs ?? []) {
      if (idFromMintAddrLocal[mintAddr])
        ownersResidences.push([mintAddr, await Residence.find(mintAddr)])
    }

    return res.send(
      200,
      {
        owner,
        stored: await Owner.find(owner),
        ownersNFTMintAddrs,
        ownersTwitterHandle,
        ownersResidences: Object.fromEntries(ownersResidences),
      },
      { 'Cache-Control': 'public,max-age=60' },
    )
  } catch (err: any) {
    console.error((err as any).stack.toString());
    return res.send(500, err.toString())
  }
}

export const image: Handler = async function (req, res) {
  const { size } = Object.fromEntries(req.query)

  const { story, room } = req.params
  const id = (parseInt(story) - 1) * 20 + (parseInt(room) - 1)

  if (id != null) {
    let response = await fetch(
      `${(await cloudflareFromId())[id]}/${size ?? '350'}`,
    )

    response = new Response(response.body, response)

    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.append('Vary', 'Origin')

    return response
  } else res.send(404, 'Missing image')
}

export const billboard: Handler = async function (req, res) {
  const { size } = Object.fromEntries(req.query)

  const { story, room } = req.params
  const id = (parseInt(story) - 1) * 20 + (parseInt(room) - 1)
  const mintAddr = (await mintAddrFromId())[id]
  const item = await Billboard.find(mintAddr)

  if (item?.imageId != null) {
    let response = await fetch(
      `https://imagedelivery.net/aZ7X2B6453pK6VgwfD4hVg/${item.imageId}/${size ?? '350'}`,
    )

    response = new Response(response.body, response)

    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.append('Vary', 'Origin')

    return response
  } else res.send(404, 'Missing image')
}

export const billboardSave: Handler = async function (req, res) {
  const { story: storyParam, room: roomParam } = req.params
  const id = (parseInt(storyParam) - 1) * 20 + (parseInt(roomParam) - 1)
  const mintAddr = (await mintAddrFromId())[id]

  const { encodedMessage, signature, publicKey, billboardImageId } = await req.body() as any;

  const isVerified = sign.detached.verify(
    new Uint8Array(FromBase64(encodedMessage)),
    new Uint8Array(FromBase64(signature)),
    new Uint8Array(FromBase64(publicKey)),
  )
  if (!isVerified) return res.send(422, { signature: 'invalid' })

  const rawMessage = new TextDecoder('utf8').decode(
    new Uint8Array(FromBase64(encodedMessage)),
  )

  try {
    JSON.parse(rawMessage) //Parsing raw message should throw an error
    throw new Error('Raw message should not be json serializable')
  } catch (e) {
    if ((e as Error)?.message === 'Raw message should not be json serializable')
      throw e
  }

  const [
    story,
    room,
    name,
    color,
    updated_at,
    nftlist_type,
    nftlist,
    nftsortedlist,
    billboardupload,
    bio,
    web3media,
  ] = (() => {
    const RPRTS = {
      NL: '(\\n|\\r|\\n)',
      CLR: '(#([0-9a-fA-F]{3}){1,2})',
      DIS: (...args: any[]) =>
        args[1] ? `(\\d{${args[0]},${args[1]}})` : `(\\d{${args[0]}})`,
      EXP: '(.*?)',
    }
    const regexpCore = `Update Residence ${RPRTS.DIS(1, 3)}-${RPRTS.DIS(1, 2)}${RPRTS.NL}${RPRTS.NL}Name: ${RPRTS.EXP}${RPRTS.NL}Color: ${RPRTS.CLR}${RPRTS.NL}Updated: ${RPRTS.DIS(13)}`
    const regexpExten = `${regexpCore}${RPRTS.NL}${RPRTS.NL}NFT List Type: (white|black)${RPRTS.NL}NFT List: \\[${RPRTS.EXP}\\]${RPRTS.NL}NFT Sorted: \\[${RPRTS.EXP}\\]`
    const regexpExten2 = `${regexpExten}${RPRTS.NL}${RPRTS.NL}Billboard Upload: (true|false)${RPRTS.NL}Bio: \\[${RPRTS.EXP}\\]`

    try {
      const regexpExten3 = `${regexpExten2}${RPRTS.NL}${RPRTS.NL}Web3 Media: \\[${RPRTS.EXP}\\]`

      return JSON.parse(
        rawMessage.replace(
          new RegExp(`^${regexpExten3}$`, 'gm'),
          `[$1, $2, "$5", "$7", $10, "$13", [$15], [$17], $20, $22, [$25]]`,
        ),
      )
    } catch (e) {
      console.error((e as any).stack.toString());

      return JSON.parse(
        rawMessage.replace(
          new RegExp(`^${regexpExten2}$`, 'gm'),
          `[$1, $2, "$5", "$7", $10, "$13", [$15], [$17], $20, $22]`,
        ),
      )
    }
  })()

  if (story != storyParam) return res.send(422, { story: 'invalid' })
  if (room != roomParam) return res.send(422, { room: 'invalid' })

  if (!inSpan(updated_at, MINUTE))
    return res.send(422, { updated_at: 'invalid' })

  if (!billboardupload) return res.send(422, { billboardupload: 'invalid' })

  const prevItem = await Billboard.find(mintAddr);

  if (prevItem?.imageId) await fetch(`https://api.cloudflare.com/client/v4/accounts/fd2cba8877a5be60badd9a7261b01cc6/images/v1/${prevItem?.imageId}`, {
    headers: {
      "Authorization": `Bearer ${IMAGE_API_KEY}`,
    },
    method: "DELETE"
  });

  const result = await Billboard.save({
    residenceMintAddr: mintAddr,
    imageId: billboardImageId,
  })

  if (result) res.send(201, { result })
  else res.send(500, 'Error creating item')
}

export const socialcard: Handler = async function (req, res) {
  const { story, room } = req.params
  const id = (parseInt(story) - 1) * 20 + (parseInt(room) - 1)
  const mintAddr = (await mintAddrFromId())[id]
  const item = await SocialCard.find(mintAddr)

  if (item?.imageId != null) {
    let response = await fetch(
      `https://imagedelivery.net/aZ7X2B6453pK6VgwfD4hVg/${item.imageId}/public`,
    )

    response = new Response(response.body, response)

    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.append('Vary', 'Origin')

    return response
  } else res.send(404, 'Missing image')
}

export const getNFTByMintAddress: Handler = async function (req, res) {
  const { mintAddr } = req.params

  const nft = await Nft.find(mintAddr);
  if (nft) return res.send(200, nft);

  try {
    const { name: title, image: img, attributes } = await getNFTMetadataByMintAddress(mintAddr);

    const newNft: Nft.Nft = { mintAddr, title, img, attributes };
    req.extend(Nft.save(newNft));

    return res.send(200, newNft);
  } catch (err: any) {
    console.error((err as any).stack.toString());
    return res.send(500, err.toString())
  }
}
