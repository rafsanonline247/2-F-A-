/**
 * Lekhok 2FA Authenticator - Core Cryptographic Engine
 * RFC 6238 (TOTP) & RFC 4226 (HOTP) Implementation
 * Uses standard W3C Web Cryptography API (SubtleCrypto)
 * Fully compatible with Google Authenticator, Microsoft Authenticator, and Bitwarden
 */

const LekhokTOTP = (function () {
    const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    // Base32 Decoding
    function base32ToBytes(base32) {
        if (!base32) return new Uint8Array(0);
        const cleaned = base32.replace(/[=\s-]/g, '').toUpperCase();
        let bits = '';
        for (let i = 0; i < cleaned.length; i++) {
            const val = BASE32_ALPHABET.indexOf(cleaned[i]);
            if (val === -1) {
                throw new Error(`Invalid Base32 character: "${cleaned[i]}"`);
            }
            bits += val.toString(2).padStart(5, '0');
        }
        const bytes = [];
        for (let i = 0; i + 8 <= bits.length; i += 8) {
            bytes.push(parseInt(bits.substr(i, 8), 2));
        }
        return new Uint8Array(bytes);
    }

    // Base32 Encoding
    function bytesToBase32(bytes) {
        let bits = '';
        for (let i = 0; i < bytes.length; i++) {
            bits += bytes[i].toString(2).padStart(8, '0');
        }
        let base32 = '';
        for (let i = 0; i < bits.length; i += 5) {
            const chunk = bits.substr(i, 5);
            if (chunk.length < 5) {
                const paddedChunk = chunk.padEnd(5, '0');
                base32 += BASE32_ALPHABET[parseInt(paddedChunk, 2)];
                break;
            }
            base32 += BASE32_ALPHABET[parseInt(chunk, 2)];
        }
        while (base32.length % 8 !== 0) {
            base32 += '=';
        }
        return base32;
    }

    // Generate random secret key (e.g. 160 bits / 20 bytes standard)
    function generateSecret(byteLength = 20) {
        const randomBytes = new Uint8Array(byteLength);
        window.crypto.getRandomValues(randomBytes);
        return bytesToBase32(randomBytes).replace(/=/g, '');
    }

    // Convert Counter integer into 8-byte Big-Endian buffer
    function counterToBuffer(counter) {
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        // Split BigInt or 64-bit counter into two 32-bit words
        const high = Math.floor(counter / 0x100000000);
        const low = counter % 0x100000000;
        view.setUint32(0, high, false);
        view.setUint32(4, low, false);
        return new Uint8Array(buffer);
    }

    // Map algorithm name to WebCrypto standard
    function getHashAlgo(algo) {
        const normalized = (algo || 'SHA1').toUpperCase().replace('-', '');
        if (normalized === 'SHA256') return 'SHA-256';
        if (normalized === 'SHA512') return 'SHA-512';
        return 'SHA-1';
    }

    // Core RFC 4226 HOTP Token Generator
    async function generateHOTP(secretBase32, counter, digits = 6, algorithm = 'SHA-1') {
        const keyBytes = base32ToBytes(secretBase32);
        const hashAlgo = getHashAlgo(algorithm);

        const cryptoKey = await window.crypto.subtle.importKey(
            'raw',
            keyBytes,
            { name: 'HMAC', hash: { name: hashAlgo } },
            false,
            ['sign']
        );

        const counterBytes = counterToBuffer(counter);
        const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, counterBytes);
        const hmac = new Uint8Array(signature);

        // Dynamic Truncation
        const offset = hmac[hmac.length - 1] & 0x0f;
        const binary =
            ((hmac[offset] & 0x7f) << 24) |
            ((hmac[offset + 1] & 0xff) << 16) |
            ((hmac[offset + 2] & 0xff) << 8) |
            (hmac[offset + 3] & 0xff);

        const token = binary % Math.pow(10, digits);
        return token.toString().padStart(digits, '0');
    }

    // Core RFC 6238 TOTP Token Generator
    async function generateTOTP(secretBase32, options = {}) {
        const period = options.period || 30;
        const digits = options.digits || 6;
        const algorithm = options.algorithm || 'SHA-1';
        const timeOffset = options.timeOffset || 0; // In seconds (from NTP/server sync)

        const epochSeconds = Math.floor(Date.now() / 1000) + timeOffset;
        const counter = Math.floor(epochSeconds / period);
        const remainingSeconds = period - (epochSeconds % period);

        const code = await generateHOTP(secretBase32, counter, digits, algorithm);
        return {
            code,
            remainingSeconds,
            period,
            progressPercent: ((period - remainingSeconds) / period) * 100
        };
    }

    // Parse standard otpauth:// URI
    function parseOtpAuthUri(uri) {
        try {
            const url = new URL(uri);
            if (url.protocol !== 'otpauth:') {
                throw new Error('Not an otpauth URI');
            }

            const type = url.host.toLowerCase(); // 'totp' or 'hotp'
            let label = decodeURIComponent(url.pathname.substring(1));
            let issuer = '';
            let account = label;

            if (label.includes(':')) {
                const parts = label.split(':');
                issuer = parts[0].trim();
                account = parts.slice(1).join(':').trim();
            }

            const params = url.searchParams;
            const secret = (params.get('secret') || '').replace(/\s+/g, '').toUpperCase();
            if (!secret) throw new Error('Secret key is missing from URI');

            if (params.has('issuer')) {
                issuer = params.get('issuer');
            }

            const algorithm = (params.get('algorithm') || 'SHA1').toUpperCase();
            const digits = parseInt(params.get('digits') || '6', 10);
            const period = parseInt(params.get('period') || '30', 10);
            const counter = parseInt(params.get('counter') || '0', 10);

            return {
                type,
                issuer: issuer || 'Custom Service',
                account: account || 'User',
                secret,
                algorithm,
                digits,
                period,
                counter
            };
        } catch (err) {
            throw new Error('Failed to parse 2FA QR code: ' + err.message);
        }
    }

    // Generate standard otpauth:// URI
    function generateOtpAuthUri(item) {
        const type = (item.type || 'totp').toLowerCase();
        const label = encodeURIComponent(item.issuer ? `${item.issuer}:${item.account}` : item.account);
        let uri = `otpauth://${type}/${label}?secret=${item.secret}&issuer=${encodeURIComponent(item.issuer || '')}`;
        if (item.algorithm && item.algorithm !== 'SHA1') uri += `&algorithm=${item.algorithm}`;
        if (item.digits && item.digits !== 6) uri += `&digits=${item.digits}`;
        if (item.period && item.period !== 30) uri += `&period=${item.period}`;
        if (type === 'hotp') uri += `&counter=${item.counter || 0}`;
        return uri;
    }

    // Format 6-digit code with readable space (e.g., "123 456")
    function formatCode(code) {
        if (!code) return '';
        if (code.length === 6) {
            return `${code.slice(0, 3)} ${code.slice(3)}`;
        } else if (code.length === 8) {
            return `${code.slice(0, 4)} ${code.slice(4)}`;
        }
        return code;
    }

    // AES-GCM-256 Vault Encryption for local storage & backup export
    async function deriveKey(password, salt) {
        const enc = new TextEncoder();
        const baseKey = await window.crypto.subtle.importKey(
            'raw',
            enc.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        return await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            baseKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async function encryptData(plainText, password) {
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKey(password, salt);
        const encoded = new TextEncoder().encode(plainText);

        const cipherBuffer = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encoded
        );

        return {
            cipherText: btoa(String.fromCharCode(...new Uint8Array(cipherBuffer))),
            salt: btoa(String.fromCharCode(...salt)),
            iv: btoa(String.fromCharCode(...iv)),
            version: 1
        };
    }

    async function decryptData(encryptedObj, password) {
        const salt = new Uint8Array(atob(encryptedObj.salt).split('').map(c => c.charCodeAt(0)));
        const iv = new Uint8Array(atob(encryptedObj.iv).split('').map(c => c.charCodeAt(0)));
        const cipherBytes = new Uint8Array(atob(encryptedObj.cipherText).split('').map(c => c.charCodeAt(0)));

        const key = await deriveKey(password, salt);
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            cipherBytes
        );

        return new TextDecoder().decode(decryptedBuffer);
    }

    return {
        base32ToBytes,
        bytesToBase32,
        generateSecret,
        generateHOTP,
        generateTOTP,
        parseOtpAuthUri,
        generateOtpAuthUri,
        formatCode,
        encryptData,
        decryptData
    };
})();
