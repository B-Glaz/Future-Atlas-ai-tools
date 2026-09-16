export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { POST as handleAIRequest } from "../../ai/route";

export function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() || "";
  const requestId = crypto.randomUUID();

  if (!token.startsWith("fa_test_") && !token.startsWith("fa_live_")) {
    return NextResponse.json(
      { error: { code: "FA_INVALID_API_KEY", message: "A tenant API key is required.", retryable: false, requestId } },
      { status: 401, headers: { "X-Request-ID": requestId } }
    );
  }
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    return NextResponse.json(
      { error: { code: "FA_INVALID_IDEMPOTENCY_KEY", message: "Idempotency-Key must contain 8 to 128 characters.", retryable: false, requestId } },
      { status: 400, headers: { "X-Request-ID": requestId } }
    );
  }

  return handleAIRequest(request);
}
