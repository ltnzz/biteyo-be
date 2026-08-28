import crypto from 'crypto';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Generate ID unik 10 karakter alfanumerik (nanoid style).
 * Contoh output: "k8x9d2m4p1", "7v9d3k1m4n"
 * - Tidak kepanjangan (bukan UUID 36 karakter dengan strip)
 * - Tidak kependekan / mudah ditebak (bukan auto-increment integer)
 */
export const generateBiteId = (length = 10) => {
    const bytes = crypto.randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
        result += ALPHABET[bytes[i] % ALPHABET.length];
    }
    return result;
};
