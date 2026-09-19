# Future Atlas API v1

## Base URLs

Production base URL: `https://future-atlas-ai-tools.onewindowvcard.workers.dev/api/v1`.
Sandbox base URL: `https://future-atlas-ai-tools-sandbox.onewindowvcard.workers.dev/api/v1`.
Sandbox Supabase project: `winaoavaimwkozrlozfw` (`Future Atlas Sandbox`).
OpenAPI is available at `/api/v1/openapi`; provider-free readiness is `/api/v1/health`.
Sandbox and production use separate tenant records and `fa_test_` / `fa_live_` credentials, so test requests and usage never share a tenant identity with production.

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

List safe credential/domain metadata and current usage:

```http
GET /api/v1/tenants?tenantId=<tenant-id>
Authorization: Bearer <supabase-user-token>
```

## Generate

```http
POST /api/v1/ai
Authorization: Bearer fa_test_<secret>
Idempotency-Key: 7d54130d-9a9e-4a49-a660-91ca5b53d7a1
Origin: https://approved-client.example
Content-Type: application/json

{"mode":"country","message":"Recommend destinations","responseFormat":"structured","inputs":{"course":"Pharmacy","budget":"Medium"}}
```

Reuse an idempotency key only when retrying the same logical request.
The exact `Origin` must be registered and verified for the tenant. Server-to-server
clients must send their approved website origin explicitly; a missing origin is rejected.

## Domain and iframe

1. Register exact origin using action `registerDomain`.
2. Add returned TXT value at `_future-atlas.client.example`.
3. Call action `verifyDomain` with domain ID, origin, and verification token.
4. Embed `/embed?client=<tenant-public-id>`.

Iframe URL contains only a public tenant ID. Never place an API key in browser code.

Supported tenant actions are `create`, `issueCredential`, `revokeCredential`, `registerDomain`,
`verifyDomain`, `removeDomain`, and `setTenantStatus`. Suspending a tenant is the immediate kill switch.

## Limits

Default tenant quota: 500 requests per rolling 24 hours. Default concurrency: 5.
Requests require idempotency keys. `429` and `503` responses may include `Retry-After`.
All responses include `X-Request-ID`; keep it when reporting failures.

## Production configuration

Set `NVIDIA_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as Cloudflare variables/secrets.
Domain verification also requires server-only `SUPABASE_SECRET_KEY`.
Never prefix server secrets with `NEXT_PUBLIC_` or place tenant API keys in browser code.
