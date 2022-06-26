export function BigIntWithBase(value: string, radix: number): bigint {
    var size = 10,
        factor = BigInt(radix ** size),
        i = value.length % size || size,
        parts = [value.slice(0, i)];

    while (i < value.length) parts.push(value.slice(i, i += size));

    return parts.reduce((r, v) => r * factor + BigInt(parseInt(v, radix)), 0n);
}

export function padUint8Array(array: Uint8Array, length: number, fill: any): Uint8Array {
    return length > array.length ? new Uint8Array([...new Uint8Array(length - array.length).fill(fill), ...array]) : array;
}

export async function sha256(msgBuffer: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray
        .map((b) => ('00' + b.toString(16)).slice(-2))
        .join('')
    return hashHex
}