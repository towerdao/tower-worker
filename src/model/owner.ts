import * as DB from 'worktop/kv';
import type { KV } from 'worktop/kv';

declare const OWNERS: KV.Namespace;

export interface Owner {
	ownerAddr: string;
	ethereumAddr?: string;
	updated_at: number;
}

const prefix = `owners::`;
const toKeyname = (mintAddr: string) => prefix + mintAddr;

/**
 * Force-write a `Owner` record
 */
export function save(item: Owner) : Promise<boolean> {
	const key = toKeyname(item.ownerAddr);
	return DB.write<Owner>(OWNERS, key, item);
}

/**
 * Find a `Owner` record by its mintAddr
 */
export function find(ownerAddr: string): Promise<Owner | null> {
	const key = toKeyname(ownerAddr);
	return DB.read<Owner>(OWNERS, key, 'json');
}