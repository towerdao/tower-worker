var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const textDecoder = new TextDecoder("utf-8", { fatal: true });

const INITIAL_LENGTH = 1024;
class BorshError extends Error {
    constructor(message) {
        super(message);
        this.fieldPath = [];
        this.originalMessage = message;
    }
    addToFieldPath(fieldName) {
        this.fieldPath.splice(0, 0, fieldName);
        // NOTE: Modifying message directly as jest doesn't use .toString()
        this.message = this.originalMessage + ": " + this.fieldPath.join(".");
    }
}
function handlingRangeError(target, propertyKey, propertyDescriptor) {
    const originalMethod = propertyDescriptor.value;
    propertyDescriptor.value = function (...args) {
        try {
            return originalMethod.apply(this, args);
        }
        catch (e) {
            if (e instanceof RangeError) {
                const code = e.code;
                if (["ERR_BUFFER_OUT_OF_BOUNDS", "ERR_OUT_OF_RANGE"].indexOf(code) >= 0) {
                    throw new BorshError("Reached the end of buffer when deserializing");
                }
            }
            throw e;
        }
    };
}
class BinaryReader {
    constructor(buf) {
        this.buf = buf;
        this.offset = 0;
    }
    readU8() {
        const value = this.buf[this.offset];
        this.offset += 1;
        return value;
    }
    readU16() {
        const value = this.buf[this.offset];
        this.offset += 2;
        return value;
    }
    readU32() {
        const value = this.buf[this.offset];
        this.offset += 4;
        return value;
    }
    readU64() {
        const buf = this.readBuffer(8);
        return new bn_js_1.default(buf, "le");
    }
    readU128() {
        const buf = this.readBuffer(16);
        return new bn_js_1.default(buf, "le");
    }
    readU256() {
        const buf = this.readBuffer(32);
        return new bn_js_1.default(buf, "le");
    }
    readU512() {
        const buf = this.readBuffer(64);
        return new bn_js_1.default(buf, "le");
    }
    readBuffer(len) {
        if (this.offset + len > this.buf.length) {
            throw new BorshError(`Expected buffer length ${len} isn't within bounds`);
        }
        const result = this.buf.slice(this.offset, this.offset + len);
        this.offset += len;
        return result;
    }
    readString() {
        const len = this.readU32();
        const buf = this.readBuffer(len);
        try {
            // NOTE: Using TextDecoder to fail on invalid UTF-8
            return textDecoder.decode(buf);
        }
        catch (e) {
            throw new BorshError(`Error decoding UTF-8 string: ${e}`);
        }
    }
    readFixedArray(len) {
        return new Uint8Array(this.readBuffer(len));
    }
    readArray(fn) {
        const len = this.readU32();
        const result = Array();
        for (let i = 0; i < len; ++i) {
            result.push(fn());
        }
        return result;
    }
}
__decorate([
    handlingRangeError
], BinaryReader.prototype, "readU8", null);
__decorate([
    handlingRangeError
], BinaryReader.prototype, "readU16", null);
__decorate([
    handlingRangeError
], BinaryReader.prototype, "readU32", null);
__decorate([
    handlingRangeError
], BinaryReader.prototype, "readU64", null);
__decorate([
    handlingRangeError
], BinaryReader.prototype, "readU128", null);
__decorate([
    handlingRangeError
], BinaryReader.prototype, "readU256", null);
__decorate([
    handlingRangeError
], BinaryReader.prototype, "readU512", null);
__decorate([
    handlingRangeError
], BinaryReader.prototype, "readString", null);
__decorate([
    handlingRangeError
], BinaryReader.prototype, "readFixedArray", null);
__decorate([
    handlingRangeError
], BinaryReader.prototype, "readArray", null);
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function deserializeField(schema, fieldName, fieldType, reader) {
    try {
        if (typeof fieldType === "string") {
            return reader[`read${capitalizeFirstLetter(fieldType)}`]();
        }
        if (fieldType instanceof Array) {
            if (typeof fieldType[0] === "number") {
                return reader.readFixedArray(fieldType[0]);
            }
            else if (typeof fieldType[1] === "number") {
                const arr = [];
                for (let i = 0; i < fieldType[1]; i++) {
                    arr.push(deserializeField(schema, null, fieldType[0], reader));
                }
                return arr;
            }
            else {
                return reader.readArray(() => deserializeField(schema, fieldName, fieldType[0], reader));
            }
        }
        if (fieldType.kind === "option") {
            const option = reader.readU8();
            if (option) {
                return deserializeField(schema, fieldName, fieldType.type, reader);
            }
            return undefined;
        }
        if (fieldType.kind === "map") {
            let map = new Map();
            const length = reader.readU32();
            for (let i = 0; i < length; i++) {
                const key = deserializeField(schema, fieldName, fieldType.key, reader);
                const val = deserializeField(schema, fieldName, fieldType.value, reader);
                map.set(key, val);
            }
            return map;
        }
        return deserializeStruct(schema, fieldType, reader);
    }
    catch (error) {
        if (error instanceof BorshError) {
            error.addToFieldPath(fieldName);
        }
        throw error;
    }
}
function deserializeStruct(schema, classType, reader) {
    if (typeof classType.borshDeserialize === "function") {
        return classType.borshDeserialize(reader);
    }
    const structSchema = schema.get(classType);
    if (!structSchema) {
        throw new BorshError(`Class ${classType.name} is missing in schema`);
    }
    if (structSchema.kind === "struct") {
        const result = {};
        for (const [fieldName, fieldType] of schema.get(classType).fields) {
            result[fieldName] = deserializeField(schema, fieldName, fieldType, reader);
        }
        return new classType(result);
    }
    if (structSchema.kind === "enum") {
        const idx = reader.readU8();
        if (idx >= structSchema.values.length) {
            throw new BorshError(`Enum index: ${idx} is out of range`);
        }
        const [fieldName, fieldType] = structSchema.values[idx];
        const fieldValue = deserializeField(schema, fieldName, fieldType, reader);
        return new classType({ [fieldName]: fieldValue });
    }
    throw new BorshError(`Unexpected schema kind: ${structSchema.kind} for ${classType.constructor.name}`);
}
/// Deserializes object from bytes using schema, without checking the length read
export function deserializeUnchecked(schema, classType, buffer, Reader = BinaryReader) {
    const reader = new Reader(buffer);
    return deserializeStruct(schema, classType, reader);
}