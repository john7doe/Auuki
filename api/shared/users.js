'use strict';

const { usersContainer } = require('./cosmos');

// User repository. A user document looks like:
// {
//   id:           "<normalized email>",   // partition key + unique id
//   email:        "<normalized email>",
//   passwordHash: "scrypt$...",
//   createdAt:    "<iso>",
//   updatedAt:    "<iso>",
//   services: { strava: null, intervals: null, trainingPeaks: null }
// }

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

async function getByEmail(email) {
    const id = normalizeEmail(email);
    if (!id) return null;

    const container = await usersContainer();
    try {
        const { resource } = await container.item(id, id).read();
        return resource || null;
    } catch (e) {
        if (e && e.code === 404) return null;
        throw e;
    }
}

// Create a new user. Returns { created: true, user } or { created: false }
// when a user with that email already exists.
async function create(email, passwordHash) {
    const id = normalizeEmail(email);
    const now = new Date().toISOString();
    const doc = {
        id,
        email: id,
        passwordHash,
        createdAt: now,
        updatedAt: now,
        services: { strava: null, intervals: null, trainingPeaks: null },
    };

    const container = await usersContainer();
    try {
        const { resource } = await container.items.create(doc);
        return { created: true, user: resource };
    } catch (e) {
        if (e && e.code === 409) return { created: false };
        throw e;
    }
}

module.exports = { normalizeEmail, getByEmail, create };
