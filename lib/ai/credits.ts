import type { NextRequest } from "next/server";

import { createPublicSupabase, createRequestSupabase } from "@/lib/supabase";
import { creditQuarters, secondsUntilKolkataMidnight } from "@/lib/ai/credit-policy";

export class CreditError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public retryAfter?: number
  ) {
    super(message);
  }
}

type Authorization = {
  requestId: string;
  cacheScope: string;
  creditsRemaining: number;
  replayStatus: string;
  replayPayload: Record<string, unknown> | null;
  apiKey: string;
  mode: string;
  guest?: boolean;
  guestIdentity?: string;
};

const GUEST_DAILY_LIMIT = 30;
type GuestBucket = { count: number; resetAt: number };
const guestBuckets = ((globalThis as typeof globalThis & { futureAtlasGuestBuckets?: Map<string, GuestBucket> }).futureAtlasGuestBuckets ??= new Map());

function guestKey(request: NextRequest) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function consumeGuestCredit(request: NextRequest, identity?: string): Authorization {
  const now = Date.now();
  const key = identity || guestKey(request);
  const bucket = guestBuckets.get(key);
  const active = bucket && bucket.resetAt > now ? bucket : { count: 0, resetAt: now + 86_400_000 };

  if (active.count >= GUEST_DAILY_LIMIT) {
    throw new CreditError("Guest AI limit reached. Please try again tomorrow.", 429, "FA_DAILY_LIMIT", Math.ceil((active.resetAt - now) / 1000));
  }

  active.count += 1;
  guestBuckets.set(key, active);

  return {
    requestId: crypto.randomUUID(),
    cacheScope: `guest:${key}`,
    creditsRemaining: GUEST_DAILY_LIMIT - active.count,
    replayStatus: "new",
    replayPayload: null,
    apiKey: "",
    mode: "guest",
    guest: true,
    guestIdentity: key,
  };
}

export function guestCreditStatus(request: NextRequest, identity?: string) {
  const now = Date.now();
  const key = identity || guestKey(request);
  const bucket = guestBuckets.get(key);
  const active = bucket && bucket.resetAt > now ? bucket : { count: 0, resetAt: now + 86_400_000 };
  return { credits_remaining: Math.max(0, GUEST_DAILY_LIMIT - active.count), reset_at: new Date(active.resetAt).toISOString() };
}

function releaseGuestCredit(authorization: Authorization) {
  if (!authorization.guestIdentity) return;
  const bucket = guestBuckets.get(authorization.guestIdentity);
  if (bucket && bucket.count > 0) bucket.count -= 1;
}
const errors: Record<string, [number, string, number?]> = {
  FA_AUTH_REQUIRED: [401, "Sign in or provide a valid API key."],
  FA_INVALID_API_KEY: [401, "Invalid or expired API key."],
  FA_TENANT_DISABLED: [403, "Tenant access is disabled."],
  FA_ORIGIN_FORBIDDEN: [403, "This origin is not authorized for this tenant."],
  FA_INVALID_IDEMPOTENCY_KEY: [400, "Idempotency-Key must contain 8 to 128 characters."],
  FA_IDEMPOTENCY_CONFLICT: [409, "Idempotency-Key was already used for another request."],
  FA_RATE_LIMIT: [429, "Please wait before another AI request.", 1],
  FA_USER_BUSY: [429, "Two AI requests are already running for this account.", 5],
  FA_TENANT_BUSY: [429, "Tenant AI capacity is busy.", 5],
  FA_GLOBAL_BUSY: [503, "Future Atlas is handling high demand.", 8],
  FA_DAILY_LIMIT: [429, "Daily AI credits exhausted. Credits renew within 24 hours."],
};

