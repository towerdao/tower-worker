//eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import * as bs58 from 'base58-universal';

import { is_on_curve } from './naclutils';
import { BigIntWithBase, Uint8ArrayFromBigInt, Uint8ArrayFromBase64, sha256, padUint8Array } from './utils';

//eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import { deserializeUnchecked } from './borsh.bundle.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fetchRPC(method: string, params: any[]): unknown {
  return fetch('https://towerdao.genesysgo.net/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      method,
      jsonrpc: '2.0',
      params,
      id: 1,
    }),
  })
    .then((res) => res.json() as any)
    .then((res) => {
      if (res.error) {
        console.error((res.error as any).stack.toString());
        throw { method, error: res.error, params };
      }

      return res.result
    })
    .then((res) => (Array.isArray(res) ? res : res.value))
}

export async function ownedTokenMintAddrs(
  ownerAddr: string,
): Promise<string[]> {
  const tokenAccountsByOwner = (await fetchRPC('getTokenAccountsByOwner', [
    ownerAddr,
    {
      programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    },
    {
      encoding: 'jsonParsed',
    },
  ])) as any

  return tokenAccountsByOwner
  .map((a: any) => a?.account?.data?.parsed?.info)
  .filter((i: any) => i?.tokenAmount?.uiAmount > 0)
  .map((i: any) => i?.mint)
  .filter((m: any) => typeof m == 'string')
}

//Odd https://github.com/solana-labs/solana-program-library/blob/3e945798fc70e111b131622c1185385c222610fd/name-service/js/src/twitter.ts#L28
const TWITTER_VERIFICATION_AUTHORITY =
  'FvPH7PrVrLGKPfqaf3xJodFTjZriqrAXXLTVWEorTFBi'
const TWITTER_ROOT_PARENT_REGISTRY_KEY =
  '4YcexoW3r78zz16J2aqmukBLRwGq6rAvWzJpkYAXqebv'
const VERIFICATION_AUTHORITY_OFFSET = 64
const NAME_PROGRAM_ID = 'namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX'
const HEADER_LEN = 96;

export async function ownedTwitterHandle(
  ownerAddr: string,
): Promise<string | null> {
  const filteredAccounts = (await fetchRPC('getProgramAccounts', [
    NAME_PROGRAM_ID,
    {
      encoding: 'base64',
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: TWITTER_ROOT_PARENT_REGISTRY_KEY,
          },
        },
        {
          memcmp: {
            offset: 32,
            bytes: ownerAddr,
          },
        },
        {
          memcmp: {
            offset: VERIFICATION_AUTHORITY_OFFSET,
            bytes: TWITTER_VERIFICATION_AUTHORITY,
          },
        },
      ],
    },
  ])) as any

  for (const f of filteredAccounts) {
    const parsedData = atob(f?.account?.data[0])
    if (parsedData && parsedData.length > HEADER_LEN + 32) {
      //This could be entirely, incredibly stupid

      //eslint-disable-next-line @typescript-eslint/ban-ts-comment
      //@ts-ignore  
      // eslint-disable-next-line no-control-regex
      return parsedData.toString()?.match(/\u0000\u0000\u0000(.*?)$/gu)[0].replace('\u0000\u0000\u0000', '');
      //const dirtyString = parsedData?.slice(HEADER_LEN).toString().replaceAll('\u0000', '');
      //return (new TextDecoder('utf8')).decode((new TextEncoder().encode(dirtyString)).slice(32))
      //return parsedData?.slice(HEADER_LEN).toString()//.replaceAll('\u0000', '')
    }
  }

  return null
}

const MAX_SEED_LENGTH = 32;

async function createProgramAddress(
  seeds: Array<Uint8Array>,
  programId: Uint8Array,
): Promise<Uint8Array> {
  let buffer = new Uint8Array();

  for (const seed of seeds) {
    if (seed.length > MAX_SEED_LENGTH) throw new TypeError(`Max seed length exceeded`);
    buffer = new Uint8Array([...buffer, ...seed]);
  }

  buffer = new Uint8Array([
    ...buffer,
    ...programId,
    ...(new TextEncoder()).encode('ProgramDerivedAddress'),
  ]);

  let hash = (await sha256(buffer));

  let publicKeyBytes = padUint8Array(Uint8ArrayFromBigInt(BigIntWithBase(hash, 16)), 32, 0);

  if (is_on_curve(publicKeyBytes)) {
    throw new Error(`Invalid seeds, address must fall off the curve`);
  }

  return publicKeyBytes;
}

