# Auuki API (Azure Functions)

The Auuki backend, implemented as the **managed API of the Azure Static Web App**
(`api_location: "api"` in the deploy workflow). Each endpoint the frontend calls
(`src/models/auth.js`, `strava.js`, `intervals.js`) maps to one HTTP-triggered
Azure Function under `/api/*`.

Because Static Web Apps serves the API on the **same origin** as the PWA, the
session cookie (`credentials: 'include'`) works without CORS or `SameSite=None`.

- Runtime: Node.js 20 (pinned via `platform.apiRuntime` in `staticwebapp.config.json`)
- Data store: Azure Cosmos DB (`@azure/cosmos`)
- Passwords: Node `crypto.scrypt` (no native dependencies)
- Sessions: HMAC-signed, HttpOnly cookie (`shared/session.js`)
- Bot protection: Cloudflare Turnstile (`shared/turnstile.js`)

## Implemented (Phase 1 — vertical slice)

| Endpoint        | Function    | Notes                                        |
| --------------- | ----------- | -------------------------------------------- |
| `POST /api/register` | `register` | create user                              |
| `POST /api/login`    | `login`    | verify creds, set session cookie         |
| `POST /api/logout`   | `logout`   | clear session cookie                     |
| `POST /api/rpc`      | `rpc`      | `status_handler` -> connected services   |

## Not yet implemented (Phase 2+)

`forgot-password`, `reset-password`, and the Strava / Intervals.icu /
TrainingPeaks OAuth code exchange, uploads, athlete, and events endpoints.

## Application settings

Set these in the Static Web App configuration (Portal: *Configuration* →
*Application settings*). For local development copy `local.settings.json.example`
to `local.settings.json` (git-ignored) and fill in values.

| Setting | Required | Description |
| --- | --- | --- |
| `COSMOS_ENDPOINT` + `COSMOS_KEY` | yes* | Cosmos account endpoint and key |
| `COSMOS_CONNECTION_STRING` | yes* | Alternative to endpoint + key |
| `COSMOS_DATABASE` | no | Database id (default `auuki`) |
| `COSMOS_USERS_CONTAINER` | no | Users container id (default `users`) |
| `SESSION_SECRET` | yes | Secret used to sign session cookies |
| `TURNSTILE_SECRET` | no | Cloudflare Turnstile secret; if unset, verification is skipped (dev) |
| `STRAVA_CLIENT_ID` | no | Surfaced to the client for the OAuth connect URL |
| `INTERVALS_CLIENT_ID` | no | Surfaced to the client for the OAuth connect URL |
| `TRAINING_PEAKS_CLIENT_ID` | no | Surfaced to the client for the OAuth connect URL |

\* Provide either `COSMOS_CONNECTION_STRING`, or both `COSMOS_ENDPOINT` and
`COSMOS_KEY`. The database and `users` container are created automatically on
first use (partition key `/id`, the normalized email).

## Local development

Use the Static Web Apps CLI so the static site and the API are served from one
origin (mirroring production, no CORS):

```bash
npm install                 # repo root, builds the PWA deps
npm --prefix api install    # API dependencies
npm run build               # produces dist/
swa start dist --api-location api
```

Then point the frontend at the local API by uncommenting the localhost URIs in
`src/models/config.js`, or rely on the SWA CLI proxy at `http://localhost:4280`.
