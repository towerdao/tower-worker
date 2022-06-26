import * as bs58 from 'base58-universal';

export const ArrFromB64Str = function (str: any): Array<number> {
    return atob(str)
        .split('')
        .map(function (c) {
            return c.charCodeAt(0)
        })
}

export const U8ArrFromB64Str = function (str: string): Uint8Array {
    return new Uint8Array(ArrFromB64Str(str));
}

export const UTF8StrFromB64Str = function (str: string): string {
    return new TextDecoder('utf8').decode(U8ArrFromB64Str(str));
}

export const B58StrFromB64Str = function (str: string): string {
    return bs58.encode(U8ArrFromB64Str(str));
}

export const U8ArrFromBigInt = function (num: bigint): Uint8Array {
    var hex = BigInt(num).toString(16);
    if (hex.length % 2) { hex = '0' + hex; }

    var len = hex.length / 2;
    var u8 = new Uint8Array(len);

    var i = 0;
    var j = 0;
    while (i < len) {
        u8[i] = parseInt(hex.slice(j, j + 2), 16);
        i += 1;
        j += 2;
    }

    return u8;
}