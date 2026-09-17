# Future Atlas AI - Project Memory

Last updated: 2026-09-17
Project folder: `C:\Digital Manager\CODE\Future atlas AI tools`
Repository: `https://github.com/B-Glaz/Future-Atlas-ai-tools.git`

This file is the working handoff document for Future Atlas AI. Update it whenever major implementation, deployment, API, database, or UX behavior changes.

## 1. Project Overview

Future Atlas AI is a Next.js study-abroad planning product. It provides guided tools and an AI mentor for students exploring countries, universities, scholarships, costs, and admission eligibility.

Current objective:
- Keep the app usable by public visitors without login for now.
- Keep AI requests server-side only.
- Keep tenant/API-key infrastructure available for partners.
- Keep Cloudflare deployment compatible with OpenNext.
- Avoid fake-looking or repeated AI results by normalizing structured output and using conservative fallback data where needed.

Main user-facing pages:
- `/` - homepage/dashboard
- `/countries` - Country Explorer
- `/universities` - University Explorer
- `/scholarships` - Scholarship Explorer
- `/cost-calculator` - Cost Calculator
- `/eligibility` - Eligibility Checker
- `/guidance` - Zoho-hosted guidance form
- `/embed` - embeddable iframe entry point

## 2. Current Tech Stack

Verified from `package.json`:
- Next.js `16.3.4`
- React `19.2.4`
- TypeScript `^5`
- Tailwind CSS `^4`
- OpenNext Cloudflare adapter `@opennextjs/cloudflare ^1.20.6`
- Wrangler `^4.131.2`
- Supabase JS `2.57.4`
- OpenAI SDK `^7.13.0` used against NVIDIA's OpenAI-compatible endpoint
- `react-markdown` and `remark-gfm` for chat markdown
- `lucide-react` for icons

Runtime/deployment target:
- Cloudflare Workers through OpenNext
- Worker entrypoint: `custom-worker.mjs`
- Next middleware is intentionally not used because OpenNext/Cloudflare rejected Node.js middleware.

## 3. Important Scripts

From `package.json`:
- `npm run dev` -> `next dev --webpack`
- `npm run build` -> `next build`
- `npm run start` -> `next start`
- `npm run lint` -> `eslint`
- `npm test` -> `node --no-warnings --experimental-strip-types scripts/check-structured-output.mjs`
- `npm run cf:build` -> `opennextjs-cloudflare build`
- `npm run preview` -> `opennextjs-cloudflare build && opennextjs-cloudflare preview`
- `npm run deploy` -> `opennextjs-cloudflare build && opennextjs-cloudflare deploy`
- `npm run upload` -> `opennextjs-cloudflare build && opennextjs-cloudflare upload`

Do not commit, push, deploy, or change Cloudflare/Supabase production settings unless the user explicitly asks.

## 4. Current Project Structure

Verified source files:

```text
app/
  api/ai/route.ts
  api/v1/ai/route.ts
  api/v1/health/route.ts
  api/v1/openapi/route.ts
  api/v1/tenants/route.ts
  cost-calculator/page.tsx
  countries/page.tsx
  eligibility/page.tsx
  embed/page.tsx
  guidance/page.tsx
  layout.tsx
  page.tsx
  scholarships/page.tsx
  universities/page.tsx

components/
  ai/FutureAtlasAI.tsx
  ai/ResultLoading.tsx
  auth/AuthGate.tsx
  embed/AccessRestricted.tsx
  embed/EmbedApp.tsx
  ForumCTA.tsx
  FutureAtlasDashboard.tsx
  FutureAtlasHeader.tsx
  GuidanceCTA.tsx
  Tools/CostCalculator.tsx
  Tools/CountryExplorer.tsx
  Tools/CustomOptionInput.tsx
  Tools/EligibilityChecker.tsx
  Tools/ScholarshipExplorer.tsx
  Tools/UniversityExplorer.tsx
  ZohoGuidanceForm.tsx

lib/
  ai/cache-utils.ts
  ai/client-cache.ts
  ai/credits.ts
  ai/personalities.ts
  ai/providers.ts
  ai/request.ts
  ai/structured-output.ts
  ai/tool-flow.ts
  ai/types.ts
  notifications/security-alerts.ts
  progressive-options.ts
  security/embed-access.ts
  security/embed-utils.ts
  security/unauthorized-access.ts
  supabase.ts
  utils.ts

scripts/
  check-structured-output.mjs

root config:
  .env.example
  custom-worker.mjs
  next.config.ts
  open-next.config.ts
  wrangler.jsonc
  package.json
  tsconfig.json
  eslint.config.mjs
  memory.md
```

