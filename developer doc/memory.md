# Future Atlas AI - Project Memory

Last verified: 2026-09-19 (Asia/Kolkata)

## Product

Future Atlas AI is a study-abroad planning application with five AI tools, a study-abroad mentor, Supabase authentication and account credits, a tenant API, controlled iframe embedding, consent analytics, and a Zoho guidance form.

User routes: `/`, `/countries`, `/universities`, `/scholarships`, `/cost-calculator`, `/eligibility`, `/guidance`, `/embed`.

API routes: `/api/ai`, `/api/account`, `/api/consent`, `/api/credits`, `/api/events`, `/api/v1/ai`, `/api/v1/health`, `/api/v1/openapi`, `/api/v1/tenants`.

Repository: https://github.com/B-Glaz/Future-Atlas-ai-tools.git

Production URL: https://future-atlas-ai-tools.onewindowvcard.workers.dev/

## Stack

- Next.js 16.3.4 App Router, React 19.2.4, TypeScript, Tailwind CSS 4.
- Supabase Auth/Postgres via `@supabase/supabase-js` 2.116 and `@supabase/ssr` 0.12.
- OpenAI SDK used only as a server-side client for OpenAI-compatible providers.
- NVIDIA Nemotron 3.5 Lightning is the currently verified local provider.
- Cloudflare Workers through OpenNext 1.20.6 and Wrangler 4.131.2.
- `custom-worker.mjs` is the Cloudflare entry point. Do not restore Next.js Node middleware.

## Current Behavior

Authentication is active for tool pages. The homepage remains explorable. Clicking a tool or the credit sign-in control opens `components/auth/AuthGate.tsx`.

Auth options:
- Google Identity Services button exchanging Google's ID token through Supabase `signInWithIdToken`.

Google-only authentication was verified locally and in production with `blessononewindow@gmail.com`. Google is enabled and Email is disabled in the active Supabase project.

Credits:
- 30 credits reset at Asia/Kolkata midnight.
- Tool generation costs 1 credit.
- Chat generation costs 0.25, 0.5, 0.75, or 1 credit.
- UI displays a whole-number remaining balance.
- Failed requests, history review, cache hits, duplicate reuse, and deterministic scope redirects cost zero.
- Signed-in balances use Supabase and persist across logout/login.
- Guest admission remains in-memory and is not suitable as durable high-volume abuse protection.

AI:
- Provider configuration is modular in `lib/ai/providers.ts`.
- Provider order, attempts, timeouts, circuit pause, response validation, in-flight deduplication, caching, and structured normalization are implemented.
- Provider clients are created at request time; missing secrets do not break builds.
- A single configured provider is attempted once. NVIDIA has a 120-second server timeout and the browser waits 125 seconds; this avoids the former duplicate 25-second retry and premature client abort. Typical observed NVIDIA latency is roughly 43-90 seconds, so a faster second provider is still desirable.
- The mentor only answers study-abroad topics. Clear unrelated prompts return the exact required redirect without invoking AI or charging credit.
- No live web search exists. Exact current fees, rankings, deadlines, visa rules, and scholarship amounts must be verified with official sources.

UI:
- Homepage design is preserved.
- Header logo links home; profile, delete, backup, and clear-history toolbar icons are absent.
- The right header area shows sign-in, live credits, zero, pending, or unavailable state.
- Logout uses a confirmation dialog with backup-and-sign-out, sign-out-without-backup, and cancel.
- Option sets over four choices use `4 -> More -> remaining options`, including Other where supported.
- Custom typo suggestions work; `Pharmcy` suggests `Pharmacy`.
- Tool layouts are centered and responsive.
- Results include contextual forum/guidance CTAs.
- Result history is device-side and reviewing it does not call AI.

Consent and analytics:
- Necessary and additional consent levels are implemented by `components/ConsentManager.tsx`.
- Reject explains that necessary storage is required; accept enables both levels; details explains both categories.
- Consent audit writes to `/api/consent`; events write to `/api/events`.
- Without `SUPABASE_SECRET_KEY`, these endpoints intentionally return 204 and do not persist.
- PageSense loads only for additional consent.
- Device history is account-scoped. Explicit backup uses `/api/account`; logout without backup does not upload it.

