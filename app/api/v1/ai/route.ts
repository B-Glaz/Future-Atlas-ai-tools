export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { POST as handleAIRequest } from "../../ai/route";
import { isUserAccessToken } from "@/lib/auth/request-auth";
import { withRequestLog } from "@/lib/security/request-log";

export const POST = withRequestLog(function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  const requestId = crypto.randomUUID();

  if (!isUserAccessToken(token)) {
    return NextResponse.json(
      { error: { code: "FA_INVALID_API_KEY", message: "A valid API access token is required.", retryable: false, requestId } },
      { status: 401, headers: { "X-Request-ID": requestId } }
    );
  }

  return handleAIRequest(request);
});