There is no local `supabase/` migrations folder currently present in the project directory. Supabase schema/RPC work may have been applied remotely earlier, but local migration files are not currently available in this checkout.

## 5. Website Status

Current UI intent:
- Homepage remains the main dashboard with tool cards.
- Header uses the Future Atlas logo and should route users home when clicked.
- Profile button was removed from the top navigation earlier.
- Tools support back navigation and progressive option disclosure.
- Global option rule: comparable choice groups with more than 4 items should show 4 primary options plus `More`; homepage should not use this pattern.
- `Other` option support exists through `CustomOptionInput.tsx` and related tool logic.
- Footer CTA remains, and contextual CTA components exist near result areas.
- Chatbot popup exists through `components/ai/FutureAtlasAI.tsx`.
- Chatbot should only answer study-abroad-related questions and redirect unrelated questions with the required message.

Recent browser-test status from local dev session:
- Homepage rendered.
- Tool cards opened tools.
- Login did not block tool usage.
- Country, University, Scholarship, Cost Calculator, and Eligibility flows reached result states during testing.
- Main chatbot opened and mode selector showed available tools.
- Unrelated chatbot question returned the required study-abroad-only redirect text.
- `/guidance` loaded the Zoho iframe after a delay and displayed form fields.
- No new console errors were observed after a clean scholarship retest; older console history may still contain stale errors from earlier sessions.

## 6. Authentication Status

Current state: login is intentionally disconnected temporarily.

Verified in `components/auth/AuthGate.tsx`:
- `AuthProvider` creates a mock user:
  - id: `mock-user`
  - email: `mock@futureatlas.com`
  - full name: `Mock User`
- `ProtectedTool` returns children directly and bypasses login enforcement.
- The OTP dialog code still exists but is not currently part of normal tool access.
- Supabase OTP methods are still present in the dialog for future restoration.

Verified in `lib/ai/request.ts`:
- Frontend AI requests no longer read Supabase session tokens.
- Frontend AI requests call `/api/ai` with:
  - `Content-Type: application/json`
  - `Idempotency-Key: crypto.randomUUID()`
- No API key or provider secret is sent from the browser.

Important consequence:
- Public users can use AI as guests.
- Tenant `/api/v1/ai` access still requires a valid `fa_test_` or `fa_live_` API key.
- Future production login/credits should replace the temporary guest-only path with durable user-linked credits.

## 7. AI Provider Status

Active provider:
- NVIDIA Nemotron 3.5 Lightning
- Default model: `nvidia/nemotron-3.5-lightning-30b-a3b`
- Configurable through `NVIDIA_MODEL`
- API key: `NVIDIA_API_KEY`
- Server-side only

Verified in `lib/ai/providers.ts`:
- Uses the OpenAI SDK with `baseURL: https://integrate.api.nvidia.com/v1`.
- Client is created inside request execution, not at module evaluation time.
- Timeout: `25_000ms` provider timeout.
- `maxRetries: 0`.
- Structured requests use `temperature: 0.2` and `response_format: { type: "json_object" }`.
- Chat requests use `temperature: 0.5`.
- `chat_template_kwargs: { enable_thinking: false }` is sent.

Deprecated/removed from active path:
- Groq is not used in the active AI route.
- Previous multi-provider/fallback API keys in `.env.local` are not part of the active verified provider path unless future work adds them again.

Known limitation:
- NVIDIA can still be slow or fail; the app has structured fallback handling for selected paths but does not guarantee live/latest facts.
- The app does not perform live web search.
- For current tuition, rankings, deadlines, visa amounts, and admission rules, responses should tell users to verify official sources.

## 8. Main AI API Flow

Route: `POST /api/ai`
File: `app/api/ai/route.ts`

