import { NextRequest, NextResponse } from "next/server";
import { personalities } from "@/lib/ai/personalities";
import { consumeCredit, completeCreditRequest, CreditError } from "@/lib/ai/credits";
import { requestAI } from "@/lib/ai/providers";
import type { AIMode } from "@/lib/ai/types";
import { getCacheKey } from "@/lib/ai/cache-utils";
import { isStructuredOutput } from "@/lib/ai/structured-output";

export const dynamic = "force-dynamic";

// ============================================================
// CONFIG
// ============================================================

const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const MAX_CACHE_ENTRIES = 250;

// Keep history small for latency.
// Structured tool requests generally do not need the whole
// conversation history.
const MAX_HISTORY_MESSAGES = 6;
const MAX_HISTORY_CHARS = 8000;

// Fast-response token limits.
// These are deliberately much smaller than your previous 1200.
const STRUCTURED_MAX_TOKENS = 700;
const NORMAL_MAX_TOKENS = 900;

function errorDetails(error: unknown) {
  if (!(error instanceof Error)) return { name: "UnknownError" };
  const status = "status" in error && typeof error.status === "number" ? error.status : undefined;
  return { name: error.name, status };
}

// ============================================================
// CONSTANTS
// ============================================================

const STUDY_ABROAD_REDIRECT =
  "I’m here to help with study-abroad-related questions only. Please ask me anything about studying abroad, universities, courses, applications, scholarships, visas, or other study-abroad-related topics.";

type CachedAIResponse = {
  response: string;
  expiresAt: number;
};

type GlobalAIState = {
  aiResponseCache?: Map<string, CachedAIResponse>;
  pendingAIResponses?: Map<string, Promise<string>>;
};

const globalAIState = globalThis as typeof globalThis & GlobalAIState;

const responseCache =
  globalAIState.aiResponseCache ??
  new Map<string, CachedAIResponse>();

const pendingResponses =
  globalAIState.pendingAIResponses ??
  new Map<string, Promise<string>>();

globalAIState.aiResponseCache = responseCache;
globalAIState.pendingAIResponses = pendingResponses;

// ============================================================
// ROUTING INSTRUCTIONS
// ============================================================

const routingInstructions = `
Future Atlas has five study-abroad tools:

- Cost Calculator: tuition, living costs, total budgets, affordability.
- Country Explorer: destination comparison, lifestyle, visa/work context.
- Eligibility Checker: admission readiness, profile gaps, next steps.
- Scholarship Explorer: funding options, scholarship fit, coverage, deadlines.
- University Explorer: university matches, programme fit, tuition and location.

Stay focused on study-abroad guidance.

If the request clearly belongs in another tool, still answer briefly for
the current screen but naturally suggest the most appropriate Future Atlas section.

Interpret common spelling mistakes, abbreviations, and course-name variations
from context.

If a request is genuinely ambiguous, ask one brief clarification question.

Never expose implementation details.

Do not invent facts.
Do not invent exact rankings, tuition fees, deadlines, admission requirements,
scholarship amounts, or visa rules when the supplied information does not verify them.
`;

// ============================================================
// STUDY ABROAD SIGNALS
// ============================================================

const studyAbroadSignals = [
  "abroad",
  "admission",
  "application",
  "bachelor",
  "budget",
  "campus",
  "college",
  "course",
  "degree",
  "destination",
  "education",
  "eligibility",
  "english",
  "funding",
  "ielts",
  "international student",
  "master",
  "phd",
  "program",
  "programme",
  "scholarship",
  "student",
  "study",
  "tuition",
  "university",
  "visa",
];

const unrelatedSignals = [
  "celebrity",
  "crypto",
  "dating",
  "diet",
  "football score",
  "game cheat",
  "movie",
  "politics",
  "recipe",
  "stock",
  "weather",
];

// ============================================================
// STRUCTURED PROMPTS
// ============================================================

