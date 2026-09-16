import type { AIMode } from "./types";

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function texts(value: unknown) {
  return Array.isArray(value) && value.length > 0 && value.every(text);
}

function entries(value: unknown, fields: string[], listFields: string[] = [], numberFields: string[] = []) {
  return Array.isArray(value) && value.length > 0 && value.every((item) =>
    record(item) && fields.every((field) => text(item[field])) && listFields.every((field) => texts(item[field])) &&
    numberFields.every((field) => Number.isFinite(item[field]) && Number(item[field]) >= 0 && Number(item[field]) <= 100)
  );
}

export function getStructuredResult(payload: Record<string, unknown>, resultKey: string) {
  const data = payload.data;
  if (!record(data)) return null;
  return resultKey === "data" ? data : data[resultKey] ?? null;
}

export function isStructuredOutput(mode: AIMode, value: unknown): value is Record<string, unknown> {
  if (!record(value)) return false;
  if (mode === "mentor") return text(value.response);
  if (mode === "country") return entries(value.countries, ["name", "code", "description"], ["tags"], ["score"]);
  if (mode === "university") return entries(value.universities, ["name", "shortName", "country", "location", "ranking", "tuition", "type"], ["highlights"], ["match"]);
  if (mode === "scholarship") return entries(value.scholarships, ["name", "provider", "country", "amount", "coverage", "deadline", "type"], ["tags"], ["match"]);
  if (mode === "eligibility") {
    return Number.isFinite(value.score) && text(value.status) && text(value.summary) &&
      entries(value.breakdown, ["title", "status", "description"]) &&
      (value.breakdown as Array<Record<string, unknown>>).every((item) => item.status === "positive" || item.status === "caution") && texts(value.nextSteps);
  }
  if (mode === "cost") {
    const fields = ["tuition", "accommodation", "living", "insurance", "visa", "travel", "other", "total", "aiAnalysis"];
    return fields.every((field) => text(value[field])) && record(value.budgetStatus) &&
      text(value.budgetStatus.label) && text(value.budgetStatus.description);
  }
  return false;
}
