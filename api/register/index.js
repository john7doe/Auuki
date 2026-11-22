'use strict';

const { json, readJsonBody } = require('../shared/http');
const turnstile = require('../shared/turnstile');
const password = require('../shared/password');
const users = require('../shared/users');

// POST /api/register
// body: { email, password, password_confirmation, cf-turnstile-response }
// -> { result: { success: true } } | { error }
module.exports = async function (context, req) {
    const data = readJsonBody(req);

    const email = String(data.email || '').trim();
    const pass = String(data.password || '');
    const confirm = String(data.password_confirmation || '');
    const token = data['cf-turnstile-response'];

    if (!email || !pass || !confirm || pass !== confirm) {
        context.res = json(200, { error: 'invalid' });
        return;
    }

    const remoteip = (req.headers && req.headers['x-forwarded-for']) || undefined;
    if (!(await turnstile.verify(token, remoteip))) {
        context.res = json(200, { error: 'turnstile' });
        return;
    }

    try {
        const passwordHash = await password.hash(pass);
        const result = await users.create(email, passwordHash);

        if (!result.created) {
            context.res = json(200, { error: 'exists' });
            return;
        }

        context.res = json(200, { result: { success: true } });
    } catch (e) {
        context.log.error(':register :error', e);
        context.res = json(500, { error: 'server' });
    }
};
