'use strict';

// Small HTTP helpers shared by all functions.

// Build a JSON HTTP response for the Functions `res` output binding.
// Extra headers (e.g. Set-Cookie) can be merged in.
function json(status, body, headers = {}) {
    return {
        status,
        headers: Object.assign(
            { 'Content-Type': 'application/json' },
            headers,
        ),
        body: JSON.stringify(body),
    };
}

// Parse the request body into an object regardless of whether the
// Functions host already deserialized it (req.body can be a string or object).
function readJsonBody(req) {
    const body = req && req.body;
    if (body == null) return {};
    if (typeof body === 'object') return body;
    try {
        return JSON.parse(body);
    } catch (e) {
        return {};
    }
}

// Parse the Cookie request header into a { name: value } map.
function parseCookies(req) {
    const header = (req && req.headers && req.headers.cookie) || '';
    const out = {};
    header.split(';').forEach((part) => {
        const idx = part.indexOf('=');
        if (idx < 0) return;
        const name = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (name) out[name] = decodeURIComponent(value);
    });
    return out;
}

module.exports = { json, readJsonBody, parseCookies };
