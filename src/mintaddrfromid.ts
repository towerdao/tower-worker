import type { KV } from 'worktop/kv';

declare const urls: KV.Namespace;

//wrangler kv:key put --binding="urls" "mintaddrfromid.json" "mintaddrfromid.json" --path

export async function mintAddrFromId(): Promise<{ [key: number]: string }> {
  const mintAddrs = await urls.get<{ [key: string]: string }>("mintaddrfromid.json", "json");

  if (!mintAddrs) throw new Error("mintaddrfromid.json is missing, but really shouldn't be");

  return mintAddrs;
}

export async function idFromMintAddr(): Promise<{ [key: string]: number }> {
  const mintAddrs = await urls.get<{ [key: string]: string }>("mintaddrfromid.json", "json");

  if (!mintAddrs) throw new Error("mintaddrfromid.json is missing, but really shouldn't be");

  return Object.fromEntries(Object.entries(mintAddrs).map(([id, mintAddr]) => [mintAddr, parseInt(id)]));
}