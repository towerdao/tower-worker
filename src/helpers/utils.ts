export function BigIntWithBase(value: string, radix: number) {
    var size = 10,
        factor = BigInt(radix ** size),
        i = value.length % size || size,
        parts = [value.slice(0, i)];

    while (i < value.length) parts.push(value.slice(i, i += size));

    return parts.reduce((r, v) => r * factor + BigInt(parseInt(v, radix)), 0n);
}

export function padUint8Array(array: Uint8Array, length: number, fill: any) {
    return length > array.length ? new Uint8Array([...new Uint8Array(length - array.length).fill(fill), ...array]) : array;
}

export function Uint8ArrayFromBigInt(num: bigint) {
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

export function Uint8ArrayFromBase64(base64: string) {
    var binary_string = atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
}

export async function sha256(msgBuffer: Uint8Array) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
    // convert ArrayBuffer to Array
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    // convert bytes to hex string
    const hashHex = hashArray
        .map((b) => ('00' + b.toString(16)).slice(-2))
        .join('')
    return hashHex
}