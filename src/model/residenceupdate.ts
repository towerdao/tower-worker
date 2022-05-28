import * as DB from 'worktop/kv';
import type { KV } from 'worktop/kv';

declare const RESIDENCESUPDATES: KV.Namespace;

enum NFTListType {
	white = "white",
	black = "black",
}

export interface ResidenceUpdate {
	name?: string;
	bio?: string;
	color?: string;
	updated_at?: number;
	nftlist_type?: NFTListType;
	nftlist?: string[];
	nftsortedlist?: string[];
	web3media?: any[];
}

export interface SavedResidenceUpdate {
	ownerAddr: string;
	mintAddr: string;
	old: ResidenceUpdate;
	new: ResidenceUpdate;
}

const utc_yyyymmdd = () => {
	const date = new Date(); 

	return [date.getUTCFullYear(), (date.getUTCMonth()+1).toString().padStart(2, '0'), date.getUTCDate().toString().padStart(2, '0')].join('');
};

const prefix = `residencesupdates::`; //Ex: residencesupdates::20220220::8NeFZJuMsHkTV9n2JsJ3TXfEBhkusf5bNtdm3h5L8ZsF::1645344854
const toKeypref = (yyyymmdd: string) => prefix + yyyymmdd;
const toKeyname = (yyyymmdd: string, mintAddr: string, time: string) => `${toKeypref(yyyymmdd)}::${mintAddr}::${time}`;

/**
 * Force-write a `SavedResidenceUpdate` record
 */
export function save(item: SavedResidenceUpdate) : Promise<boolean> {
	const key = toKeyname(utc_yyyymmdd(), item.mintAddr, new Date().getTime().toString());
	return DB.write<SavedResidenceUpdate>(RESIDENCESUPDATES, key, item);
}

/**
 * Find a `SavedResidenceUpdate` record by its key
 */
 export function find(key: string): Promise<SavedResidenceUpdate | null> {
	return DB.read<SavedResidenceUpdate>(RESIDENCESUPDATES, key, 'json');
}

/**
 * Find a `SavedResidenceUpdate` record by its date
 */
export function list(yyyy: string, mm: string, dd: string): Promise<string[]> {
	return DB.paginate<SavedResidenceUpdate>(RESIDENCESUPDATES, { prefix: toKeypref(yyyy + mm + dd)});
}