function creditError(message: string) {
  const code = Object.keys(errors).find((item) => message.includes(item)) || "FA_ADMISSION_FAILED";
  const [status, configuredMessage, configuredRetryAfter] = errors[code] || [503, "AI admission is temporarily unavailable."];
  const retryAfter = code === "FA_DAILY_LIMIT" ? secondsUntilKolkataMidnight() : configuredRetryAfter;
  const publicMessage = code === "FA_DAILY_LIMIT" ? `Daily AI credits exhausted. Credits renew in ${Math.ceil(retryAfter! / 3600)} hours.` : configuredMessage;
  return new CreditError(publicMessage, status, code, retryAfter);
}

function isMissingUserCreditRpc(error: { code?: string; message?: string }) {
  return error.code === "PGRST202" || error.code === "42883" ||
    Boolean(error.message?.includes("future_atlas_authorize_user_request"));
}

export async function consumeCredit(
  request: NextRequest,
  mode: string,
  requestHash: string
): Promise<Authorization> {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!accessToken) return consumeGuestCredit(request);

  const apiKey = accessToken.startsWith("fa_") ? accessToken : "";
  const client = apiKey ? createPublicSupabase() : createRequestSupabase(accessToken);
  let authenticatedUserId = "";

  if (!apiKey) {
    const { data: { user }, error } = await client.auth.getUser(accessToken);
    if (error || !user) throw new CreditError("Your session has expired. Please sign in again.", 401, "FA_AUTH_REQUIRED");
    authenticatedUserId = user.id;
  }

  const requestId = crypto.randomUUID();
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() || requestId;
  const origin = request.headers.get("origin");
  const { data, error } = apiKey
    ? await client.rpc("future_atlas_authorize_request", { p_api_key: apiKey, p_request_id: requestId, p_idempotency_key: idempotencyKey, p_tool: mode, p_request_hash: requestHash, p_origin: origin })
    : await client.rpc("future_atlas_authorize_user_request", { p_request_id: requestId, p_idempotency_key: idempotencyKey, p_tool: mode, p_request_hash: requestHash });

  if (error && !apiKey && isMissingUserCreditRpc(error)) {
    console.warn(JSON.stringify({ event: "user_credit_schema_pending", code: error.code }));
    return consumeGuestCredit(request, `user:${authenticatedUserId}`);
  }
  if (error) throw creditError(error.message);
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) throw new CreditError("AI admission is temporarily unavailable.", 503, "FA_ADMISSION_FAILED");

  return {
    requestId: result.request_id,
    cacheScope: result.cache_scope,
    creditsRemaining: result.credits_remaining,
    replayStatus: result.replay_status,
    replayPayload: result.replay_payload,
    apiKey,
    mode,
  };
}

export async function completeCreditRequest(
  request: NextRequest,
  authorization: Authorization,
  status: "completed" | "failed",
  payload?: Record<string, unknown>,
  details?: { errorCode?: string; provider?: string; durationMs?: number }
) {
  if (authorization.guest) {
    if (status === "failed") releaseGuestCredit(authorization);
    return;
  }
  const bearer = request.headers.get("authorization")?.slice(7).trim() || "";
  const client = authorization.apiKey ? createPublicSupabase() : createRequestSupabase(bearer);
  const { data, error } = authorization.apiKey
    ? await client.rpc("future_atlas_complete_request", { p_request_id: authorization.requestId, p_api_key: authorization.apiKey, p_status: status, p_result_payload: payload || null, p_error_code: details?.errorCode || null, p_provider: details?.provider || null, p_duration_ms: details?.durationMs || null })
    : await client.rpc("future_atlas_complete_user_request", { p_request_id: authorization.requestId, p_status: status, p_result_payload: payload || null, p_error_code: details?.errorCode || null, p_provider: details?.provider || null, p_duration_ms: details?.durationMs || null, p_credit_quarters: creditQuarters(authorization.mode, payload) });
  if (error) console.error(JSON.stringify({ event: "ai_request_completion_failed", requestId: authorization.requestId, code: error.code }));
  if (!error && !authorization.apiKey && payload && Number.isFinite(data)) payload.creditsRemaining = Number(data);
}
