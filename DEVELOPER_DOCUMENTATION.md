# Future Atlas AI Tools — Developer Documentation

## Overview

Future Atlas is a Next.js 16 (App Router) application that provides AI-powered study-abroad planning tools. Students answer guided questions and receive personalized recommendations for countries, universities, scholarships, cost estimates, and eligibility assessments. The application includes an embeddable version for partner websites and a conversational AI mentor.

**Tech Stack**
- **Framework**: Next.js 16.3.4 (App Router, React 19, Turbopack)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 4, shadcn-style UI components
- **Auth**: Supabase (magic-link OTP, Row Level Security)
- **AI**: NVIDIA-hosted models (Nemotron 3.5 Lightning, Gemma 4, Mistral Nemotron) via OpenAI-compatible API
- **Deployment**: Vercel/Cloudflare Workers compatible

---

## Project Structure

```
future-atlas-ai-tools/
├── app/                          # Next.js App Router pages & API routes
│   ├── api/ai/route.ts          # Main AI endpoint (credits, caching, hedged providers)
│   ├── countries/page.tsx       # Country Explorer tool
│   ├── universities/page.tsx    # University Explorer tool
│   ├── scholarships/page.tsx    # Scholarship Explorer tool
│   ├── cost-calculator/page.tsx # Cost Calculator tool
│   ├── eligibility/page.tsx     # Eligibility Checker tool
│   ├── guidance/page.tsx        # Lead capture form (Zoho)
│   ├── embed/page.tsx           # Embeddable entry point (origin-validated)
│   ├── layout.tsx               # Root layout (fonts, auth provider, analytics)
│   ├── page.tsx                 # Homepage (dashboard with 5 tool cards)
│   └── globals.css              # Tailwind + custom styles
├── components/
│   ├── ai/
│   │   ├── FutureAtlasAI.tsx    # Conversational AI chat (7 modes)
│   │   └── ResultLoading.tsx    # Animated loading messages
│   ├── auth/
│   │   └── AuthGate.tsx         # AuthProvider, ProtectedTool, OTP dialog
│   ├── embed/
│   │   ├── EmbedApp.tsx         # Embeddable tool selector + iframe tools
│   │   └── AccessRestricted.tsx # Unauthorized embed fallback
│   ├── Tools/
│   │   ├── CountryExplorer.tsx  # 3-step country recommendation flow
│   │   ├── UniversityExplorer.tsx # 3-step university matching flow
│   │   ├── ScholarshipExplorer.tsx # 3-step scholarship matching flow
│   │   ├── CostCalculator.tsx   # 4-step cost estimation flow
│   │   ├── EligibilityChecker.tsx # 5-step eligibility assessment flow
│   │   └── CustomOptionInput.tsx # Validated free-text input for "Other"
│   ├── ui/                      # shadcn-style primitives (button, input, dialog, etc.)
│   ├── ForumCTA.tsx             # Community forum link (context-aware copy)
│   ├── FutureAtlasHeader.tsx    # Top nav with back button + home link
│   ├── FutureAtlasDashboard.tsx # Homepage hero + 5 tool cards + AI CTA
│   ├── GuidanceForm.tsx         # Zoho form with client-side validation
│   └── GuidanceCTA.tsx          # "Get Personalized Guidance" link
├── lib/
│   ├── ai/
│   │   ├── request.ts           # Client-side AI fetch wrapper (auth + error handling)
│   │   ├── providers.ts         # Hedged multi-provider NVIDIA routing
│   │   ├── personalities.ts     # System prompts per AI mode
│   │   ├── credits.ts           # Supabase credit consumption (30/day, 2s cooldown)
│   │   ├── client-cache.ts      # In-memory LRU cache (10-min TTL)
│   │   ├── types.ts             # AIMode type definition
│   │   └── ui-actions.ts        # (empty, reserved for server actions)
│   ├── security/
│   │   ├── embed-access.ts      # Origin/referer validation for embed
│   │   └── unauthorized-access.ts # Security event logging + alerting
│   ├── notifications/
│   │   └── security-alerts.ts   # Webhook/email alerts with cooldown
│   ├── progressive-options.ts   # "More" button logic for option grids
│   ├── supabase.ts              # Supabase client (browser + server helpers)
│   └── utils.ts                 # (utility helpers)
├── aicalls/                     # Example scripts for various AI providers
├── public/                      # Static assets (SVGs, favicon)
├── .env.example                 # Environment variable template
├── next.config.ts               # CSP headers, embed frame-ancestors
├── tsconfig.json                # TypeScript config (paths @/* -> ./*)
├── package.json                 # Dependencies & scripts
└── AGENTS.md                    # Agent rules (Next.js 16 specifics)
```

