'use strict';

// Verify a Cloudflare Turnstile token against the siteverify endpoint.
// If TURNSTILE_SECRET is not configured (e.g. local dev), verification is
// skipped so the flow remains testable.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verify(token, remoteip) {
    const secret = process.env.TURNSTILE_SECRET;
    if (!secret) {
        // No secret configured: treat as a pass (dev/local convenience).
        return true;
    }
    if (!token) return false;

    const form = new URLSearchParams();
    form.append('secret', secret);
    form.append('response', token);
    if (remoteip) form.append('remoteip', remoteip);

    try {
        const res = await fetch(VERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: form.toString(),
        });
        const data = await res.json();
        return data && data.success === true;
    } catch (e) {
        return false;
    }
}

module.exports = { verify };
