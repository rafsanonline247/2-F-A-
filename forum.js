/**
 * Lekhok 2FA Backend Integration Kit (Node.js)
 * RFC 6238 TOTP Implementation - Pure Node.js crypto (zero external npm packages!)
 */

const crypto = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

class Lekhok2FANode {
    static generateSecret(byteLength = 20) {
        const randomBytes = crypto.randomBytes(byteLength);
        let bits = '';
        for (let i = 0; i < randomBytes.length; i++) {
            bits += randomBytes[i].toString(2).padStart(8, '0');
        }
        let base32 = '';
        for (let i = 0; i < bits.length; i += 5) {
            const chunk = bits.substr(i, 5);
            if (chunk.length < 5) {
                base32 += BASE32_ALPHABET[parseInt(chunk.padEnd(5, '0'), 2)];
                break;
            }
            base32 += BASE32_ALPHABET[parseInt(chunk, 2)];
        }
        return base32.replace(/=/g, '');
    }

    static base32Decode(base32) {
        const cleaned = base32.replace(/[=\s-]/g, '').toUpperCase();
        let bits = '';
        for (let i = 0; i < cleaned.length; i++) {
            const val = BASE32_ALPHABET.indexOf(cleaned[i]);
            if (val === -1) throw new Error('Invalid Base32 character: ' + cleaned[i]);
            bits += val.toString(2).padStart(5, '0');
        }
        const bytes = [];
        for (let i = 0; i + 8 <= bits.length; i += 8) {
            bytes.push(parseInt(bits.substr(i, 8), 2));
        }
        return Buffer.from(bytes);
    }

    static getCode(secret, timestamp = Math.floor(Date.now() / 1000), period = 30, digits = 6) {
        const counter = Math.floor(timestamp / period);
        const buf = Buffer.alloc(8);
        buf.writeBigInt64BE(BigInt(counter));

        const key = this.base32Decode(secret);
        const hmac = crypto.createHmac('sha1', key);
        hmac.update(buf);
        const digest = hmac.digest();

        const offset = digest[digest.length - 1] & 0x0f;
        const binary = ((digest[offset] & 0x7f) << 24) |
                       ((digest[offset + 1] & 0xff) << 16) |
                       ((digest[offset + 2] & 0xff) << 8) |
                       (digest[offset + 3] & 0xff);

        const token = binary % Math.pow(10, digits);
        return token.toString().padStart(digits, '0');
    }

    static verifyCode(secret, userCode, discrepancy = 1, period = 30) {
        if (!Number.isInteger(discrepancy) || discrepancy < 0 || discrepancy > 2 || !Number.isInteger(period) || period < 15 || period > 120) return false;
        const currentEpoch = Math.floor(Date.now() / 1000);
        const cleanUserCode = (userCode || '').toString().replace(/\s+/g, '');

        if (!/^\d{6}$/.test(cleanUserCode)) return false;
        for (let i = -discrepancy; i <= discrepancy; i++) {
            const testEpoch = currentEpoch + (i * period);
            const validCode = this.getCode(secret, testEpoch, period);
            if (crypto.timingSafeEqual(Buffer.from(validCode), Buffer.from(cleanUserCode))) {
                return true;
            }
        }
        return false;
    }

    static getOtpAuthUri(issuer, account, secret) {
        const label = encodeURIComponent(`${issuer}:${account}`);
        return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    }

    static generateBackupCodes(count = 8) {
        const codes = [];
        for (let i = 0; i < count; i++) {
            codes.push(crypto.randomBytes(4).toString('hex'));
        }
        return codes;
    }
}

module.exports = Lekhok2FANode;
