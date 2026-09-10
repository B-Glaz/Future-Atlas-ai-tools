import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

/*import Groq from "groq-sdk";*/

import { personalities } from "@/lib/ai/personalities";
import type { AIMode } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const MAX_CACHE_ENTRIES = 250;
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
  globalAIState.aiResponseCache ?? new Map<string, CachedAIResponse>();
const pendingResponses =
  globalAIState.pendingAIResponses ?? new Map<string, Promise<string>>();

globalAIState.aiResponseCache = responseCache;
globalAIState.pendingAIResponses = pendingResponses;

const routingInstructions = `
Future Atlas has five study-abroad tools:
- Cost Calculator: tuition, living costs, total budgets, affordability.
- Country Explorer: destination comparison, lifestyle, visa/work context.
- Eligibility Checker: admission readiness, profile gaps, next steps.
- Scholarship Explorer: funding options, scholarship fit, coverage, deadlines.
- University Explorer: university matches, programme fit, tuition and location.

Stay focused on study-abroad guidance. If the request clearly belongs in another
tool, still answer briefly for the current screen but naturally suggest the most
appropriate Future Atlas section. Interpret common spelling mistakes, abbreviations, and course-name variations from context. If a request is genuinely ambiguous, ask one brief clarification question instead of rejecting it. Never expose implementation details.
`;

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

const structuredPrompts: Record<AIMode, string> = {
  mentor: `
Return JSON only with this shape:
{
  "response": "Short study-abroad guidance."
}
Only answer study-abroad-related questions.
`,
  country: `
Return JSON only with this shape:
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
Create exactly 3 countries. Scores must be integers from 70 to 98.
`,
  university: `
Return JSON only with this shape:
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
Create exactly 3 universities. Match values must be integers from 70 to 98.
Do not invent exact admissions claims.
`,
  scholarship: `
Return JSON only with this shape:
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
Create exactly 3 scholarship matches. Match values must be integers from 70 to 98.
If exact deadlines are not verified, say they vary or should be checked.
`,
  eligibility: `
Return JSON only with this shape:
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
Score must be an integer from 0 to 98. Use status values "positive" or "caution".
Never guarantee admission or visa approval.
`,
  cost: `
Return JSON only with this shape:
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
Use approximate ranges and explain assumptions when exact costs are unavailable.
`,
};

function extractJson(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("AI response did not include JSON.");
    }

    return JSON.parse(match[0]);
  }
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
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

function readCachedResponse(cacheKey: string) {
  const cached = responseCache.get(cacheKey);

  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(cacheKey);
    return null;
  }

  responseCache.delete(cacheKey);
  responseCache.set(cacheKey, cached);
  return cached.response;
}

function writeCachedResponse(cacheKey: string, response: string) {
  responseCache.set(cacheKey, {
    response,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  while (responseCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;

    if (!oldestKey) break;
    responseCache.delete(oldestKey);
  }
}

function isClearlyUnrelatedStudyAbroadQuestion(
  mode: AIMode,
  message: string
) {
  if (mode !== "mentor") return false;

  const normalizedMessage = normalizeText(message);
  const hasStudySignal = studyAbroadSignals.some((signal) =>
    normalizedMessage.includes(signal)
  );
  const hasUnrelatedSignal = unrelatedSignals.some((signal) =>
    normalizedMessage.includes(signal)
  );

  return hasUnrelatedSignal && !hasStudySignal;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const mode = body.mode as AIMode;
    const message = body.message as string;
    const inputs = body.inputs;
    const responseFormat = body.responseFormat as string | undefined;
    const history = Array.isArray(body.history)
      ? body.history
      : [];

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

    if (isClearlyUnrelatedStudyAbroadQuestion(mode, message)) {
      return NextResponse.json({
        response: STUDY_ABROAD_REDIRECT,
        mode,
        personality: personality.name,
        cached: true,
      });
    }

const apiKey = process.env.NVIDIA_API_KEY?.trim();

if (!apiKey) {
  console.error("NVIDIA_API_KEY is unavailable in the request runtime.");

  return NextResponse.json(
    {
      error:
        "Future Atlas AI is temporarily unavailable because its server configuration is incomplete. Please try again later.",
    },
    { status: 500 }
  );
}

const nvidia = new OpenAI({
  apiKey,
  baseURL: "https://integrate.api.nvidia.com/v1",
});
    const validHistory = history
      .filter(
        (item: { role?: string; content?: string }) =>
          (item.role === "user" || item.role === "model") &&
          typeof item.content === "string" &&
          item.content.trim().length > 0
      )
      .map((item: { role: string; content: string }) => ({
        role:
          item.role === "model"
            ? ("assistant" as const)
            : ("user" as const),
        content: item.content.trim(),
      }));

    const messages = [
      {
        role: "system" as const,
        content: `${personality.systemPrompt}\n${routingInstructions}`,
      },
      ...validHistory,
      {
        role: "user" as const,
        content:
          responseFormat === "structured"
            ? `${message.trim()}

User inputs:
${JSON.stringify(inputs ?? {})}

${structuredPrompts[mode]}`
            : message.trim(),
      },
    ];

    const cacheKey = getCacheKey({
      mode,
      responseFormat,
      messages,
    });
    const cachedResponse = readCachedResponse(cacheKey);
    const response =
      cachedResponse ??
      (await (() => {
        const pendingResponse = pendingResponses.get(cacheKey);

        if (pendingResponse) {
          return pendingResponse;
        }

        const nextResponse = nvidia.chat.completions
  .create({
    model: "nvidia/nemotron-3-ultra-550b-a55b",
    messages,
    temperature: 1,
    top_p: 0.95,
    max_tokens: responseFormat === "structured" ? 1200 : 700,

    ...(responseFormat === "structured"
      ? {
          response_format: {
            type: "json_object" as const,
          },
        }
      : {}),
  })
  .then(
    (completion) =>
      completion.choices[0]?.message?.content ||
      "I couldn't generate a response."
  )
  .then((content) => {
    writeCachedResponse(cacheKey, content);
    return content;
  })
  .finally(() => {
    pendingResponses.delete(cacheKey);
  });
        pendingResponses.set(cacheKey, nextResponse);
        return nextResponse;
      })());

    if (responseFormat === "structured") {
      return NextResponse.json({
        data: extractJson(response),
        mode,
        personality: personality.name,
        cached: Boolean(cachedResponse),
      });
    }

    return NextResponse.json({
      response,
      mode,
      personality: personality.name,
      cached: Boolean(cachedResponse),
    });
  } catch (error: unknown) {
    console.error("AI API Error:", error);

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

    return NextResponse.json(
      {
        error:
          "Something went wrong while connecting to Future Atlas AI.",
      },
      { status: 500 }
    );
  }
}
