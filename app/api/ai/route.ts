import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import { personalities } from "@/lib/ai/personalities";
import type { AIMode } from "@/lib/ai/types";
import { createStructuredFallback } from "@/lib/ai/fallbacks";

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

// Model
const NVIDIA_MODEL =
  process.env.NVIDIA_MODEL?.trim() || "openai/gpt-oss-20b";

// Fast-response token limits.
// These are deliberately much smaller than your previous 1200.
const STRUCTURED_MAX_TOKENS = 1600;
const NORMAL_MAX_TOKENS = 600;
const RATE_LIMIT_WINDOW_MS = 1000 * 60 * 60 * 24;
const REQUESTS_PER_CYCLE = 5;
const MAX_COOLDOWN_SECONDS = 120;

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
  aiUsage?: Map<string, { startedAt: number; requests: number; cooldownUntil: number }>;
};

const globalAIState = globalThis as typeof globalThis & GlobalAIState;

const responseCache =
  globalAIState.aiResponseCache ??
  new Map<string, CachedAIResponse>();

const pendingResponses =
  globalAIState.pendingAIResponses ??
  new Map<string, Promise<string>>();
const usageByClient =
  globalAIState.aiUsage ??
  new Map<string, { startedAt: number; requests: number; cooldownUntil: number }>();

globalAIState.aiResponseCache = responseCache;
globalAIState.pendingAIResponses = pendingResponses;
globalAIState.aiUsage = usageByClient;

function getClientKey(request: NextRequest) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown-client"
  );
}