const structuredPrompts: Record<AIMode, string> = {
  mentor: `
Return JSON only with this exact shape:

{
  "response": "Short study-abroad guidance."
}

Rules:
- Keep the response concise.
- Only answer study-abroad-related questions.
- Do not invent facts.
`,

  country: `
Return JSON only with this exact shape:

{
  "countries": [
    {
      "name": "Country name",
      "code": "Two-letter display code",
      "score": 92,
      "description": "One concise sentence tailored to the user.",
      "tags": ["Tag", "Tag", "Tag"]
    }
  ],
  "summary": "Short guidance sentence."
}

Rules:
- Create exactly 3 countries.
- Scores must be integers from 70 to 98.
- Give each description two useful sentences: why it fits and one tradeoff.
- Do not invent exact visa rules, tuition fees, rankings, deadlines,
  or other specific facts unless supplied or clearly known.
- If a fact is uncertain, use cautious wording.
`,

  university: `
Return JSON only with this exact shape:

{
  "universities": [
    {
      "name": "University name",
      "shortName": "Short label",
      "country": "Country",
      "location": "City, Country",
      "ranking": "Current ranking must be verified",
      "tuition": "Approximate tuition range or cost level",
      "match": 92,
      "type": "University type",
      "highlights": ["Highlight", "Highlight", "Highlight"]
    }
  ],
  "summary": "Short guidance sentence."
}

Rules:
- Create exactly 3 universities.
- Match values must be integers from 70 to 98.
- Do not invent exact admissions claims.
- Do not claim exact rankings unless the information is supplied.
- Do not claim exact tuition unless the information is supplied.
- Use approximate wording when information is uncertain.
`,

  scholarship: `
Return JSON only with this exact shape:

{
  "scholarships": [
    {
      "name": "Scholarship or funding category",
      "provider": "Provider",
      "country": "Country",
      "amount": "Amount or varies",
      "coverage": "What it may cover",
      "deadline": "Deadline guidance",
      "match": 92,
      "type": "Scholarship type",
      "tags": ["Tag", "Tag", "Tag"]
    }
  ],
  "summary": "Short guidance sentence."
}

Rules:
- Create exactly 3 scholarship matches.
- Match values must be integers from 70 to 98.
- Never invent exact deadlines.
- If exact deadlines are not verified, say they vary or should be checked.
- Never invent scholarship amounts.
`,

  eligibility: `
Return JSON only with this exact shape:

{
  "score": 82,
  "status": "Strong initial profile",
  "summary": "Two concise sentences explaining the assessment.",
  "breakdown": [
    {
      "title": "Academic Profile",
      "status": "positive",
      "description": "Concise personalized assessment."
    },
    {
      "title": "English Requirement",
      "status": "caution",
      "description": "Concise personalized assessment."
    },
    {
      "title": "Programme Fit",
      "status": "positive",
      "description": "Concise personalized assessment."
    }
  ],
  "nextSteps": ["Step one", "Step two", "Step three"]
}

Rules:
- Score must be an integer from 0 to 98.
- Use status values "positive" or "caution".
- Never guarantee admission.
- Never guarantee visa approval.
- Keep the assessment clear, specific, and tied to every supplied input.
- Base the assessment on supplied user information.
`,

  cost: `
Return JSON only with this exact shape:

{
  "tuition": "Estimated range",
  "accommodation": "Estimated range",
  "living": "Estimated range",
  "insurance": "Estimated range",
  "visa": "Estimated range",
  "travel": "Estimated range",
  "other": "Estimated range",
  "total": "Estimated annual total range",
  "budgetStatus": {
    "label": "Comfortable budget range",
    "description": "Concise personalized explanation."
  },
  "aiAnalysis": "Concise analysis formatted as plain text."
}

Rules:
- Use approximate ranges.
- Explain assumptions when exact costs are unavailable.
- Do not invent precise costs.
- Give a useful breakdown of assumptions, affordability, and cost-saving priorities.
`,
};

// ============================================================
// JSON EXTRACTION
// ============================================================

function extractJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    // Try to recover JSON if the model surrounded it with text.
    const firstBrace = content.indexOf("{");
    const lastBrace = content.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("AI response did not include valid JSON.");
    }

    const possibleJson = content.slice(firstBrace, lastBrace + 1);

    try {
      return JSON.parse(possibleJson);
    } catch {
      throw new Error("AI response contained invalid JSON.");
    }
  }
}

// ============================================================
// TEXT HELPERS
// ============================================================

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

// ============================================================
// CACHE
// ============================================================

function readCachedResponse(cacheKey: string) {
  const cached = responseCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(cacheKey);
    return null;
  }

  // Refresh LRU position.
  responseCache.delete(cacheKey);
  responseCache.set(cacheKey, cached);

  return cached.response;
}

