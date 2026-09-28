# Future Atlas client API

Use this from your own server. Keep the API key in a secret store. Do not put it in browser code, a public JavaScript bundle, or a Git repository.

```text
FA_AI_API_KEY=FA_AiT_xxxxxxxxxxxxxxxxx
```

Base URL:

```text
https://future-atlas-ai-tools.onewindowvcard.workers.dev
```

A machine-readable copy of the same contract is at `GET /api/v1/openapi`.

## Authentication

API calls use one API key. They do not use an access token or a refresh token, and a successful API call does not mint either one.

Sign in on the Future Atlas site, open **API keys**, and create a key. The complete key is shown once and starts with `FA_AiT_`. After that, the server stores only a hash. If you lose the key, create a new one or replace the old one. Replacing revokes the previous key.

Send the key on every API request:

```http
X-API-Key: FA_AiT_xxxxxxxxxxxxxxxxxxxxxxxxx
```

```bash
curl https://future-atlas-ai-tools.onewindowvcard.workers.dev/api/v1/ai \
  -H "X-API-Key: FA_AiT_xxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json"
```

Website sign-in is separate. It still uses the Google session and its access and refresh tokens. Do not send those tokens to this API.

Create a key from a signed-in browser session:

```http
POST /api/api-keys
Authorization: Bearer <website session>
Content-Type: application/json

{ "name": "Production API", "expiresIn": "never" }
```

`expiresIn` is `never`, `30d`, `90d`, `1y`, or `custom`. A custom expiration also sends `expiresAt` as `YYYY-MM-DD`.

The response is `201` and includes `api_key` only this once:

```json
{
  "id": "...",
  "name": "Production API",
  "api_key": "FA_AiT_...",
  "key_prefix": "FA_AiT_7f83",
  "created_at": "2026-09-28T00:00:00.000Z",
  "expires_at": null,
  "permissions": ["ai:generate"]
}
```

`GET /api/api-keys` lists names, prefixes, dates, and status. It does not return the secret or the hash. `DELETE /api/api-keys` with `{ "id": "..." }` revokes a key immediately. A revoked or unknown key then returns `401` with `Invalid API key`. An expired key returns `401` with `API key expired`.

## Call the AI

```http
POST /api/v1/ai
X-API-Key: FA_AiT_...
Content-Type: application/json
Idempotency-Key: 7d54130d-9a9e-4a49-a660-91ca5b53d7a1
```

```json
{
  "mode": "country",
  "message": "Compare Canada and Germany for a pharmacy degree.",
  "inputs": {
    "course": "Pharmacy",
    "budget": "Medium"
  }
}
```

`mode` is one of:

| Mode | What it answers |
| --- | --- |
| `mentor` | Open study-abroad questions. Returns `response` as text. |
| `country` | Destinations |
| `university` | University matches |
| `scholarship` | Funding options |
| `cost` | Tuition and living costs |
| `eligibility` | Admission readiness |

`message` is required and must be 1 to 8,000 characters. `inputs` is an optional object of answers from your form. `history` is optional, up to 6 earlier turns, each with `role` of `user` or `model` and a `content` string.

For the tool modes, add `"responseFormat": "structured"` when you want a JSON object in `data` instead of a paragraph in `response`.

A completed text answer looks like this:

```json
{
  "response": "Canada and Germany are both realistic options...",
  "mode": "country",
  "personality": "Country Explorer",
  "cached": false,
  "creditsRemaining": 199,
  "requestId": "..."
}
```

A structured answer uses `data` instead of `response`. Every response includes `X-Request-ID`. Send that id when you report a failure.

### Streaming

Send `Accept: text/event-stream` or `"stream": true`. The body is server-sent events:

- `meta` — mode, personality, cached, requestId
- `delta` — `{ "text": "..." }` as text arrives
- `done` — the same JSON object as the normal response
- `error` — `{ "code", "message", "retryable" }`

### Retries

Send the same `Idempotency-Key` only when you retry the same request. The key must be 8 to 128 characters. A new question needs a new key. Reusing a key for a different body returns `409` with code `FA_IDEMPOTENCY_CONFLICT`. If the first call is still running, the same key returns `409` with code `AI_REQUEST_IN_PROGRESS` and `Retry-After: 2`. A completed call with the same key returns the saved result and the header `Idempotency-Replayed: true`.

## Limits

API calls allow **200 requests per Asia/Kolkata calendar day** and **10 requests per hour** for the account that owns the key. One API request can be in flight for an account at a time. These limits are separate from the 30 daily credits shown on the website. Each key is also limited to 30 requests per minute.

`creditsRemaining` on an API response is how many of the 200 daily API calls are left after this one.

Other limits:

| Route | Limit |
| --- | --- |
| `POST /api/v1/ai` | 30 requests per minute per API key, body up to 64,000 characters |
| `POST /api/api-keys` | 5 per minute |

A limit response is `429` and may include `Retry-After`.

## Errors

AI and health errors use this shape:

```json
{
  "error": {
    "code": "FA_INVALID_API_KEY",
    "message": "Invalid API key",
    "retryable": false,
    "requestId": "..."
  }
}
```

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Missing mode or message, or the message is too long |
| 400 | `INVALID_MODE` | `mode` is not one of the six values |
| 400 | `INVALID_RESPONSE_FORMAT` | `responseFormat` was sent and is not `structured` |
| 400 | `FA_INVALID_IDEMPOTENCY_KEY` | Key is shorter than 8 or longer than 128 characters |
| 401 | `FA_AUTH_REQUIRED` | `X-API-Key` is missing |
| 401 | `FA_INVALID_API_KEY` | Key is missing, unknown, or revoked |
| 401 | `FA_API_KEY_EXPIRED` | Key is expired |
| 403 | `FA_FORBIDDEN` | Key does not include `ai:generate` |
| 409 | `FA_IDEMPOTENCY_CONFLICT` | This key was already used for a different request |
| 409 | `AI_REQUEST_IN_PROGRESS` | The same key is still running |
| 413 | `REQUEST_TOO_LARGE` | Body is over 64,000 characters |
| 429 | `FA_API_DAILY_LIMIT` | 200 requests for this calendar day are used |
| 429 | `FA_API_HOURLY_LIMIT` | 10 requests this hour are used |
| 429 | `FA_USER_BUSY` | Another AI request for this account is still running |
| 502 | `AI_INVALID_RESPONSE` | The model reply could not be used. Retry is safe. |
| 503 | `AI_DISABLED` | The tool is turned off |
| 503 | `FA_SCHEMA_PENDING` | The account store is not ready |

Key management routes return `{ "error": "..." }`.

## Readiness

```http
GET /api/v1/health
```

`200` means `{ "status": "ready", "requestId": "..." }`. `503` means `{ "status": "degraded", "requestId": "..." }`. This check does not call the model and does not use your quota.