function consumeUsage(request: NextRequest) {
  const now = Date.now();
  const clientKey = getClientKey(request);
  const current = usageByClient.get(clientKey);
  const usage =
    !current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS
      ? { startedAt: now, requests: 0, cooldownUntil: 0 }
      : current;

  if (usage.cooldownUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((usage.cooldownUntil - now) / 1000),
    };
  }

  usage.requests += 1;
  usageByClient.set(clientKey, usage);

  if (usage.requests % REQUESTS_PER_CYCLE === 0) {
    const cooldownSeconds = Math.min(
      (usage.requests / REQUESTS_PER_CYCLE) * 10,
      MAX_COOLDOWN_SECONDS
    );
    usage.cooldownUntil = now + cooldownSeconds * 1000;
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

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
- Keep descriptions concise.
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
      "ranking": "#1",
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
- Keep the assessment concise.
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
- Keep the analysis concise.
`,
};

// ============================================================
// JSON EXTRACTION
// ============================================================

function extractJson(content: string) {
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

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([firstKey], [secondKey]) =>
        firstKey.localeCompare(secondKey)
      )
      .map(
        ([key, item]) =>
          `${JSON.stringify(key)}:${stableStringify(item)}`
      )
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function getCacheKey(payload: unknown) {
  const value = stableStringify(payload);

  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
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

function cacheStructuredFallback(cacheKey: string, mode: AIMode, inputs: unknown) {
  const data = createStructuredFallback(mode, inputs);
  writeCachedResponse(cacheKey, JSON.stringify(data));
  return data;
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

  try {
    // --------------------------------------------------------
    // Read request
    // --------------------------------------------------------

    const body = await request.json();

    const mode = body.mode as AIMode;
    const message = body.message as string;
    const inputs = body.inputs;

    const responseFormat =
      body.responseFormat as string | undefined;

    const history = Array.isArray(body.history)
      ? body.history
      : [];

    // --------------------------------------------------------
    // Validate
    // --------------------------------------------------------

    if (!mode || !message?.trim()) {
      return NextResponse.json(
        {
          error: "Mode and message are required.",
        },
        { status: 400 }
      );
    }

    const personality = personalities[mode];

    if (!personality) {
      return NextResponse.json(
        {
          error: "Invalid AI mode.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // Fast local rejection
    // --------------------------------------------------------

    if (
      isClearlyUnrelatedStudyAbroadQuestion(
        mode,
        message
      )
    ) {
      return NextResponse.json({
        response: STUDY_ABROAD_REDIRECT,
        mode,
        personality: personality.name,
        cached: true,
      });
    }

    const usage = consumeUsage(request);

    if (!usage.allowed) {
      return NextResponse.json(
        {
          error: `Please wait ${usage.retryAfterSeconds} seconds before sending another AI request.`,
          retryAfterSeconds: usage.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(usage.retryAfterSeconds),
          },
        }
      );
    }

    // --------------------------------------------------------
    // NVIDIA API key
    // --------------------------------------------------------

    const apiKey =
      process.env.NVIDIA_API_KEY?.trim();

    if (!apiKey) {
      console.error(
        "NVIDIA_API_KEY is unavailable in the request runtime."
      );

      return NextResponse.json(
        {
          error:
            "Future Atlas AI is temporarily unavailable because its server configuration is incomplete. Please try again later.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // NVIDIA client
    // --------------------------------------------------------

    const nvidia = new OpenAI({
      apiKey,
      baseURL:
        "https://integrate.api.nvidia.com/v1",
      timeout: 10_000,
      maxRetries: 0,
    });

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
${personality.systemPrompt}

${routingInstructions}

${structuredPrompts[mode]}

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

Answer concisely.
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
      model: NVIDIA_MODEL,
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
          return NextResponse.json({
            data: extractJson(cachedResponse),
            mode,
            personality: personality.name,
            cached: true,
          });
        } catch {
          responseCache.delete(cacheKey);
          console.warn(`[AI] USING FALLBACK | invalid cached JSON | mode=${mode}`);
          return NextResponse.json({
            data: cacheStructuredFallback(cacheKey, mode, inputs),
            mode,
            personality: personality.name,
            cached: false,
            fallback: true,
          });
        }
      }

      return NextResponse.json({
        response: cachedResponse,
        mode,
        personality: personality.name,
        cached: true,
      });
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
          return NextResponse.json({
            data: extractJson(response),
            mode,
            personality: personality.name,
            cached: true,
          });
        } catch {
          return NextResponse.json({
            data: cacheStructuredFallback(cacheKey, mode, inputs),
            mode,
            personality: personality.name,
            cached: false,
            fallback: true,
          });
        }
      }

      return NextResponse.json({
        response,
        mode,
        personality: personality.name,
        cached: true,
      });
    }

    // --------------------------------------------------------
    // NVIDIA request
    // --------------------------------------------------------

    console.log(
      `[AI] NVIDIA REQUEST START | model=${NVIDIA_MODEL} | mode=${mode} | structured=${isStructured}`
    );

    const nvidiaStartedAt = Date.now();

    const nextResponse =
  nvidia.chat.completions.create({
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",

    messages,

    temperature: 1,
    top_p: 1,

    max_tokens: isStructured
      ? STRUCTURED_MAX_TOKENS
      : NORMAL_MAX_TOKENS,

  })
        .then((completion) => {
          const content =
            completion.choices[0]?.message
              ?.content;

          if (!content) {
            throw new Error(
              "NVIDIA returned an empty response."
            );
          }

          return content;
        })
        .then((content) => {
          const nvidiaTime =
            Date.now() - nvidiaStartedAt;

          console.log(
            `[AI] NVIDIA RESPONSE COMPLETE | ${nvidiaTime}ms | mode=${mode} | structured=${isStructured}`
          );

          writeCachedResponse(
            cacheKey,
            content
          );

          return content;
        })
        .catch((error) => {
          console.error(
            `[AI] NVIDIA REQUEST FAILED | ${
              Date.now() - nvidiaStartedAt
            }ms`,
            error
          );

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
      if (isStructured) {
        console.warn(`[AI] USING FALLBACK | provider failure | mode=${mode}`);
        return NextResponse.json({
          data: cacheStructuredFallback(cacheKey, mode, inputs),
          mode,
          personality: personality.name,
          cached: false,
          fallback: true,
        });
      }

      console.warn(`[AI] USING CHAT FALLBACK | provider failure | mode=${mode}`);
      return NextResponse.json({
        response:
          "I couldn't reach the live study-abroad model in time. Please try once more, or ask a shorter question so I can respond faster.",
        mode,
        personality: personality.name,
        cached: false,
        fallback: true,
      });
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
      } catch (jsonError) {
        console.error(
          "[AI] JSON PARSE ERROR:",
          jsonError
        );

        return NextResponse.json({
          data: cacheStructuredFallback(cacheKey, mode, inputs),
          mode,
          personality: personality.name,
          cached: false,
          fallback: true,
        });
      }

      return NextResponse.json({
        data: parsed,
        mode,
        personality: personality.name,
        cached: false,
      });
    }

    return NextResponse.json({
      response,
      mode,
      personality: personality.name,
      cached: false,
    });
  } catch (error: unknown) {
    const totalTime =
      Date.now() - requestStartedAt;

    console.error(
      `[AI] ROUTE ERROR after ${totalTime}ms:`,
      error
    );

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
