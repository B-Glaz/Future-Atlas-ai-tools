import { NextRequest, NextResponse } from "next/server";

import { canUseDatabaseTokenRpcs, isMissingSchemaError, refreshSignedAccessToken } from "@/lib/auth/signed-tokens";
import { withRequestLog } from "@/lib/security/request-log";
import { createPublicSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const POST = withRequestLog(async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") || 0) > 2_000) return new NextResponse(null, { status: 413 });
  const body = await request.json().catch(() => null) as { refreshToken?: unknown } | null;
  const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken.trim() : "";
  if (!refreshToken.startsWith("fa_rtk_")) return NextResponse.json({ error: "A valid refresh token is required." }, { status: 400 });

  const signed = refreshSignedAccessToken(refreshToken);
  if (canUseDatabaseTokenRpcs()) {
    const { data, error } = await createPublicSupabase().rpc("future_atlas_refresh_api_token", { p_refresh_token: refreshToken });
    if (!error) {
      const issued = Array.isArray(data) ? data[0] : data;
      if (issued) return NextResponse.json(issued, { headers: { "Cache-Control": "no-store" } });
    }
    if (error && !isMissingSchemaError(error) && !error.message?.includes("FA_INVALID_REFRESH_TOKEN")) {
      return NextResponse.json({ error: "Could not refresh the access token." }, { status: 503 });
    }
  }
  if (signed) return NextResponse.json(signed, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ error: "Refresh token is invalid or expired." }, { status: 401 });
});
