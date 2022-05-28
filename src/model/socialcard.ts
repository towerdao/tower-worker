import * as DB from 'worktop/kv';
import type { KV } from 'worktop/kv';

declare const SOCIALCARDS: KV.Namespace;

export interface SocialCard {
	residenceMintAddr: string;
	imageId: string;
}

const prefix = `socialcards::`;
const toKeyname = (mintAddr: string) => prefix + mintAddr;

/**
 * Force-write a `SocialCard` record
 */
export function save(item: SocialCard) : Promise<boolean> {
	const key = toKeyname(item.residenceMintAddr);
	return DB.write<SocialCard>(SOCIALCARDS, key, item);
}

/**
 * Find a `SocialCard` record by its mintAddr
 */
export function find(residenceMintAddr: string): Promise<SocialCard | null> {
	const key = toKeyname(residenceMintAddr);
	return DB.read<SocialCard>(SOCIALCARDS, key, 'json');
}