Current verified behavior:
- `export const dynamic = "force-dynamic"`.
- Uses study-abroad-only routing instructions.
- Rejects clearly unrelated mentor questions with the required redirect message.
- Uses server-side response cache:
  - TTL: 24 hours
  - max entries: 250
- Uses in-flight request dedupe through global `pendingResponses`.
- Keeps chat history small:
  - max 6 messages
  - max 8000 history chars
- Token limits:
  - structured max tokens: 700
  - normal max tokens: 900
- Structured output is parsed, validated, normalized, cached, and returned.

Structured output normalization:
File: `lib/ai/structured-output.ts`

Current behavior:
- Deduplicates output items by name/title.
- Sanitizes invented exact rankings, tuition, scholarship deadlines, and amounts.
- Removes or softens likely fabricated intake labels.
- Injects cost result fields expected by the UI from user inputs when needed.
- Provides safer phrasing for official proof-of-funds, student-work rules, and provider-specific scholarship values.

Trusted deterministic fallback in `app/api/ai/route.ts`:
- Germany + Pharmacy/Pharmaceutical university requests return real conservative examples:
  - University of Bonn
  - Heidelberg University
  - LMU Munich
- Germany + Pharmacy cost requests return conservative budget guidance, including proof-of-funds wording and State Examination caveat.
- Scholarship provider failures can return safe scholarship search paths.
- Eligibility provider failures can return a generic but clearly non-guaranteed assessment.

## 9. Guest Credits / Rate Limiting

File: `lib/ai/credits.ts`

Current temporary guest behavior:
- If no Authorization header exists, request uses guest mode.
- Guest bucket key is based on:
  - `cf-connecting-ip`, or
  - first `x-forwarded-for` IP, or
  - `local`
- Guest daily limit: 20 requests per IP per 24 hours.
- Guest buckets are stored in memory on `globalThis`.
- Guest completion is not sent to Supabase RPC.

Tenant/user API behavior:
- If Authorization starts with `fa_`, it is treated as a tenant API key.
- Otherwise Authorization is treated as a Supabase user access token.
- Authenticated/tenant requests call Supabase RPC `future_atlas_authorize_request`.
- Completion calls RPC `future_atlas_complete_request`.

Known limitation:
- Guest limit is not durable across server restarts or multiple Worker instances.
- This is acceptable only as a temporary public-access buffer while login is disconnected.
- For bulk public users, move guest limits to Supabase, Cloudflare KV, D1, Durable Objects, or another shared store.

## 10. Public API / Tenant API

Routes:
- `POST /api/v1/ai`
- `GET /api/v1/health`
- `GET /api/v1/openapi`
- `GET /api/v1/tenants`
- `POST /api/v1/tenants`

`POST /api/v1/ai`:
- Requires Bearer token beginning with `fa_test_` or `fa_live_`.
- Requires `Idempotency-Key` length 8 to 128 characters.
- Delegates actual AI handling to `/api/ai` after tenant-key validation.

`GET /api/v1/health`:
- Returns `ready` only when both are configured:
  - Supabase public URL/key
  - NVIDIA API key and `AI_ENABLED !== "false"`
- Does not call the AI provider.

`GET /api/v1/openapi`:
- Returns OpenAPI 3.1 JSON document for the current environment.
- Server URL is `/api/v1`.
- Documents AI request shape, tenant management route, health route, and error response shape.

`/api/v1/tenants`:
- Requires Supabase Bearer user session.
- Supports listing tenants and tenant details.
- POST actions implemented:
  - `create`
  - `issueCredential`
  - `revokeCredential`
  - `registerDomain`
  - `removeDomain`
  - `setTenantStatus`
  - `verifyDomain`
- Domain verification checks TXT record via Cloudflare DNS-over-HTTPS.
- Marking a verified domain requires `SUPABASE_SECRET_KEY` through `createAdminSupabase()`.

## 11. Embed / Iframe Security

Files:
- `custom-worker.mjs`
- `next.config.ts`
- `app/embed/page.tsx`
- `components/embed/EmbedApp.tsx`
- `components/embed/AccessRestricted.tsx`
- `lib/security/*`

