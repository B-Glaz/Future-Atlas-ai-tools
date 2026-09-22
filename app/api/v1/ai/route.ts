export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { POST as handleAIRequest } from "../../ai/route";
import { normalizeOrigin } from "@/lib/security/embed-utils";
import { isTenantApiKey, isUserAccessToken } from "@/lib/auth/request-auth";
import { withRequestLog } from "@/lib/security/request-log";

export const POST = withRequestLog(function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() || "";
  const requestId = crypto.randomUUID();

  if (isUserAccessToken(token)) {
    return handleAIRequest(request);
  }

  if (!isTenantApiKey(token)) {
    return NextResponse.json(
      { error: { code: "FA_INVALID_API_KEY", message: "A tenant API key is required.", retryable: false, requestId } },
      { status: 401, headers: { "X-Request-ID": requestId } }
    );
  }
  if (!normalizeOrigin(request.headers.get("origin") || "")) {
    return NextResponse.json(
      { error: { code: "ORIGIN_REQUIRED", message: "Send the approved website Origin header.", retryable: false, requestId } },
      { status: 403, headers: { "X-Request-ID": requestId } }
    );
  }
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    return NextResponse.json(
      { error: { code: "FA_INVALID_IDEMPOTENCY_KEY", message: "Idempotency-Key must contain 8 to 128 characters.", retryable: false, requestId } },
      { status: 400, headers: { "X-Request-ID": requestId } }
    );
  }

  return handleAIRequest(request);
});
