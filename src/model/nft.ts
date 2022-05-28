import * as DB from 'worktop/kv';
import type { KV } from 'worktop/kv';

declare const NFTS: KV.Namespace;

export interface Nft {
	mintAddr: string;
	title: string;
	img: string;
	attributes: any;
}

const prefix = `nfts::`;
const toKeyname = (mintAddr: string) => prefix + mintAddr;

/**
 * Force-write a `Nft` record
 */
export function save(item: Nft) : Promise<boolean> {
	const key = toKeyname(item.mintAddr);
	return DB.write<Nft>(NFTS, key, item, { expirationTtl: 60 * 60 * 24 * 28 }); //Expire after 28 days
}

/**
 * Find a `Nft` record by its mintAddr
 */
export function find(mintAddr: string): Promise<Nft | null> {
	const key = toKeyname(mintAddr);
	return DB.read<Nft>(NFTS, key, 'json');
}