Current verified Cloudflare Worker behavior:
- `wrangler.jsonc` uses `main: "custom-worker.mjs"`.
- `custom-worker.mjs` imports `.open-next/worker.js`.
- It intercepts `/embed` responses and sets per-request CSP.
- Origin is determined from `Origin` or `Referer` headers.
- Static embed mode uses `EMBED_ALLOWED_ORIGINS`.
- Tenant embed mode uses `/embed?client=<uuid>` and Supabase RPC `future_atlas_authorize_embed`.
- If allowed, CSP is `frame-ancestors <origin>;`.
- If denied, CSP is `frame-ancestors 'none';`.
- Adds `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin` on `/embed`.

Current protected page headers in `next.config.ts`:
- `/`, `/countries/*`, `/universities/*`, `/scholarships/*`, `/cost-calculator/*`, `/eligibility/*` get:
  - `X-Frame-Options: SAMEORIGIN`
  - `Content-Security-Policy: frame-ancestors 'self';`

Important decision:
- `middleware.ts` is intentionally absent.
- Cloudflare/OpenNext previously failed with Node.js middleware, so iframe CSP is handled in `custom-worker.mjs`.

## 12. Supabase Status

Verified current code:
- `lib/supabase.ts` uses env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SECRET_KEY` for admin actions only
- It also contains fallback public Supabase URL/key values.
- Fallback project URL in code: `https://nfcixmyfqhpenbocplaa.supabase.co`
- The fallback publishable key is public-style, not a service secret, but relying on code fallback is less strict than env-only config.

Known Supabase RPCs referenced by code:
- `future_atlas_authorize_request`
- `future_atlas_complete_request`
- `future_atlas_authorize_embed`
- `future_atlas_list_tenants`
- `future_atlas_tenant_details`
- `future_atlas_create_tenant`
- `future_atlas_issue_credential`
- `future_atlas_revoke_credential`
- `future_atlas_register_domain`
- `future_atlas_remove_domain`
- `future_atlas_set_tenant_status`
- `future_atlas_can_verify_domain`
- `future_atlas_mark_domain_verified`

Unknown / Needs Verification:
- Current remote Supabase schema state was not queried during this memory update.
- No local `supabase/` migration folder exists in this checkout.
- Need verify all referenced RPCs exist in production before public API launch.
- Need verify RLS/policies and grants match the intended tenant/API model.

## 13. Environment Variables

From `.env.example` and current code. Do not expose secret values.

Required for AI:
- `NVIDIA_API_KEY` - server-only NVIDIA API key.
- `NVIDIA_MODEL` - optional, defaults to `nvidia/nemotron-3.5-lightning-30b-a3b`.
- `AI_ENABLED` - set `false` to disable AI globally.
- `AI_DISABLED_MODES` - optional comma-separated kill switch, e.g. `cost,scholarship`.

Required for Supabase-backed tenant/API behavior:
- `NEXT_PUBLIC_SUPABASE_URL` - public Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - public publishable key.
- `SUPABASE_SECRET_KEY` - server-only key required for verified tenant-domain activation/marking.

Optional UI/integration:
- `NEXT_PUBLIC_FORUM_URL` - forum/community destination; falls back to internal guidance page when absent.
- `EMBED_ALLOWED_ORIGINS` - comma-separated exact origins allowed to iframe `/embed` without tenant client id.
- `SECURITY_ALERT_EMAIL` - alert recipient metadata.
- `SECURITY_ALERT_WEBHOOK_URL` - webhook for unauthorized embed alerts.
- `SECURITY_ALERT_COOLDOWN_SECONDS` - defaults to 3600 seconds.

Cloudflare production requirement:
- Configure server-side secrets in Cloudflare, especially `NVIDIA_API_KEY` and `SUPABASE_SECRET_KEY`.
- Public vars still need to be available in the Worker runtime/build environment.

## 14. External Services / Integrations

NVIDIA:
- Active AI provider.
- Endpoint: `https://integrate.api.nvidia.com/v1`.
- Model default: `nvidia/nemotron-3.5-lightning-30b-a3b`.

Supabase:
- Auth code exists but login is currently bypassed.
- Tenant/API admission and completion RPCs are still used for API-key requests.
- Project URL fallback in code points to `nfcixmyfqhpenbocplaa`.