---

## Application Flow

### 1. Homepage (`/`)
- **Component**: `FutureAtlasDashboard`
- Shows hero section + 5 tool cards (Countries, Universities, Scholarships, Cost Calculator, Eligibility)
- Each card button calls `requireAuth(toolPath)` → opens OTP dialog if unauthenticated, otherwise navigates
- Bottom section: AI Mentor CTA (opens `FutureAtlasAI` modal in "mentor" mode) + GuidanceCTA link to `/guidance`

### 2. Tool Pages (Protected)
All tool pages use the same pattern:
```
page.tsx → ProtectedTool → ToolComponent + GuidanceCTA
```
- `ProtectedTool` checks auth state; shows skeleton while loading; prompts sign-in if unauthenticated
- Each tool is a multi-step guided flow (3–5 steps) with progressive option disclosure (show 4, "More" expands)
- User selections stored in local component state
- On final step: `generateResults()` calls AI via `requestAI()` with structured prompt
- Results cached client-side (10 min) and server-side (24 hr)
- Results displayed as cards with match scores, tags, highlights
- Footer: `ForumCTA` with context-aware copy

### 3. AI Chat (`FutureAtlasAI`)
- **Modes**: `mentor` (default), `country`, `university`, `scholarship`, `cost`, `eligibility`
- Stateful chat with markdown rendering (ReactMarkdown + remark-gfm)
- Suggestions shown on first message
- Mode selector dropdown in header
- Client-side cache lookup before server request
- Streaming-like loading animation with rotating messages
- Embedded mode (`embedded=true`) for iframe usage

### 4. Embed Flow (`/embed`)
- **Entry**: `app/embed/page.tsx` runs `evaluateEmbedAccess(headers)` server-side
- Validates `Origin` and `Referer` headers against `EMBED_ALLOWED_ORIGINS`
- If denied: logs security event, returns `AccessRestricted` component
- If allowed: renders `EmbedApp` (client-side tool selector + iframe-mounted tools)
- Tools navigate via `router.push(/embed?tool=...)` to stay in iframe
- AI Mentor available in embed mode

### 5. Guidance Form (`/guidance`)
- Client-side validated form (name, email, mobile, education, preferences)
- Submits to Zoho Forms endpoint via hidden iframe (no page redirect)
- Shows success message on submit

---

## Authentication System

### Supabase Setup
- **Table**: `future_atlas_profiles` (user_id, email, full_name, updated_at)
- **Table**: `future_atlas_ai_usage` (user_id, request_id, mode, used_at)
- **RLS**: Policies restrict access to own rows
- **Auth**: Magic-link OTP (email + optional name), auto-creates user + profile

### AuthGate (`components/auth/AuthGate.tsx`)
- `AuthProvider`: Wraps app, manages `user`, `loading`, `requireAuth(path?)`
- `useAuth()`: Hook to access context
- `ProtectedTool`: Wrapper that shows skeleton → sign-in prompt → children
- `AuthDialog`: Two-step modal (email → OTP verification)
  - Step 1: Collect name + email → `signInWithOtp(shouldCreateUser: true)`
  - Step 2: Verify OTP → upsert profile → `onVerified()` → redirect to destination

### Session Persistence
- Supabase handles session refresh automatically
- `onAuthStateChange` updates local user state
- No custom token storage needed

---

## AI System Architecture