Guidance:
- `/guidance` renders the existing Zoho form directly in a styled page.
- The unreliable cross-origin loading overlay was removed because it could hide an already-loaded form forever.
- Fields were browser-tested for input. A real Zoho submission was not sent during testing.

Tenant API and embedding:
- `/api/v1/openapi` serves OpenAPI 3.1 documentation.
- `/api/v1/ai` requires a tenant key, exact approved Origin, and idempotency key.
- `/api/v1/tenants` requires a Supabase user session and manages tenant credentials/domains through database RPCs.
- `/embed` is denied by default. `custom-worker.mjs` applies per-request `frame-ancestors`; unauthorized direct access shows Access Restricted.
- The tenant API has not yet been end-to-end tested with a real `fa_test_` or `fa_live_` credential.

## Database

Active Supabase project ID: `qkxrzieifutndosqjzsh`. Treat deployment variables as source of truth; the older `nfcixmyfqhpenbocplaa` project is not used by the application.

Applied and live-verified on 2026-09-18:
- `supabase/migrations/20260917_future_atlas_user_credit_quarters.sql`
- `supabase/migrations/20260918_future_atlas_auth_consent.sql`

The migrations provide account/profile provisioning, quarter-credit accounting, Asia/Kolkata reset behavior, completion/status operations, consent logging, and account cleanup. Direct access to server-owned audit/event tables is revoked; server routes use the secret key.

Supabase leaked-password protection is a dashboard setting and remains **Needs Verification / Enable in dashboard**.

## Environment Variables

Never commit values. See `.env.example`.

- AI: `AI_ENABLED`, `AI_DISABLED_MODES`, `AI_PROVIDER_ORDER`, `AI_MAX_PROVIDER_ATTEMPTS`, generic `AI_*`, `NVIDIA_API_KEY`, `NVIDIA_MODEL`, optional OpenRouter/OpenAI/DeepSeek keys and models.
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, server-only `SUPABASE_SECRET_KEY`.
- Google Auth: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is public and compiled into the browser; keep the matching client secret only in Supabase Auth provider settings.
- Embed/security: `EMBED_ALLOWED_ORIGINS`, `SECURITY_ALERT_EMAIL`, `SECURITY_ALERT_WEBHOOK_URL`, `SECURITY_ALERT_COOLDOWN_SECONDS`.
- UI: `NEXT_PUBLIC_FORUM_URL`.
- Sentry is not configured locally. Inspection requires `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT`; never place the token in source.

## Deployment

Cloudflare config: `wrangler.jsonc` -> `custom-worker.mjs`; build command `npm run cf:build`; assets `.open-next/assets`.

Scripts:
- `npm run build`: normal Next.js production build.
- `npm run cf:build`: OpenNext build that generates `.open-next/worker.js`.
- `npm run preview`: build and Cloudflare preview.
- `npm run deploy`: build and OpenNext deploy.

Cloudflare must run an OpenNext-producing build before deployment. Do not run only `next build` and then expect `.open-next` to exist.