Cloudflare:
- Deployment target is Workers with OpenNext.
- Worker name in `wrangler.jsonc`: `future-atlas-ai`.
- Compatibility date: `2026-09-15`.
- Compatibility flags: `nodejs_compat`, `global_fetch_strictly_public`.
- Assets directory: `.open-next/assets`.
- Observability enabled with `head_sampling_rate: 1`.

Zoho Forms:
- Guidance form is embedded from:
  `https://forms.zohopublic.in/onewindow/form/StudyAbroadApplicationForm/formperma/jGJIp30LCf30UXhfAyzC82bep7S1ZSGZNrIfqN28bJ4`
- File: `components/ZohoGuidanceForm.tsx`.
- The app does not store Zoho form data client-side.

Zoho PageSense:
- `app/layout.tsx` loads PageSense script after interaction:
  `https://cdn-in.pagesense.io/js/onewindow/42f611b451ab4de4a126d343bc30d3d1.js`
- Uses Next.js `<Script id="pagesenseCode" strategy="afterInteractive" />`.

## 15. Deployment Status

Current verified local build status from recent work:
- `npm run build` passed after the latest fixes.
- Next.js version in build: `16.3.4`.
- Build routes included:
  - `/`
  - `/_not-found`
  - `/api/ai`
  - `/api/v1/ai`
  - `/api/v1/health`
  - `/api/v1/openapi`
  - `/api/v1/tenants`
  - `/cost-calculator`
  - `/countries`
  - `/eligibility`
  - `/embed`
  - `/guidance`
  - `/scholarships`
  - `/universities`

Previously verified, but not rerun during this memory update:
- `npm test` passed.
- `npm run lint` passed.
- `npm run cf:build` passed.
- `npx wrangler deploy --dry-run --outdir .open-next/dry-run` passed.
- Concurrent health smoke test returned 200 for 200 requests.
- `npm audit` previously reported 0 vulnerabilities after lockfile update.

Known deployment URLs:
- Prior chat/deployment reference: `https://future-atlas-ai.onewindowvcard.workers.dev/`
- Needs Verification: current production URL and latest Cloudflare deployment status.

## 16. Current Working Tree Status

Verified by `git status --short` during this update:

```text
 M AGENTS.md
 M app/api/ai/route.ts
 M components/Tools/CountryExplorer.tsx
 M components/Tools/EligibilityChecker.tsx
 M components/Tools/ScholarshipExplorer.tsx
 M components/Tools/UniversityExplorer.tsx
 M components/auth/AuthGate.tsx
 M lib/ai/credits.ts
 M lib/ai/request.ts
 M lib/ai/structured-output.ts
```

This memory update also modifies:
- `memory.md`

Do not assume these changes are committed. The user previously said they will commit/push manually.

## 17. Important Changes Already Made

AI/backend:
- Groq removed from active implementation.
- NVIDIA provider moved to request-time initialization so builds do not fail from missing env at module evaluation.
- AI route marked dynamic.
- Added request IDs, structured validation, cache, pending request dedupe, safer errors, and fallback paths.
- Added normalization to prevent duplicate cards and reduce fake exact facts.
- Frontend AI now uses guest access while login is disconnected.

UI/tools:
- Added/refined back behavior across tools.
- Fixed calculator layout jumping and loading DOM nesting issue.
- Added contextual loading animation via `ResultLoading`.
- Added/kept contextual forum/guidance CTA components.
- Added `Other` custom input support and typo-friendly input behavior.
- Added global progressive option rule for option groups, except homepage.
- Fixed duplicate React keys in result cards by including index in keys.

Cloudflare/embed/API:
- Deleted/removed `middleware.ts` path after Cloudflare/OpenNext rejected Node.js middleware.
- Added `custom-worker.mjs` as Cloudflare entrypoint to preserve iframe CSP security.
- Added tenant-aware public API routes under `/api/v1/*`.
- Added OpenAPI route.
- Added health route.
- Added tenant management route for credentials/domains.

Forms/integrations:
- Replaced custom broken Zoho-like form with native Zoho iframe embed.
- Added PageSense script in root layout.

## 18. Working Features

