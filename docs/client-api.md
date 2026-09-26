# Future Atlas client API

Use this from your own server. Keep the access token in a secret store. Do not put it in browser code, a mobile app binary, or a public page.

Base URL:

```text
https://future-atlas-ai-tools.onewindowvcard.workers.dev
```

A machine-readable copy of the same contract is at `GET /api/v1/openapi`.

## 1. Get a token

Sign in on the Future Atlas site, open **Tokens**, and generate a pair. Generating a new pair revokes the previous pair for that account.

You can also create the pair from a signed-in browser session:

```http
POST /api/tokens
```

The response is `201`:

```json
{
  "access_token": "fa_atk_...",
  "refresh_token": "fa_rtk_...",
  "access_expires_at": "2026-09-26T16:00:00.000Z",
  "refresh_expires_at": "2026-10-26T15:00:00.000Z"
}
```

| Token | Prefix | Lifetime | Use |
| --- | --- | --- | --- |
| Access token | `fa_atk_` | 1 hour | `Authorization: Bearer` on AI calls |
| Refresh token | `fa_rtk_` | 30 days | Mint a new access token |

The access token and refresh token are shown once. Store both.

## 2. Call the AI

```http
POST /api/v1/ai
Authorization: Bearer fa_atk_...
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

## 3. Refresh the access token

```http
POST /api/tokens/refresh
Content-Type: application/json

{ "refreshToken": "fa_rtk_..." }
```

A valid refresh token returns a new access token. The refresh token itself stays the same until it expires or you generate a new pair.

```json
{
  "access_token": "fa_atk_...",
  "access_expires_at": "2026-09-26T17:00:00.000Z"
}
```

## 4. Check a token

```http
POST /api/tokens/validate
Content-Type: application/json

{ "token": "fa_atk_..." }
```

You can also send the token as `Authorization: Bearer`.

A usable token returns:

```json
{ "valid": true, "token_type": "access", "expires_at": "2026-09-26T16:00:00.000Z" }
```

Anything else returns `{ "valid": false }`.

Signed-in status, without revealing the secret, is `GET /api/tokens`.

## 5. Revoke

```http
DELETE /api/tokens
Content-Type: application/json

{ "accessToken": "fa_atk_...", "refreshToken": "fa_rtk_..." }
```

To revoke every token for the signed-in account, send `{ "all": true }` with the website session. The response is `{ "revoked": true }`.

## Limits

API calls allow **200 requests per Asia/Kolkata calendar day** and **10 requests per hour**. One request can be in flight for an account at a time. These limits are separate from the 30 daily credits shown on the website.

`creditsRemaining` on an API response is how many of the 200 daily API calls are left after this one.

Other limits:

| Route | Limit |
| --- | --- |
| `POST /api/v1/ai` | 30 requests per minute, body up to 64,000 characters |
| `POST /api/tokens` | 5 per minute |
| `POST /api/tokens/refresh` | 10 per minute |
| `POST /api/tokens/validate` | 20 per minute |

A limit response is `429` and may include `Retry-After`.

## Errors

AI and health errors use this shape:

```json
{
  "error": {
    "code": "FA_INVALID_API_KEY",
    "message": "Invalid or expired API key.",
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
| 401 | `FA_INVALID_API_KEY` | Access token is missing, expired, revoked, or not an `fa_atk_` token |
| 401 | `FA_AUTH_REQUIRED` | No access token |
| 409 | `FA_IDEMPOTENCY_CONFLICT` | This key was already used for a different request |
| 409 | `AI_REQUEST_IN_PROGRESS` | The same key is still running |
| 413 | `REQUEST_TOO_LARGE` | Body is over 64,000 characters |
| 429 | `FA_API_DAILY_LIMIT` | 200 requests for this calendar day are used |
| 429 | `FA_API_HOURLY_LIMIT` | 10 requests this hour are used |
| 429 | `FA_USER_BUSY` | Another AI request for this account is still running |
| 502 | `AI_INVALID_RESPONSE` | The model reply could not be used. Retry is safe. |
| 503 | `AI_DISABLED` | The tool is turned off |
| 503 | `FA_SCHEMA_PENDING` | The account store is not ready |

Token routes that are not the AI call return a simpler body: `{ "error": "..." }`.

## Readiness

```http
GET /api/v1/health
```

`200` means `{ "status": "ready", "requestId": "..." }`. `503` means `{ "status": "degraded", "requestId": "..." }`. This check does not call the model and does not use your quota.