Current production deployment (2026-09-19):
- Worker: `future-atlas-ai-tools`
- Version: `2baecf27-3a63-4604-8e02-b9ee1865d178`
- URL: https://future-atlas-ai-tools.onewindowvcard.workers.dev/
- Bound secret names verified with Wrangler: `NVIDIA_API_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `SUPABASE_SECRET_KEY` is not bound. Auth works through the public Supabase configuration, but server-only event, consent, guidance persistence, account backup, and tenant administration remain limited until that secret is configured.

## Verification - 2026-09-19

Passed:
- `npm test` structured-output and provider-fallback contracts.
- `npm run lint`.
- `npm run build` with all application/API routes compiled.
- `npm run cf:build`; `.open-next/worker.js` generated.
- Browser: homepage, Google-only login, live credit counter, logout dialog, all five AI tools, eligibility mentor, mode dropdown, typo correction, exact unrelated-topic redirect, consent controls, native guidance form visibility/input, and denied `/embed`.
- API: health 200, malformed AI 400, unauthenticated credits/account/tenant management 401, missing tenant key 401, valid local event ingestion 204, OpenAPI 200.

Observed AI outputs were input-specific for countries, universities, scholarships, costs, and eligibility. University results did not repeat duplicate keys or invent exact rankings in the tested flow.

Production browser verification on 2026-09-19:
- Google login completed with `blessononewindow@gmail.com`.
- The header showed 30 credits after login.
- Country Explorer generated three input-specific results through NVIDIA.
- The balance changed from 30 to 29 only after the successful result. Two timed-out attempts consumed no credit.
- Email OTP, email magic-link, and local-password login UI/routes are absent.

Incomplete verification:
- Sentry query was blocked because Sentry credentials are not configured locally.
- Codex Security Deep Scan stopped with: `Your workspace is out of credits. Add credits to continue.` Coverage is incomplete; no successful findings manifest was returned.
- Real guidance submission, production event/consent persistence, tenant API key flow, tenant domain approval, and Asia/Kolkata midnight reset need controlled integration tests.

## Known Limits / Next Work

1. Add Cloudflare production secrets, especially `SUPABASE_SECRET_KEY`, then verify events and consent persistence.
2. Add a faster server-side AI provider/key as fallback; NVIDIA is reliable with the corrected timeout but remains slow.
3. Test tenant API and domain authorization with a real sandbox tenant key.
4. Replace guest in-memory throttling with shared durable storage before bulk anonymous traffic.
5. Configure Sentry variables and rerun error inspection; restore Codex Security credits and rerun the deep scan.
6. Re-run production persistence tests after binding `SUPABASE_SECRET_KEY`.

## Development Rules

- Keep AI keys and Supabase secret server-side.
- Never initialize provider clients at module evaluation when secrets may be absent during builds.
- Preserve stable API errors and request IDs.
- Do not add fake exact study-abroad facts.
- Preserve exact-origin tenant authorization and iframe CSP.
- Update this file after material architecture, deployment, auth, credit, provider, schema, or route changes.

## 2026-09-18 Auth and Guidance Update

- Email OTP and local password login were removed on 2026-09-19. Google Identity Services is the only active login flow.
- Added `app/api/guidance/route.ts`. It validates and stores native guidance form submissions server-side.
- Replaced the Zoho iframe UI with a native Future Atlas form in `components/ZohoGuidanceForm.tsx`. No submitted form data is stored in browser storage.
- Added and applied `supabase/migrations/20260918_future_atlas_guidance_otp.sql`.
- Verified live tables: `public.future_atlas_guidance_submissions` and `private.future_atlas_otp_rate_limits`. Submission count was 0 at verification time.

## Historical Live Deployment Audit - 2026-09-18

This section records the previous deployment state and is superseded by the 2026-09-19 deployment notes above.

Live URL tested: `https://future-atlas-ai-tools.onewindowvcard.workers.dev/`.

Passed live checks:
- Homepage and all user routes loaded.
- Navigation/header/home link and guidance route loaded.
- Native guidance fields, required-field browser validation, dropdown, responsive layout, and access-restricted `/embed`.
- OTP invalid-input validation returned 400.
- The former redirect-based Google OAuth implementation was replaced after this audit; current local verification confirms the Google Identity Services button renders, while a real account sign-in remains unverified.
- `/api/ai` malformed request returned 400.
- `/api/v1/openapi` returned 200.
- Protected credits/tenant routes returned 401 without credentials.

Production blocker confirmed:
- `/api/v1/health` returned 503 with `databaseConfigured:false`.
- A valid synthetic guidance request returned 503 because the deployed Worker does not have `SUPABASE_SECRET_KEY` configured.
- Configure Cloudflare Worker secrets/variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and server-only `SUPABASE_SECRET_KEY`. This cannot be fixed safely by source code or by exposing a secret in the browser.