const findProgramAddress = async (
  seeds: Array<Uint8Array>,
  programId: Uint8Array
) => {
  let nonce = 255;
  let address;
  while (nonce != 0) {
    try {
      const seedsWithNonce = seeds.concat(Uint8Array.from([nonce]));
      address = await createProgramAddress(seedsWithNonce, programId);
    } catch (err) {
      if (err instanceof TypeError) throw err;
      nonce--;
      continue;
    }

    return [bs58.encode(address), nonce] as [string, number];
  }

  throw new Error(`Unable to find a viable program address nonce`);
};

const METADATA_PREFIX = "metadata";
const METADATA_PROGRAM_ID = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

async function getMetadataKey(
  mintAddr: string
): Promise<string> {
  return (
    await findProgramAddress(
      [
        (new TextEncoder()).encode(METADATA_PREFIX),
        bs58.decode(METADATA_PROGRAM_ID),
        bs58.decode(mintAddr),
      ],
      bs58.decode(METADATA_PROGRAM_ID)
    )
  )[0];
}


type PublicKey = string;
class Creator {
  address: PublicKey;
  verified: boolean;
  share: number;

  constructor(args: { address: PublicKey; verified: boolean; share: number }) {
    this.address = args.address;
    this.verified = args.verified;
    this.share = args.share;
  }
}

enum MetadataKey {
  Uninitialized = 0,
  MetadataV1 = 4,
  EditionV1 = 1,
  MasterEditionV1 = 2,
  MasterEditionV2 = 6,
  EditionMarker = 7,
}

class Data {
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints: number;
  creators: Creator[] | null;
  constructor(args: {
    name: string;
    symbol: string;
    uri: string;
    sellerFeeBasisPoints: number;
    creators: Creator[] | null;
  }) {
    this.name = args.name;
    this.symbol = args.symbol;
    this.uri = args.uri;
    this.sellerFeeBasisPoints = args.sellerFeeBasisPoints;
    this.creators = args.creators;
  }
}

class Metadata {
  key: MetadataKey;
  updateAuthority: PublicKey;
  mint: PublicKey;
  data: Data;
  primarySaleHappened: boolean;
  isMutable: boolean;
  masterEdition?: PublicKey;
  edition?: PublicKey;
  constructor(args: {
    updateAuthority: PublicKey;
    mint: PublicKey;
    data: Data;
    primarySaleHappened: boolean;
    isMutable: boolean;
    masterEdition?: PublicKey;
  }) {
    this.key = MetadataKey.MetadataV1;
    this.updateAuthority = args.updateAuthority;
    this.mint = args.mint;
    this.data = args.data;
    this.primarySaleHappened = args.primarySaleHappened;
    this.isMutable = args.isMutable;
  }
}

const METADATA_SCHEMA = new Map<any, any>([
  [
    Data,
    {
      kind: "struct",
      fields: [
        ["name", "string"],
        ["symbol", "string"],
        ["uri", "string"],
        ["sellerFeeBasisPoints", "u16"],
        ["creators", { kind: "option", type: [Creator] }],
      ],
    },
  ],
  [
    Creator,
    {
      kind: "struct",
      fields: [
        ["address", [32]],
        ["verified", "u8"],
        ["share", "u8"],
      ],
    },
  ],
  [
    Metadata,
    {
      kind: "struct",
      fields: [
        ["key", "u8"],
        ["updateAuthority", [32]],
        ["mint", [32]],
        ["data", Data],
        ["primarySaleHappened", "u8"],
        ["isMutable", "u8"],
      ],
    },
  ],
]);

const decodeMetadata = (buffer: Uint8Array): Metadata => {
  const metadata = deserializeUnchecked(
    METADATA_SCHEMA,
    Metadata,
    buffer
  ) as Metadata;

  metadata.data.name = metadata.data.name.replace(/\0/g, "");
  metadata.data.symbol = metadata.data.symbol.replace(/\0/g, "");
  metadata.data.uri = metadata.data.uri.replace(/\0/g, "");
  metadata.data.name = metadata.data.name.replace(/\0/g, "");
  return metadata;
};

export async function getNFTMetadataByMintAddress(mintAddr: string): Promise<any> {
  const metadataKey = await getMetadataKey(mintAddr);

  const { data } = await fetchRPC('getAccountInfo', [
    metadataKey,
    { encoding: 'base64' },
  ]) as any;

  const tokenMetadata = await decodeMetadata(Uint8ArrayFromBase64(data[0]));

  if (!tokenMetadata?.data?.uri) {
    throw new Error(JSON.stringify({ mintAddr, failed: true, message: "no associated metadata found" }));
  }

  try {
    return await fetch(tokenMetadata.data.uri).then((res) => res.json().catch());
  } catch (err: any) {
    console.error((err as any).stack.toString());
    throw new Error(JSON.stringify({ tokenMetadata, failed: true }));
  }
}