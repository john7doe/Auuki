'use strict';

const { json, readJsonBody } = require('../shared/http');
const turnstile = require('../shared/turnstile');
const password = require('../shared/password');
const users = require('../shared/users');
const session = require('../shared/session');

// POST /api/login
// body: { email, password, cf-turnstile-response }
// -> 200 { result: { success: true } } + Set-Cookie session | { error }
module.exports = async function (context, req) {
    const data = readJsonBody(req);

    const email = String(data.email || '').trim();
    const pass = String(data.password || '');
    const token = data['cf-turnstile-response'];

    if (!email || !pass) {
        context.res = json(200, { error: 'invalid' });
        return;
    }

    const remoteip = (req.headers && req.headers['x-forwarded-for']) || undefined;
    if (!(await turnstile.verify(token, remoteip))) {
        context.res = json(200, { error: 'turnstile' });
        return;
    }

    try {
        const user = await users.getByEmail(email);
        const ok = user && (await password.verify(pass, user.passwordHash));

        if (!ok) {
            context.res = json(200, { error: 'invalid' });
            return;
        }

        context.res = json(
            200,
            { result: { success: true } },
            { 'Set-Cookie': session.setCookie(user.id) },
        );
    } catch (e) {
        context.log.error(':login :error', e);
        context.res = json(500, { error: 'server' });
    }
};
