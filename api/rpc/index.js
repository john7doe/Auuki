'use strict';

const { json, readJsonBody } = require('../shared/http');
const session = require('../shared/session');
const users = require('../shared/users');

// Parse an OAuth client id from app settings; null when unset/non-numeric.
function clientId(name) {
    const raw = process.env[name];
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
}

// Build the status payload the frontend expects (see src/models/auth.js).
function statusResult(user) {
    const svc = (user && user.services) || {};
    return {
        services: {
            strava: clientId('STRAVA_CLIENT_ID'),
            intervals: clientId('INTERVALS_CLIENT_ID'),
            trainingPeaks: clientId('TRAINING_PEAKS_CLIENT_ID'),
        },
        strava: Boolean(svc.strava),
        intervals: Boolean(svc.intervals),
        trainingPeaks: Boolean(svc.trainingPeaks),
    };
}

async function statusHandler(context, req) {
    const sess = session.fromRequest(req);
    if (!sess) {
        context.res = json(403, { error: 'unauthorized' });
        return;
    }

    const user = await users.getByEmail(sess.uid);
    if (!user) {
        context.res = json(403, { error: 'unauthorized' });
        return;
    }

    context.res = json(200, { result: statusResult(user) });
}

// POST /api/rpc  body: { id, method, params }
// Minimal JSON-RPC-style dispatch. Currently supports: status_handler.
module.exports = async function (context, req) {
    const body = readJsonBody(req);
    const method = body && body.method;

    try {
        if (method === 'status_handler') {
            await statusHandler(context, req);
            return;
        }
        context.res = json(400, { error: 'unknown_method' });
    } catch (e) {
        context.log.error(':rpc :error', method, e);
        context.res = json(500, { error: 'server' });
    }
};
