'use strict';

const { json } = require('../shared/http');
const session = require('../shared/session');

// POST /api/logout -> clears the session cookie.
module.exports = async function (context, req) {
    context.res = json(
        200,
        { result: { success: true } },
        { 'Set-Cookie': session.clearCookie() },
    );
};