Currently expected to work locally:
- Homepage dashboard.
- Tool page access without login.
- Country Explorer flow.
- University Explorer flow.
- Scholarship Explorer flow.
- Cost Calculator flow.
- Eligibility Checker flow.
- Main AI chatbot popup.
- Mode dropdown in chatbot.
- Study-abroad-only redirect for unrelated chatbot questions.
- Zoho Guidance form iframe display.
- `/api/ai` guest AI requests with in-memory rate limit.
- `/api/v1/health` readiness check.
- `/api/v1/openapi` API document.
- `/api/v1/ai` initial tenant key/idempotency validation.
- `/embed` CSP handling when deployed through Cloudflare custom worker.

## 19. Non-Working / Disabled / Not Fully Verified

Disabled intentionally:
- Login/signup enforcement for tools.
- User-linked Supabase credit balance for normal UI usage.

Not fully verified in this update:
- Production Cloudflare deployment after latest local changes.
- Remote Supabase RPC/schema state.
- Tenant API end-to-end with real `fa_test_` or `fa_live_` key.
- Tenant domain verification end-to-end.
- Real Zoho form submission from the iframe.
- Actual PageSense event collection after deployment.
- Forum URL behavior when `NEXT_PUBLIC_FORUM_URL` is set.

Known technical limitations:
- Guest rate limit is in-memory and not durable.
- AI facts are model-generated unless deterministic fallback/normalization applies.
- No live web search is implemented.
- `lib/supabase.ts` contains fallback public Supabase config values; stricter production posture would require env-only behavior.
- External iframe form can be slow to load.

## 20. Pending Tasks / Next Steps

Highest priority:
1. Re-run full local verification after this memory update:
   - `npm test`
   - `npm run lint`
   - `npm run build`
   - `npm run cf:build`
2. Re-run Cloudflare dry-run after the latest guest/rate-limit/AI changes.
3. Verify production Cloudflare env vars/secrets are present.
4. Verify all Supabase RPCs used by the app exist in the remote project.
5. Test tenant API end-to-end with a sandbox API key.
6. Decide whether login remains disconnected or should be restored.
7. Replace in-memory guest credits with durable rate limiting before high-volume public traffic.

Useful cleanup:
- Remove or refactor fallback public Supabase values from `lib/supabase.ts` if strict env-only config is desired.
- Update `DEVELOPER_DOCUMENTATION.md`; it still describes protected tools/auth as if login is enforced, which is no longer current.
- Add local Supabase migration files or schema docs so the API/database layer is reproducible.
- Confirm exact production URL and add it here.

## 21. Business Logic / Prompt Rules

Core AI behavior:
- Stay focused on study-abroad guidance.
- Understand typos, abbreviations, and course-name variations.
- Ask one brief clarification question if ambiguous.
- Do not invent exact facts.
- Do not claim live/current information unless actually verified.
- Use official-source language for deadlines, tuition, rankings, visa amounts, and scholarship amounts.
- For unrelated questions, respond with:
  `I’m here to help with study-abroad-related questions only. Please ask me anything about studying abroad, universities, courses, applications, scholarships, visas, or other study-abroad-related topics.`

Tool modes:
- `mentor`
- `country`
- `university`
- `scholarship`
- `cost`
- `eligibility`

## 22. Notes For Future Developers

Read first:
1. `memory.md`
2. `app/api/ai/route.ts`
3. `lib/ai/providers.ts`
4. `lib/ai/credits.ts`
5. `lib/ai/structured-output.ts`
6. `components/auth/AuthGate.tsx`
7. `custom-worker.mjs`
8. `wrangler.jsonc`
9. `app/api/v1/openapi/route.ts`

Do not reintroduce:
- Build-time SDK/client initialization that requires secrets.
- Next.js Node middleware for Cloudflare/OpenNext.
- Client-side provider API keys.
- Fake exact university rankings, tuition, deadlines, or scholarship amounts.
- Login blocking until the user explicitly asks to reconnect login.

When adding AI providers:
- Keep provider keys server-side only.
- Initialize providers at request time.
- Keep timeouts and validation.
- Return stable errors with request IDs.
- Do not silently swallow empty or invalid provider responses.

When changing tenant/embed logic:
- Preserve exact-origin validation.
- Preserve per-request `frame-ancestors` CSP.
- Preserve API-key and idempotency validation for `/api/v1/ai`.
- Verify Cloudflare build after any worker/config change.