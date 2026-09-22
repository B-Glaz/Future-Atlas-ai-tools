import { NextRequest, NextResponse } from "next/server";

import { bearerToken } from "@/lib/auth/request-auth";
import { inspectSignedToken, isMissingSchemaError, isSignedApiToken } from "@/lib/auth/signed-tokens";
import { withRequestLog } from "@/lib/security/request-log";
import { createPublicSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const POST = withRequestLog(async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") || 0) > 2_000) return new NextResponse(null, { status: 413 });
  const body = await request.json().catch(() => null) as { token?: unknown } | null;
  const token = (typeof body?.token === "string" ? body.token.trim() : "") || bearerToken(request);
  if (!token) return NextResponse.json({ error: "A token is required." }, { status: 400 });

  if (isSignedApiToken(token)) {
    const inspected = inspectSignedToken(token);
    return NextResponse.json(
      { valid: inspected.valid, token_type: inspected.token_type, expires_at: inspected.expires_at },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const { data, error } = await createPublicSupabase().rpc("future_atlas_inspect_api_token", { p_token: token });
  if (isMissingSchemaError(error)) {
    const inspected = inspectSignedToken(token);
    return NextResponse.json(
      { valid: inspected.valid, token_type: inspected.token_type, expires_at: inspected.expires_at },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
  if (error) return NextResponse.json({ error: "Could not check token validity." }, { status: 503 });
  return NextResponse.json(Array.isArray(data) ? data[0] : data, { headers: { "Cache-Control": "no-store" } });
});
