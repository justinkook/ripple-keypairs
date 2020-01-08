"use strict";
/**
 * Codec class
 */
Object.defineProperty(exports, "__esModule", { value: true });
const baseCodec = require('base-x');
const { seqEqual, concatArgs } = require('./utils');
class Codec {
    constructor(options) {
        this.sha256 = options.sha256;
        this.alphabet = options.alphabet;
        this.codec = baseCodec(this.alphabet);
        this.base = this.alphabet.length;
    }
    /**
     * Encoder.
     *
     * @param bytes Buffer of data to encode.
     * @param opts Options object including the version bytes and the expected length of the data to encode.
     */
    encode(bytes, opts) {
        const versions = opts.versions;
        return this.encodeVersioned(bytes, versions, opts.expectedLength);
    }
    encodeVersioned(bytes, versions, expectedLength) {
        if (expectedLength && bytes.length !== expectedLength) {
            throw new Error('unexpected_payload_length: bytes.length does not match expectedLength');
        }
        return this.encodeChecked(concatArgs(versions, bytes));
    }
    encodeChecked(buffer) {
        const check = this.sha256(this.sha256(buffer)).slice(0, 4);
        return this.encodeRaw(Buffer.from(concatArgs(buffer, check)));
    }
    encodeRaw(bytes) {
        return this.codec.encode(bytes);
    }
    /**
     * Decoder.
     *
     * @param base58string Base58Check-encoded string to decode.
     * @param opts Options object including the version byte(s) and the expected length of the data after decoding.
     */
    decode(base58string, opts = {}) {
        const versions = Array.isArray(opts.versions) ? opts.versions : [opts.versions];
        const types = opts.versionTypes;
        if (versions) {
            const withoutSum = this.decodeChecked(base58string);
            const ret = {
                version: null,
                bytes: null,
                type: null
            };
            if (versions.length > 1 && !opts.expectedLength) {
                throw new Error('expectedLength is required because there are >= 2 possible versions');
            }
            const versionLengthGuess = typeof versions[0] === 'number' ? 1 : versions[0].length;
            const payloadLength = opts.expectedLength || withoutSum.length - versionLengthGuess;
            const versionBytes = withoutSum.slice(0, -payloadLength);
            const payload = withoutSum.slice(-payloadLength);
            let foundVersion = false;
            for (let i = 0; i < versions.length; i++) {
                const version = Array.isArray(versions[i]) ? versions[i] : [versions[i]];
                if (seqEqual(versionBytes, version)) {
                    ret.version = version;
                    ret.bytes = payload;
                    if (types) {
                        ret.type = types[i];
                    }
                    foundVersion = true;
                }
            }
            if (!foundVersion) {
                throw new Error('version_invalid: version bytes do not match any of the provided version(s)');
            }
            if (opts.expectedLength && ret.bytes.length !== opts.expectedLength) {
                throw new Error('unexpected_payload_length: payload length does not match expectedLength');
            }
            return ret;
        }
        // Assume that base58string is 'checked'
        return this.decodeChecked(base58string);
    }
    decodeChecked(base58string) {
        const buffer = this.decodeRaw(base58string);
        if (buffer.length < 5) {
            throw new Error('invalid_input_size: decoded data must have length >= 5');
        }
        if (!this.verifyCheckSum(buffer)) {
            throw new Error('checksum_invalid');
        }
        return buffer.slice(0, -4);
    }
    decodeRaw(base58string) {
        return this.codec.decode(base58string);
    }
    verifyCheckSum(bytes) {
        const computed = this.sha256(this.sha256(bytes.slice(0, -4))).slice(0, 4);
        const checksum = bytes.slice(-4);
        return seqEqual(computed, checksum);
    }
}
/**
 * XRP codec
 */
const createHash = require('create-hash');
const NODE_PUBLIC = 28;
// const NODE_PRIVATE = 32
const ACCOUNT_ID = 0;
const FAMILY_SEED = 0x21; // 33
const ED25519_SEED = [0x01, 0xE1, 0x4B]; // [1, 225, 75]
const codecOptions = {
    sha256: function (bytes) {
        return createHash('sha256').update(Buffer.from(bytes)).digest();
    },
    alphabet: 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz'
};
const codecWithXrpAlphabet = new Codec(codecOptions);
// entropy is an array (or Buffer?) of size 16
// type is 'ed25519' or 'secp256k1'
function encodeSeed(entropy, type) {
    if (entropy.length !== 16) {
        throw new Error('entropy must have length 16');
    }
    if (type !== 'ed25519' && type !== 'secp256k1') {
        throw new Error('type must be ed25519 or secp256k1');
    }
    const opts = {
        expectedLength: 16,
        // for secp256k1, use `FAMILY_SEED`
        versions: type === 'ed25519' ? ED25519_SEED : [FAMILY_SEED]
    };
    // prefixes entropy with version bytes
    return codecWithXrpAlphabet.encode(entropy, opts);
}
exports.encodeSeed = encodeSeed;
function decodeSeed(seed, opts = {}) {
    if (!opts.versionTypes || !opts.versions) {
        opts.versionTypes = ['ed25519', 'secp256k1'];
        opts.versions = [ED25519_SEED, FAMILY_SEED];
    }
    if (!opts.expectedLength) {
        opts.expectedLength = 16;
    }
    return codecWithXrpAlphabet.decode(seed, opts);
}
exports.decodeSeed = decodeSeed;
function encodeAccountID(bytes) {
    const opts = { versions: [ACCOUNT_ID], expectedLength: 20 };
    return codecWithXrpAlphabet.encode(bytes, opts);
}
exports.encodeAccountID = encodeAccountID;
function decodeAccountID(accountId) {
    const opts = { versions: [ACCOUNT_ID], expectedLength: 20 };
    return codecWithXrpAlphabet.decode(accountId, opts).bytes;
}
exports.decodeAccountID = decodeAccountID;
function decodeNodePublic(base58string) {
    const opts = { versions: [NODE_PUBLIC], expectedLength: 33 };
    return codecWithXrpAlphabet.decode(base58string, opts).bytes;
}
exports.decodeNodePublic = decodeNodePublic;
function encodeNodePublic(bytes) {
    const opts = { versions: [NODE_PUBLIC], expectedLength: 33 };
    return codecWithXrpAlphabet.encode(bytes, opts);
}
exports.encodeNodePublic = encodeNodePublic;
// Address === AccountID
function isValidAddress(address) {
    try {
        this.decodeAccountID(address);
    }
    catch (e) {
        return false;
    }
    return true;
}
exports.isValidAddress = isValidAddress;
//# sourceMappingURL=index.js.map