### Provider Routing (`lib/ai/providers.ts`)
```typescript
// Three NVIDIA-hosted models with staggered delays for hedging
1. Nemotron 3.5 Lightning (primary, 0ms delay)
2. Gemma 4 31B (fallback 1, 4.5s delay)
3. Mistral Nemotron (fallback 2, 7s delay)

Promise.any() races all three; first valid response wins
Others aborted via AbortController
```
- **Timeout**: 25s per provider
- **Validation**: Structured mode requires valid JSON; normal mode requires non-empty
- **Temperature**: 0.2 (structured) / 0.5 (chat)
- **Max tokens**: 700 (structured) / 900 (chat)

### Server Route (`app/api/ai/route.ts`)
**Request flow:**
1. Parse body: `{ mode, message, inputs?, responseFormat?, history? }`
2. Validate: mode exists, message ≤ 8000 chars
3. **Fast rejection**: Mentor mode checks for unrelated keywords (crypto, weather, etc.)
4. **Consume credit**: `consumeCredit(request, mode)` → inserts usage row, returns remaining
5. **Prepare history**: Chat mode keeps last 6 messages (≤8000 chars); structured mode sends none
6. **Build messages**: System prompt (personality + routing instructions + structured schema) + history + user message
7. **Cache key**: Stable hash of `{ mode, responseFormat, messages }`
8. **Cache lookup**: Global in-memory Map (24hr TTL, 250 entries max, LRU eviction)
9. **In-flight dedup**: `pendingResponses` Map prevents duplicate simultaneous requests
10. **Hedged request**: `requestAI()` from providers.ts
11. **Cache write**: Store response on success
12. **Return**: Structured → `{ data: parsedJson, creditsRemaining }` | Chat → `{ response, creditsRemaining }`

### Client Request (`lib/ai/request.ts`)
- Adds `Authorization: Bearer <supabase_access_token>` header
- 55s timeout (AbortController)
- Handles auth errors, rate limits, timeouts, generic errors
- Returns typed response or throws `AIRequestError`

### Client Cache (`lib/ai/client-cache.ts`)
- In-memory Map with 10-min TTL
- Key: `future-atlas-ai-response:<hash>`
- Used by tool components for instant repeat results
- Cleared on "Clear Selection" or new session

### Personalities (`lib/ai/personalities.ts`)
Each mode has:
- `name`: Display label
- `role`: Internal role description
- `systemPrompt`: Detailed instructions including:
  - Scope boundaries (study-abroad only)
  - Response structure guidelines
  - Fact-accuracy rules (no invented rankings, fees, deadlines)
  - Escalation to official sources

### Structured Prompts (`app/api/ai/route.ts` → `structuredPrompts`)
Each tool mode has a strict JSON schema:
- **country**: 3 countries with name, code, score (70-98), description (2 sentences), tags[3]
- **university**: 3 universities with name, shortName, country, location, ranking, tuition, match (70-98), type, highlights[3]
- **scholarship**: 3 scholarships with name, provider, country, amount, coverage, deadline, match (70-98), type, tags[3]
- **eligibility**: score (0-98), status, summary, breakdown[3] (title, status: positive/caution, description), nextSteps[3]
- **cost**: tuition, accommodation, living, insurance, visa, travel, other, total, budgetStatus{label,description}, aiAnalysis
- **mentor**: `{ response: string }`

---

## Credit System

### Limits
- **Daily quota**: 30 AI requests per user (rolling 24-hour window)
- **Cooldown**: 2 seconds between requests
- **Reset**: Automatic at 24-hour mark

### Implementation (`lib/ai/credits.ts`)
```typescript
async function consumeCredit(request, mode) {
  1. Extract Bearer token from Authorization header
  2. Validate user via supabase.auth.getUser(token)
  3. Insert into future_atlas_ai_usage { user_id, request_id: uuid, mode }
  4. If insert fails:
     - "wait 2 seconds" in error → CreditError(429, retryAfter: 2)
     - Otherwise → CreditError(429, "Daily AI credits exhausted")
  5. Count usage in last 24h
  6. Return { userId, creditsRemaining: max(0, 30 - count) }
}
```

### Error Responses
- `401`: No session / expired session
- `429`: Rate limited (with `Retry-After` header for cooldown)
- `503`: All providers failed
- `504`: Timeout
- `502`: Invalid JSON from provider (structured mode)

