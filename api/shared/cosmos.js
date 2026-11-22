'use strict';

const { CosmosClient } = require('@azure/cosmos');

// Lazily-created Cosmos client + container, cached across warm invocations.

let _client = null;
let _usersContainer = null;

function databaseId() {
    return process.env.COSMOS_DATABASE || 'auuki';
}

function usersContainerId() {
    return process.env.COSMOS_USERS_CONTAINER || 'users';
}

function client() {
    if (_client) return _client;

    const connectionString = process.env.COSMOS_CONNECTION_STRING;
    if (connectionString) {
        _client = new CosmosClient(connectionString);
        return _client;
    }

    const endpoint = process.env.COSMOS_ENDPOINT;
    const key = process.env.COSMOS_KEY;
    if (!endpoint || !key) {
        throw new Error(
            'Cosmos DB is not configured: set COSMOS_CONNECTION_STRING or COSMOS_ENDPOINT + COSMOS_KEY',
        );
    }
    _client = new CosmosClient({ endpoint, key });
    return _client;
}

// Returns the users container, creating the database/container on first use.
// Partition key is `/id` (the normalized email), giving O(1) point reads.
async function usersContainer() {
    if (_usersContainer) return _usersContainer;

    const { database } = await client().databases.createIfNotExists({
        id: databaseId(),
    });
    const { container } = await database.containers.createIfNotExists({
        id: usersContainerId(),
        partitionKey: { paths: ['/id'] },
    });

    _usersContainer = container;
    return _usersContainer;
}

module.exports = { client, usersContainer };
