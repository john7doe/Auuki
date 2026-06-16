'use strict';

const crypto = require('crypto');

// Password hashing using Node's built-in scrypt (no native dependencies).
// Stored format: "scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>".

const N = 16384; // CPU/memory cost
const r = 8;     // block size
const p = 1;     // parallelization
const KEYLEN = 64;
const SALT_BYTES = 16;

function scrypt(password, salt) {
    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, KEYLEN, { N, r, p }, (err, derivedKey) => {
            if (err) reject(err);
            else resolve(derivedKey);
        });
    });
}

async function hash(password) {
    const salt = crypto.randomBytes(SALT_BYTES);
    const derived = await scrypt(password, salt);
    return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

async function verify(password, stored) {
    if (typeof stored !== 'string') return false;
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

    const salt = Buffer.from(parts[4], 'hex');
    const expected = Buffer.from(parts[5], 'hex');
    const derived = await new Promise((resolve, reject) => {
        crypto.scrypt(
            password,
            salt,
            expected.length,
            { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]) },
            (err, dk) => (err ? reject(err) : resolve(dk)),
        );
    });

    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
}

module.exports = { hash, verify };