---

## Security Architecture

### Embed Protection (`lib/security/embed-access.ts`)
```typescript
evaluateEmbedAccess(headers) {
  allowedOrigins = EMBED_ALLOWED_ORIGINS.split(',').map(normalizeOrigin)
  detectedOrigin = normalizeOrigin(headers.get('origin'))
  refererOrigin = normalizeOrigin(headers.get('referer'))
  
  if no allowedOrigins configured → deny
  if detectedOrigin or refererOrigin in allowedOrigins → allow
  else → deny with reason
}
```
- `normalizeOrigin`: Parses URL, allows only http/https, returns `origin` (scheme+host+port)
- Used in `next.config.ts` for CSP `frame-ancestors` and in `/embed` page for runtime check

### Security Headers (`next.config.ts`)
```typescript
Protected pages (/, /countries, /universities, /scholarships, /cost-calculator, /eligibility):
  X-Frame-Options: SAMEORIGIN
  Content-Security-Policy: frame-ancestors 'self'

Embed page (/embed/*):
  Content-Security-Policy: frame-ancestors <EMBED_ALLOWED_ORIGINS>
```

### Security Alerts (`lib/notifications/security-alerts.ts`)
- Triggered on unauthorized embed access
- Cooldown: 1 hour default (`SECURITY_ALERT_COOLDOWN_SECONDS`)
- Channels: Webhook (POST JSON) or email (logged to console if not configured)
- Event metadata: timestamp, path, origin, referer, IP (from CF/headers), user-agent, reason

---

## Tool Components Deep Dive

### Common Patterns (All Tools)
```typescript
// State
const [step, setStep] = useState(1)
const [field1, setField1] = useState("")
const [field2, setField2] = useState("")
const [customAnswers, setCustomAnswers] = useState<Record<string,string>>({})
const [showResults, setShowResults] = useState(false)
const [results, setResults] = useState<MatchType[] | null>(null)
const [isLoading, setIsLoading] = useState(false)
const [error, setError] = useState("")
const [showAllOptions, setShowAllOptions] = useState(false)

// Option arrays defined as constants
const field1Options = ["Option A", "Option B", "Other"]

// Progressive disclosure
const visibleOptions = getProgressiveOptions(options, showAllOptions)
// Returns first 4 + MORE_OPTION if not expanded

// Custom "Other" handling
const isOtherSelected = currentSelection === "Other"
const canContinue = Boolean(currentSelection) && (!isOtherSelected || isCustomStudyInputValid(customValue))

// Navigation
const nextStep = () => {
  if (!canContinue) return
  const resolved = isOtherSelected ? customValue.trim() : currentSelection
  // Update state, increment step or generateResults()
}

// AI Generation
const generateResults = async (answers) => {
  setIsLoading(true); setError("")
  try {
    const requestBody = { mode: "...", responseFormat: "structured", inputs: answers, message: "..." }
    const cacheKey = getAIClientCacheKey(requestBody)
    const cached = readAIClientCache(cacheKey)
    if (cached) { setResults(cached.data); return }
    const payload = await requestAI(requestBody)
    writeAIClientCache(cacheKey, payload.data)
    setResults(payload.data.matches)
  } catch { setError("...") } finally { setIsLoading(false) }
}
```

### CustomOptionInput Validation (`components/Tools/CustomOptionInput.tsx`)
- **Allowed**: Study-abroad terms (countries, courses, degrees, keywords like "admission", "scholarship", "ielts")
- **Blocked**: casino, crypto, dating, gambling, hack, hate, malware, porn, weapon
- **Validation**: Levenshtein distance to known terms (max 25% of length, min 2, max 5)
- **Heuristics**: Academic patterns (% scores, IELTS, currency), course-like names (≤5 words)
- **Suggestion**: Shows "Did you mean X?" for close matches
- **Error messages**: Specific guidance for empty, length, blocked, irrelevant input

