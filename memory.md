# Future Atlas AI Memory

## Current State

- Project: Future Atlas AI tools, Next.js 16 app prepared for Cloudflare Workers through OpenNext.
- Do not commit, push, or deploy unless the user explicitly asks.
- Groq is removed from the active AI path. Current active provider is NVIDIA Nemotron 3.5 Lightning through server-only env vars.
- API keys must stay server-side. Do not expose secrets in client code or logs.
- Production still needs `SUPABASE_SECRET_KEY` added as a server-only Cloudflare secret for verified tenant-domain checks.

## Implemented

- Fixed AI result rendering by normalizing structured API responses before tool UI consumption.
- Kept AI calls backend-only with runtime provider initialization, validation, timeout handling, request IDs, safer logs, idempotency, and durable credit handling.
- Added public API foundation under `/api/v1/*`: AI, health, OpenAPI, and tenant management.
- Added tenant/API-key model with hashed `fa_test_` and `fa_live_` keys, quota checks, origin checks, idempotency, tenant/domain management, and audit records.
- Replaced unsupported Next.js middleware path with `custom-worker.mjs` for Cloudflare entrypoint and per-tenant iframe CSP `frame-ancestors`.
- Added Supabase migrations for tenant API, domain verification, request authorization/completion, indexes, and audit handling.
- Replaced the broken custom Zoho form with a native `ZohoGuidanceForm` embed so submissions land in Zoho reliably.
- Added/updated developer and API documentation.
- Removed dead fallback AI providers and kept only the verified provider path.

## Verification Completed

- `npm test` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm run cf:build` passed.
- `npx wrangler deploy --dry-run --outdir .open-next/dry-run` passed.
- Local smoke checks passed for `/`, `/guidance`, `/api/v1/health`, `/api/v1/openapi`, and unauthorized `/api/v1/ai`.
- Concurrent health smoke test: 200 requests returned 200.
- `npm audit` and production audit reported 0 vulnerabilities after lockfile update.
- Tracked secret scan found no exposed API key values.

## Known Notes

- Remaining Supabase advisor warnings are expected: private RLS tables without policies, intentional SECURITY DEFINER RPCs, and leaked password protection setting.
- Cloudflare dry-run still shows upstream bundle warnings about `=== -0`; these are not application code failures.
- `components/GuidanceForm.tsx` was deleted and replaced by `components/ZohoGuidanceForm.tsx`.
- `middleware.ts` is intentionally absent; iframe CSP is handled by `custom-worker.mjs`.

## Changed Files Snapshot

- Modified: `.env.example`, `API_DOCUMENTATION.md`, `DEVELOPER_DOCUMENTATION.md`, AI/API routes, tool components, guidance page, package files, ESLint config.
- Added: `/api/v1/health`, `components/ZohoGuidanceForm.tsx`, `lib/ai/structured-output.ts`, `scripts/check-structured-output.mjs`, `memory.md`.
- Deleted: `components/GuidanceForm.tsx`.