function writeCachedResponse(
  cacheKey: string,
  response: string
) {
  responseCache.set(cacheKey, {
    response,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  while (responseCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;

    if (!oldestKey) {
      break;
    }

    responseCache.delete(oldestKey);
  }
}
// ============================================================
// HISTORY
// ============================================================

function prepareHistory(history: unknown[]) {
  const validHistory = history
    .filter((item) => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as { role?: string; content?: string };
      return (
        (candidate.role === "user" || candidate.role === "model") &&
        typeof candidate.content === "string" &&
        candidate.content.trim().length > 0
      );
    })
    .map((item) => {
      const candidate = item as { role: string; content: string };
      return {
        role:
          candidate.role === "model"
            ? ("assistant" as const)
            : ("user" as const),
        content: candidate.content.trim(),
      };
    });

  // Only keep recent messages.
  const recentHistory = validHistory.slice(
    -MAX_HISTORY_MESSAGES
  );

  // Prevent an unexpectedly large conversation from
  // destroying latency.
  let totalChars = 0;

  const limitedHistory = [];

  for (
    let index = recentHistory.length - 1;
    index >= 0;
    index -= 1
  ) {
    const item = recentHistory[index];

    if (
      totalChars + item.content.length >
      MAX_HISTORY_CHARS
    ) {
      break;
    }

    limitedHistory.unshift(item);
    totalChars += item.content.length;
  }

  return limitedHistory;
}

// ============================================================
// STUDY ABROAD FILTER
// ============================================================

function isClearlyUnrelatedStudyAbroadQuestion(
  mode: AIMode,
  message: string
) {
  if (mode !== "mentor") {
    return false;
  }

  const normalizedMessage = normalizeText(message);

  const hasStudySignal = studyAbroadSignals.some(
    (signal) => normalizedMessage.includes(signal)
  );

  const hasUnrelatedSignal = unrelatedSignals.some(
    (signal) => normalizedMessage.includes(signal)
  );

  return hasUnrelatedSignal && !hasStudySignal;
}

// ============================================================
// POST
// ============================================================

export async function POST(
  request: NextRequest
) {
  const requestStartedAt = Date.now();
  const routeRequestId = crypto.randomUUID();
  let requestMode: string | undefined;
  let credit: Awaited<ReturnType<typeof consumeCredit>> | undefined;

  try {
    const contentLength = Number(request.headers.get("content-length") || 0);

    if (contentLength > 64_000) {
      return NextResponse.json(
        { error: { code: "REQUEST_TOO_LARGE", message: "Request is too large.", retryable: false, requestId: routeRequestId } },
        { status: 413, headers: { "X-Request-ID": routeRequestId } }
      );
    }

    // --------------------------------------------------------
    // Read request
    // --------------------------------------------------------

    const body = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "A JSON object is required.", retryable: false, requestId: routeRequestId } },
        { status: 400, headers: { "X-Request-ID": routeRequestId } }
      );
    }

    const mode = body.mode as AIMode;
    requestMode = mode;
    const message = body.message;
    const inputs = body.inputs;

    const responseFormat =
      body.responseFormat as string | undefined;

    const history = Array.isArray(body.history)
      ? body.history
      : [];

    // --------------------------------------------------------
    // Validate
    // --------------------------------------------------------

    if (
      !mode ||
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 8_000
    ) {
      return NextResponse.json(
        {
          error: { code: "INVALID_REQUEST", message: "A valid message under 8,000 characters is required.", retryable: false, requestId: routeRequestId },
        },
        { status: 400, headers: { "X-Request-ID": routeRequestId } }
      );
    }

    if (responseFormat !== undefined && responseFormat !== "structured") {
      return NextResponse.json(
        { error: { code: "INVALID_RESPONSE_FORMAT", message: "responseFormat must be structured when provided.", retryable: false, requestId: routeRequestId } },
        { status: 400, headers: { "X-Request-ID": routeRequestId } }
      );
    }

    const personality = personalities[mode];

    if (!personality) {
      return NextResponse.json(
        {
          error: { code: "INVALID_MODE", message: "Invalid AI mode.", retryable: false, requestId: routeRequestId },
        },
        { status: 400, headers: { "X-Request-ID": routeRequestId } }
      );
    }

    const disabledModes = (process.env.AI_DISABLED_MODES || "").split(",").map((item) => item.trim()).filter(Boolean);
    if (process.env.AI_ENABLED === "false" || disabledModes.includes(mode)) {
      return NextResponse.json(
        { error: { code: "AI_DISABLED", message: "This AI tool is temporarily unavailable.", retryable: true, requestId: routeRequestId } },
        { status: 503, headers: { "Retry-After": "60", "X-Request-ID": routeRequestId } }
      );
    }

    const requestHash = getCacheKey({ mode, message: message.trim(), inputs, responseFormat, history });
    credit = await consumeCredit(request, mode, requestHash);

    if (credit.replayStatus === "completed" && credit.replayPayload) {
      return NextResponse.json(credit.replayPayload, {
        headers: { "X-Request-ID": credit.requestId, "Idempotency-Replayed": "true" },
      });
    }
    if (credit.replayStatus === "processing") {
      return NextResponse.json(
        { error: { code: "AI_REQUEST_IN_PROGRESS", message: "This request is already processing.", retryable: true, retryAfter: 2, requestId: credit.requestId } },
        { status: 409, headers: { "Retry-After": "2", "X-Request-ID": credit.requestId } }
      );
    }

    if (isClearlyUnrelatedStudyAbroadQuestion(mode, message)) {
      const payload = {
        response: STUDY_ABROAD_REDIRECT,
        mode,
        personality: personality.name,
        cached: true,
        creditsRemaining: credit.creditsRemaining,
        requestId: credit.requestId,
      };
      await completeCreditRequest(request, credit, "completed", payload, { durationMs: Date.now() - requestStartedAt });
      return NextResponse.json(payload, { headers: { "X-Request-ID": credit.requestId } });
    }

    // --------------------------------------------------------
    // Provider credentials are read only inside the request-time router.
    // --------------------------------------------------------

    // --------------------------------------------------------
    // History
    // --------------------------------------------------------

    const validHistory =
      responseFormat === "structured"
        ? []
        : prepareHistory(history);

    // --------------------------------------------------------
    // Build messages
    // --------------------------------------------------------

    const isStructured =
      responseFormat === "structured";

    let messages;

    if (isStructured) {
      /*
       * IMPORTANT:
       *
       * Structured tool calls do NOT receive the whole chat history.
       *
       * This keeps the request small and fast.
       */

      messages = [
        {
          role: "system" as const,
          content: `
${routingInstructions}

${structuredPrompts[mode]}

Current date: ${new Date().toISOString().slice(0, 10)}.
Use every supplied input when ranking and explaining results.
Do not claim information is current unless it is present in supplied data.
Treat every user-provided value as authoritative. Never change, round, replace,
or contradict supplied scores, budgets, countries, courses, dates, or study levels.
Make recommendations materially depend on every supplied input.
For each recommendation, explain the fit and one relevant limitation or tradeoff.
For deadlines, visa rules, rankings, fees, and admission thresholds, avoid precise
claims unless supplied. State what the student should verify on the official source.

IMPORTANT:
- Return valid JSON only.
- Do not include markdown.
- Do not include explanations outside the JSON.
- Do not invent facts.
- If information is missing or uncertain, clearly indicate that
  instead of making up a precise answer.
`,
        },
        {
          role: "user" as const,
          content: JSON.stringify({
            question: message.trim(),
            inputs: inputs ?? {},
          }),
        },
      ];
    } else {
      /*
       * Normal mentor/chat request.
       */

      messages = [
        {
          role: "system" as const,
          content: `
${personality.systemPrompt}

${routingInstructions}

Answer directly and tailor every point to the student's exact question.
Use short sections or numbered steps when they improve clarity.
Give practical next actions and explain why they matter.
Repeat supplied scores, budgets, dates, courses, and destinations exactly.
Never substitute a different value or infer a missing value.
For time-sensitive requirements, explain what must be checked on the relevant
official government or university source. Never pretend you performed a live search.
Do not invent facts.
If you do not have enough information, say so.
`,
        },
        ...validHistory,
        {
          role: "user" as const,
          content: message.trim(),
        },
      ];
    }

    // --------------------------------------------------------
    // Cache key
    // --------------------------------------------------------

    const cacheKey = getCacheKey({
      cacheScope: credit.cacheScope,
      providerRoutingVersion: 1,
      mode,
      responseFormat,
      messages,
    });

    // --------------------------------------------------------
    // Cache lookup
    // --------------------------------------------------------

    const cachedResponse =
      readCachedResponse(cacheKey);

    if (cachedResponse) {
      console.log(
        `[AI] CACHE HIT | ${Date.now() - requestStartedAt}ms | mode=${mode}`
      );

      if (isStructured) {
        try {
          const payload = {
            data: extractJson(cachedResponse),
            mode,
            personality: personality.name,
            cached: true,
            creditsRemaining: credit.creditsRemaining,
            requestId: credit.requestId,
          };
          await completeCreditRequest(request, credit, "completed", payload, { durationMs: Date.now() - requestStartedAt });
          return NextResponse.json(payload, { headers: { "X-Request-ID": credit.requestId } });
        } catch {
          responseCache.delete(cacheKey);
          console.warn(`[AI] INVALID CACHED JSON | mode=${mode}`);
        }
      } else {
        const payload = {
          response: cachedResponse,
          mode,
          personality: personality.name,
          cached: true,
          creditsRemaining: credit.creditsRemaining,
          requestId: credit.requestId,
        };
        await completeCreditRequest(request, credit, "completed", payload, { durationMs: Date.now() - requestStartedAt });
        return NextResponse.json(payload, { headers: { "X-Request-ID": credit.requestId } });
      }
    }

    // --------------------------------------------------------
    // Existing in-flight request
    // --------------------------------------------------------

    const pendingResponse =
      pendingResponses.get(cacheKey);

    if (pendingResponse) {
      console.log(
        `[AI] WAITING FOR EXISTING REQUEST | mode=${mode}`
      );

      const response = await pendingResponse;

      console.log(
        `[AI] DUPLICATE REQUEST COMPLETE | ${
          Date.now() - requestStartedAt
        }ms | mode=${mode}`
      );

      if (isStructured) {
        try {
          const payload = {
            data: extractJson(response),
            mode,
            personality: personality.name,
            cached: true,
            creditsRemaining: credit.creditsRemaining,
            requestId: credit.requestId,
          };
          await completeCreditRequest(request, credit, "completed", payload, { durationMs: Date.now() - requestStartedAt });
          return NextResponse.json(payload, { headers: { "X-Request-ID": credit.requestId } });
        } catch {
          responseCache.delete(cacheKey);
          await completeCreditRequest(request, credit, "failed", undefined, { errorCode: "AI_INVALID_RESPONSE", durationMs: Date.now() - requestStartedAt });
          return NextResponse.json({ error: "The live AI returned an invalid response. Please try again." }, { status: 502 });
        }
      }

      const payload = {
        response,
        mode,
        personality: personality.name,
        cached: true,
        creditsRemaining: credit.creditsRemaining,
        requestId: credit.requestId,
      };
      await completeCreditRequest(request, credit, "completed", payload, { durationMs: Date.now() - requestStartedAt });
      return NextResponse.json(payload, { headers: { "X-Request-ID": credit.requestId } });
    }

    // --------------------------------------------------------
    // Hedged NVIDIA request
    // --------------------------------------------------------

    let selectedProvider = "";
    const nextResponse = requestAI({
      messages,
      structured: isStructured,
      maxTokens: isStructured ? STRUCTURED_MAX_TOKENS : NORMAL_MAX_TOKENS,
      validate: (content) => {
        if (!content.trim()) return false;
        if (!isStructured) return true;

        try {
          return isStructuredOutput(mode, extractJson(content));
        } catch {
          return false;
        }
      },
    })
        .then(({ content, provider }) => {
          selectedProvider = provider;
          console.log(`[AI] RESPONSE WINNER | provider=${provider} | mode=${mode}`);
          writeCachedResponse(cacheKey, content);
          return content;
        })
        .catch((error) => {
          console.error(JSON.stringify({
            event: "ai_provider_request_failed",
            mode,
            durationMs: Date.now() - requestStartedAt,
            ...errorDetails(error),
          }));

          throw error;
        })
        .finally(() => {
          pendingResponses.delete(
            cacheKey
          );
        });

    // Store in-flight request.
    pendingResponses.set(
      cacheKey,
      nextResponse
    );

    let response: string;

    try {
      response = await nextResponse;
    } catch {
      await completeCreditRequest(request, credit, "failed", undefined, {
        errorCode: "AI_PROVIDER_UNAVAILABLE",
        durationMs: Date.now() - requestStartedAt,
      });
      return NextResponse.json(
        { error: { code: "AI_PROVIDER_UNAVAILABLE", message: "The live AI service could not complete this request.", retryable: true, requestId: credit.requestId } },
        { status: 503, headers: { "Retry-After": "5", "X-Request-ID": credit.requestId } }
      );
    }

    // --------------------------------------------------------
    // Final response
    // --------------------------------------------------------

    console.log(
      `[AI] TOTAL ROUTE TIME | ${
        Date.now() - requestStartedAt
      }ms | mode=${mode}`
    );

    if (isStructured) {
      let parsed;

      try {
        parsed = extractJson(response);
        if (!isStructuredOutput(mode, parsed)) {
          throw new Error("AI response did not match the required result shape.");
        }
      } catch (jsonError) {
        console.error(JSON.stringify({
          event: "ai_invalid_structured_response",
          mode,
          requestId: credit.requestId,
          ...errorDetails(jsonError),
        }));

        await completeCreditRequest(request, credit, "failed", undefined, {
          errorCode: "AI_INVALID_RESPONSE",
          durationMs: Date.now() - requestStartedAt,
        });
        return NextResponse.json(
          { error: { code: "AI_INVALID_RESPONSE", message: "The live AI returned an invalid response.", retryable: true, requestId: credit.requestId } },
          { status: 502, headers: { "X-Request-ID": credit.requestId } }
        );
      }

      const payload = {
        data: parsed,
        mode,
        personality: personality.name,
        cached: false,
        creditsRemaining: credit.creditsRemaining,
        requestId: credit.requestId,
      };
      await completeCreditRequest(request, credit, "completed", payload, {
        provider: selectedProvider || undefined,
        durationMs: Date.now() - requestStartedAt,
      });
      return NextResponse.json(payload, { headers: { "X-Request-ID": credit.requestId } });
    }

    const payload = {
      response,
      mode,
      personality: personality.name,
      cached: false,
      creditsRemaining: credit.creditsRemaining,
      requestId: credit.requestId,
    };
    await completeCreditRequest(request, credit, "completed", payload, {
      provider: selectedProvider || undefined,
      durationMs: Date.now() - requestStartedAt,
    });
    return NextResponse.json(payload, { headers: { "X-Request-ID": credit.requestId } });
  } catch (error: unknown) {
    const totalTime =
      Date.now() - requestStartedAt;

    console.error(JSON.stringify({
      event: "ai_route_error",
      mode: requestMode,
      requestId: credit?.requestId || routeRequestId,
      durationMs: totalTime,
      ...errorDetails(error),
    }));

    if (credit) {
      await completeCreditRequest(request, credit, "failed", undefined, {
        errorCode: "AI_INTERNAL_ERROR",
        durationMs: totalTime,
      }).catch(() => undefined);
    }

    if (error instanceof CreditError) {
      const requestId = credit?.requestId || routeRequestId;
      return NextResponse.json(
        { error: { code: error.code, message: error.message, retryable: error.status >= 429, retryAfter: error.retryAfter, requestId } },
        {
          status: error.status,
          headers: { ...(error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {}), "X-Request-ID": requestId },
        }
      );
    }

    // --------------------------------------------------------
    // Rate limit
    // --------------------------------------------------------

    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 429
    ) {
      return NextResponse.json(
        {
          error:
            "AI usage limit reached. Please try again shortly.",
        },
        { status: 429 }
      );
    }

    // --------------------------------------------------------
    // Timeout
    // --------------------------------------------------------

    if (
      error instanceof Error &&
      (
        error.name === "AbortError" ||
        error.message
          .toLowerCase()
          .includes("timeout")
      )
    ) {
      return NextResponse.json(
        {
          error:
            "The AI service took too long to respond. Please try again.",
        },
        { status: 504 }
      );
    }

    // --------------------------------------------------------
    // Generic error
    // --------------------------------------------------------

    return NextResponse.json(
      {
        error:
          "Something went wrong while connecting to Future Atlas AI.",
      },
      { status: 500 }
    );
  }
}