### Result Display
- **Grid**: 1 col mobile, 2 col tablet, 3 col desktop
- **Cards**: Match score badge, name, description, tags, highlights
- **Loading**: `ResultLoading` component with rotating messages
- **Error**: Inline message with retry guidance
- **Empty**: Placeholder text
- **ForumCTA**: Context-aware copy per tool type

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NVIDIA_API_KEY` | Yes | Primary NVIDIA API key (Nemotron) |
| `NVIDIA_FALLBACK_API_KEY_1` | No | Fallback 1 (Gemma 4) |
| `NVIDIA_FALLBACK_API_KEY_2` | No | Fallback 2 (Mistral Nemotron) |
| `NVIDIA_MODEL` | No | Model override (default: nemotron-3.5-lightning-30b-a3b) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase anon/publishable key |
| `NEXT_PUBLIC_FORUM_URL` | No | External forum link (default: /guidance) |
| `EMBED_ALLOWED_ORIGINS` | For embed | Comma-separated exact origins (e.g., `https://client.com`) |
| `SECURITY_ALERT_EMAIL` | No | Alert recipient email |
| `SECURITY_ALERT_WEBHOOK_URL` | No | Webhook endpoint for security alerts |
| `SECURITY_ALERT_COOLDOWN_SECONDS` | No | Alert cooldown (default: 3600) |

---

## Development Workflow

### Scripts
```bash
npm run dev        # Next.js dev server with Turbopack (--webpack flag)
npm run build      # Production build
npm run start      # Production server
npm run lint       # ESLint (Next.js config)
```

### TypeScript
- Strict mode enabled
- Path aliases: `@/*` → `./*`
- Excludes: `node_modules`, `aicalls/`
- Includes: `.next/types/**` for generated types

### Code Conventions
- **"use client"** at top of client components
- Server components by default (App Router)
- Tailwind utility classes; custom CSS only in `globals.css`
- Lucide React for icons
- ReactMarkdown + remark-gfm for AI responses
- No external state management (React useState + Context for auth)

---

## Deployment Notes

### Vercel / Cloudflare Workers
- **Edge compatible**: Yes (no Node.js-only APIs in middleware)
- **Environment variables**: Set in platform dashboard (never commit `.env.local`)
- **Supabase**: Works with Supabase Vercel integration or manual env vars
- **NVIDIA API**: Keys must be server-side only (not `NEXT_PUBLIC_`)

### Build Output
- `.next/` contains compiled server/client bundles
- Static assets in `public/` served from `/`
- API routes deployed as serverless functions

### Performance
- **Client cache**: 10-min TTL avoids repeat AI calls
- **Server cache**: 24-hr TTL, 250-entry LRU reduces provider costs
- **Hedged providers**: First valid response wins (typically <3s)
- **Structured prompts**: Low token limits (700) for speed
- **Progressive options**: Reduces initial render payload

---

## Extending the Application

### Adding a New Tool
1. Create `components/Tools/NewTool.tsx` following existing pattern
2. Add mode to `lib/ai/types.ts` (`AIMode` union)
3. Add personality to `lib/ai/personalities.ts`
4. Add structured prompt to `app/api/ai/route.ts` (`structuredPrompts`)
5. Create page `app/new-tool/page.tsx` with `ProtectedTool`
6. Add tool card to `FutureAtlasDashboard.tsx` `tools` array
7. Add to `embedTools` in `EmbedApp.tsx` if embeddable
8. Update `routingInstructions` in `app/api/ai/route.ts`

### Adding an AI Provider
1. Add entry to `configuredProviders()` in `lib/ai/providers.ts`
2. Ensure OpenAI-compatible endpoint + API key
3. Adjust `delayMs` for hedging priority
4. Test validation logic in `runProvider()`

### Customizing Auth
- Modify `AuthDialog` for different fields (phone, social providers)
- Update `future_atlas_profiles` table schema + upsert logic
- Adjust RLS policies in Supabase dashboard

---

## Testing Checklist

### Auth
- [ ] Sign up with new email → OTP → profile created
- [ ] Sign in with existing email → OTP → redirect to destination
- [ ] Protected tool shows skeleton → sign-in prompt → tool after auth
- [ ] Session persists across refresh
- [ ] Sign out clears state (if implemented)

