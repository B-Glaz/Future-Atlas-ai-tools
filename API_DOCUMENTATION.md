# Future Atlas API v1

## Base URLs

Sandbox and production use the deployment URL plus `/api/v1`. OpenAPI is available at `/api/v1/openapi`.
Use separate tenants and credentials. Never reuse sandbox student data or keys in production.

## Create tenant

Send a signed-in Supabase user access token:

```http
POST /api/v1/tenants
Authorization: Bearer <supabase-user-token>
Content-Type: application/json

{"action":"create","name":"Client One Sandbox","slug":"client-one-sandbox","environment":"sandbox"}
```

## Issue API key

```http
POST /api/v1/tenants
Authorization: Bearer <supabase-user-token>
Content-Type: application/json

{"action":"issueCredential","tenantId":"<tenant-id>","name":"Backend sandbox"}
```

Full `fa_test_...` or `fa_live_...` key returns once. Store it only in client backend secret manager.

## Generate

```http
POST /api/v1/ai
Authorization: Bearer fa_test_<secret>
Idempotency-Key: 7d54130d-9a9e-4a49-a660-91ca5b53d7a1
Content-Type: application/json

{"mode":"country","message":"Recommend destinations","responseFormat":"structured","inputs":{"course":"Pharmacy","budget":"Medium"}}
```

Reuse an idempotency key only when retrying the same logical request.

## Domain and iframe

1. Register exact origin using action `registerDomain`.
2. Add returned TXT value at `_future-atlas.client.example`.
3. Call action `verifyDomain` with domain ID, origin, and verification token.
4. Embed `/embed?client=<tenant-public-id>`.

Iframe URL contains only a public tenant ID. Never place an API key in browser code.

## Limits

Default tenant quota: 500 requests per rolling 24 hours. Default concurrency: 5.
Requests require idempotency keys. `429` and `503` responses may include `Retry-After`.
