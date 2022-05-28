import * as DB from 'worktop/kv';
import type { KV } from 'worktop/kv';

declare const BILLBOARDS: KV.Namespace;

export interface Billboard {
	residenceMintAddr: string;
	imageId: string;
}

const prefix = `billboards::`;
const toKeyname = (mintAddr: string) => prefix + mintAddr;

/**
 * Force-write a `Billboard` record
 */
export function save(item: Billboard) : Promise<boolean> {
	const key = toKeyname(item.residenceMintAddr);
	return DB.write<Billboard>(BILLBOARDS, key, item);
}

/**
 * Find a `Billboard` record by its mintAddr
 */
export function find(residenceMintAddr: string): Promise<Billboard | null> {
	const key = toKeyname(residenceMintAddr);
	return DB.read<Billboard>(BILLBOARDS, key, 'json');
}