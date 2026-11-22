'use strict';

const { isIP } = require('node:net');

// Verify a Cloudflare Turnstile token against the siteverify endpoint.
// If TURNSTILE_SECRET is not configured (e.g. local dev), verification is
// skipped so the flow remains testable.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verify(token, remoteip) {
    const secret = process.env.TURNSTILE_SECRET;
    if (!secret) {
        // No secret configured: treat as a pass (dev/local convenience).
        return { success: true };
    }
    if (!token) return { success: false, codes: ['missing-input-response'] };

    const form = new URLSearchParams();
    form.append('secret', secret);
    form.append('response', token);
    const ip = String(remoteip || '').split(',')[0].trim();
    if (isIP(ip)) form.append('remoteip', ip);

    try {
        const res = await fetch(VERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: form.toString(),
        });
        const data = await res.json();
        if (res.ok && data?.success === true) return { success: true };

        const codes = Array.isArray(data?.['error-codes'])
            ? data['error-codes'].filter(code => typeof code === 'string')
            : ['internal-error'];
        console.error(':turnstile :verification-failed', res.status, codes);
        return { success: false, codes };
    } catch (e) {
        console.error(':turnstile :verification-request-failed', e.name);
        return { success: false, codes: ['internal-error'] };
    }
}

module.exports = { verify };