### Tools
- [ ] Each tool: 3-5 steps complete → AI results render
- [ ] "Other" option: validation works, suggestion appears
- [ ] Clear Selection resets all state + clears cache
- [ ] Back/Continue navigation works
- [ ] Results show match scores, descriptions, tags
- [ ] ForumCTA shows correct context copy

### AI Chat
- [ ] All 7 modes load with correct intro + suggestions
- [ ] Mode switch preserves history (or resets per design)
- [ ] Markdown renders (bold, lists, code)
- [ ] Loading animation cycles messages
- [ ] Error handling shows user-friendly message
- [ ] Embedded mode opens tools in parent frame

### Embed
- [ ] Allowed origin → EmbedApp loads
- [ ] Disallowed origin → AccessRestricted shows
- [ ] No origin configured → AccessRestricted shows
- [ ] Tool navigation stays in `/embed?tool=...`
- [ ] CSP headers present on embed page

### Credits
- [ ] 30 requests/day enforced
- [ ] 2-second cooldown enforced
- [ ] Credits remaining displayed in response
- [ ] Expired session → 401 → re-auth flow

### Security
- [ ] CSP headers on all pages
- [ ] X-Frame-Options on protected pages
- [ ] Security alert fires on unauthorized embed (check logs)
- [ ] Alert cooldown prevents spam

---

## Known Limitations & Future Work

### Current Limitations
1. **No server-side session validation in middleware** — relies on client-side `ProtectedTool`
2. **No rate limiting on `/api/ai` beyond credits** — could add IP-based limits
3. **In-memory caches** — lost on serverless cold starts; consider Redis for production scale
4. **Single Supabase project** — no multi-tenancy
5. **Zoho form dependency** — hardcoded endpoint in `GuidanceForm`
6. **No automated tests** — add Vitest/Playwright
7. **No i18n** — English only
8. **Analytics** — only PageSense script; no custom events

### Recommended Enhancements
1. **Middleware auth** for true server-side protection
2. **Redis cache** (Upstash/Vercel KV) for server cache persistence
3. **Admin dashboard** for usage analytics, user management
4. **Webhook handlers** for Supabase auth events (email confirmation, etc.)
5. **Structured logging** (Pino/Winston) with correlation IDs
6. **E2E tests** for critical flows (auth → tool → AI → results)
7. **Feature flags** for gradual rollouts
8. **Accessibility audit** (WCAG 2.1 AA)

---

## Troubleshooting

### AI Returns Errors
- **503 "All providers failed"**: Check NVIDIA API keys, network connectivity, model availability
- **502 "Invalid JSON"**: Provider returned malformed JSON; check prompt size, model compatibility
- **429 "Daily credits exhausted"**: User hit 30/day limit; wait for reset
- **429 "Wait 2 seconds"**: Request too soon; client should debounce

### Auth Issues
- **"Sign in to use Future Atlas AI"**: Missing/invalid Authorization header; check Supabase session
- **OTP not arriving**: Check Supabase email provider config, spam folder
- **Profile upsert fails**: Check RLS policies on `future_atlas_profiles`

### Embed Issues
- **AccessRestricted on allowed origin**: Verify `EMBED_ALLOWED_ORIGINS` exact match (scheme, host, port)
- **CSP errors in console**: Check `frame-ancestors` value in `next.config.ts` matches allowed origins
- **Tools not loading in iframe**: Ensure `router.push` uses `/embed?tool=...` not absolute paths

### Build/Type Errors
- **"Module not found"**: Check `@/*` alias in `tsconfig.json`, restart TS server
- **Tailwind classes not applying**: Ensure `globals.css` imported in `layout.tsx`, check Tailwind 4 config
- **Hydration mismatch**: Check `suppressHydrationWarning` on `<body>`, avoid date/random in server components

---

## Support & Resources

- **Next.js 16 Docs**: `node_modules/next/dist/docs/` (per AGENTS.md)
- **Supabase Docs**: https://supabase.com/docs
- **NVIDIA API**: https://build.nvidia.com/
- **Tailwind CSS 4**: https://tailwindcss.com/docs
- **shadcn/ui**: https://ui.shadcn.com/ (component patterns)

---

*Document generated from source code analysis. Last updated: 2026-09-15*