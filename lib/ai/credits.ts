import type { NextRequest } from "next/server";

import { createPublicSupabase, createRequestSupabase } from "@/lib/supabase";

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
};

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
  const [status, publicMessage, retryAfter] = errors[code] || [503, "AI admission is temporarily unavailable."];
  return new CreditError(publicMessage, status, code, retryAfter);
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

  if (!accessToken) throw new CreditError("Sign in or provide a valid API key.", 401, "FA_AUTH_REQUIRED");

  const apiKey = accessToken.startsWith("fa_") ? accessToken : "";
  const client = apiKey ? createPublicSupabase() : createRequestSupabase(accessToken);

  if (!apiKey) {
    const { data: { user }, error } = await client.auth.getUser(accessToken);
    if (error || !user) throw new CreditError("Your session has expired. Please sign in again.", 401, "FA_AUTH_REQUIRED");
  }

  const requestId = crypto.randomUUID();
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() || requestId;
  const origin = request.headers.get("origin");
  const { data, error } = await client.rpc("future_atlas_authorize_request", {
    p_api_key: apiKey || null,
    p_request_id: requestId,
    p_idempotency_key: idempotencyKey,
    p_tool: mode,
    p_request_hash: requestHash,
    p_origin: apiKey ? origin : null,
  });

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
  };
}

export async function completeCreditRequest(
  request: NextRequest,
  authorization: Authorization,
  status: "completed" | "failed",
  payload?: Record<string, unknown>,
  details?: { errorCode?: string; provider?: string; durationMs?: number }
) {
  const bearer = request.headers.get("authorization")?.slice(7).trim() || "";
  const client = authorization.apiKey ? createPublicSupabase() : createRequestSupabase(bearer);
  const { error } = await client.rpc("future_atlas_complete_request", {
    p_request_id: authorization.requestId,
    p_api_key: authorization.apiKey || null,
    p_status: status,
    p_result_payload: payload || null,
    p_error_code: details?.errorCode || null,
    p_provider: details?.provider || null,
    p_duration_ms: details?.durationMs || null,
  });
  if (error) console.error(JSON.stringify({ event: "ai_request_completion_failed", requestId: authorization.requestId, code: error.code }));
}
