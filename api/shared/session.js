'use strict';

const crypto = require('crypto');
const { parseCookies } = require('./http');

// Stateless, HMAC-signed session token stored in an HttpOnly cookie.
// Token format: base64url(JSON payload) + "." + base64url(HMAC-SHA256).
// Payload: { uid, exp } where exp is a unix timestamp in seconds.

const COOKIE_NAME = 'session';
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret() {
    const s = process.env.SESSION_SECRET;
    if (!s) {
        throw new Error('SESSION_SECRET is not configured');
    }
    return s;
}

function b64urlEncode(buf) {
    return Buffer.from(buf)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function b64urlDecode(str) {
    const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
    return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(payloadB64) {
    return b64urlEncode(
        crypto.createHmac('sha256', secret()).update(payloadB64).digest(),
    );
}

// uid -> signed token string
function create(uid, ttlSeconds = DEFAULT_TTL_SECONDS) {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const payloadB64 = b64urlEncode(JSON.stringify({ uid, exp }));
    return `${payloadB64}.${sign(payloadB64)}`;
}

// token -> { uid, exp } | null
function read(token) {
    if (typeof token !== 'string' || token.indexOf('.') < 0) return null;
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return null;

    const expected = sign(payloadB64);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    let payload;
    try {
        payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8'));
    } catch (e) {
        return null;
    }
    if (!payload || !payload.uid || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
}

// Read and validate the session from a request. Returns { uid, exp } | null.
function fromRequest(req) {
    const token = parseCookies(req)[COOKIE_NAME];
    if (!token) return null;
    return read(token);
}

function cookieAttributes(maxAgeSeconds) {
    // Served same-origin under /api by Static Web Apps, so SameSite=Lax is
    // safe and survives OAuth top-level redirects back to the app.
    return [
        'Path=/',
        'HttpOnly',
        'Secure',
        'SameSite=Lax',
        `Max-Age=${maxAgeSeconds}`,
    ].join('; ');
}

// Set-Cookie value that establishes a session for uid.
function setCookie(uid, ttlSeconds = DEFAULT_TTL_SECONDS) {
    return `${COOKIE_NAME}=${create(uid, ttlSeconds)}; ${cookieAttributes(ttlSeconds)}`;
}

// Set-Cookie value that clears the session.
function clearCookie() {
    return `${COOKIE_NAME}=; ${cookieAttributes(0)}`;
}

module.exports = {
    COOKIE_NAME,
    create,
    read,
    fromRequest,
    setCookie,
    clearCookie,
};
