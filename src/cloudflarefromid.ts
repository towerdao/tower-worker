import type { KV } from 'worktop/kv';

declare const urls: KV.Namespace;

export async function cloudflareFromId(): Promise<{ [key: string]: string }> {
  const imageIds = await urls.get<{ [key: string]: string }>("cloudflarefromid.json", "json");

  if (!imageIds) throw new Error("cloudflarefromid.json is missing, but really shouldn't be");

  return Object.fromEntries(
    Object.entries(imageIds).map(([id, imageId]) => [
      id,
      `https://imagedelivery.net/aZ7X2B6453pK6VgwfD4hVg/${imageId}`,
    ]),
  )
}