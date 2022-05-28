import * as DB from 'worktop/kv';
import type { KV } from 'worktop/kv';

import * as ResidenceUpdate from './residenceupdate'

declare const RESIDENCES: KV.Namespace;

enum NFTListType {
	white = "white",
	black = "black",
}

type Entries<T> = {
    [K in keyof T]: [K, T[K]];
}[keyof T][];

//Future Warning: Make sure any new properties are put in all spots below, and residenceupdates type, and news page ;)

export interface Residence {
	mintAddr: string;
	name: string;
	bio: string | undefined;
	color: string;
	updated_at: number;
	nftlist_type: NFTListType | undefined;
	nftlist: string[]| undefined;
	nftsortedlist: string[] | undefined;
	web3media: any[] | undefined;
}

const prefix = `residences::`;
const toKeyname = (mintAddr: string) => prefix + mintAddr;

/**
 * Force-write a `Residence` record
 */
export async function save(ownerAddr: string, newItem: Residence) : Promise<boolean> {
	const oldItem = await find(newItem.mintAddr);
	const update: ResidenceUpdate.SavedResidenceUpdate = {ownerAddr,  mintAddr: newItem.mintAddr, old: {}, new: {} };

	if (oldItem?.updated_at) {
		for (const [key, newVal] of (Object.entries(newItem) as Entries<Residence>)) {
			switch (key) {
				case "mintAddr":
					break;
				case "name":
				case "bio":
				case "color":
					if (newVal != oldItem[key]) {
						update.old[key] = oldItem[key] as string;
						update.new[key] = newVal as string;
					}
					break;
				case "nftlist_type":
					if (newVal != oldItem[key]) {
						update.old[key] = oldItem[key] as NFTListType;
						update.new[key] = newVal as NFTListType;
					}
					break;
				case "updated_at":
					if (newVal != oldItem[key]) {
						update.old[key] = oldItem[key] as number;
						update.new[key] = newVal as number;
					}
					break;
				case "nftlist":
				case "nftsortedlist":
				case "web3media":
					if (JSON.stringify(newVal) != JSON.stringify(oldItem[key])) {
						update.old[key] = oldItem[key] as any[];
						update.new[key] = newVal as any[];
					}
					break;
			}
			
		}

		await ResidenceUpdate.save(update);
	} else {
		for (const [key, newVal] of (Object.entries(newItem) as Entries<Residence>)) {
			switch (key) {
				case "mintAddr":
					break;
				case "name":
				case "bio":
				case "color":
					update.new[key] = newVal as string;
					break;
				case "nftlist_type":
					update.new[key] = newVal as NFTListType;
					break;
				case "updated_at":
					update.new[key] = newVal as number;
					break;
				case "nftlist":
				case "nftsortedlist":
				case "web3media":
					update.new[key] = newVal as any[];
					break;
			}
			
		}

		await ResidenceUpdate.save(update);
	}
	
	const key = toKeyname(newItem.mintAddr);
	return DB.write<Residence>(RESIDENCES, key, newItem);
}

/**
 * Find a `Residence` record by its mintAddr
 */
export function find(mintAddr: string): Promise<Residence | null> {
	const key = toKeyname(mintAddr);
	return DB.read<Residence>(RESIDENCES, key, 'json');
}