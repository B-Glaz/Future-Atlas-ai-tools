import { NextRequest, NextResponse } from "next/server";

import { resolveRequestAuth } from "@/lib/auth/request-auth";
import { canUseDatabaseTokenRpcs, isMissingSchemaError, issueSignedTokens, revokeSignedTokens } from "@/lib/auth/signed-tokens";
import { withRequestLog } from "@/lib/security/request-log";
import { createAdminSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function firstRow<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] || null;
  return data;
}

export const GET = withRequestLog(async function GET(request: NextRequest) {
  const auth = await resolveRequestAuth(request);
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (canUseDatabaseTokenRpcs()) {
    const { data, error } = await auth.client.rpc("future_atlas_api_token_status");
    if (isMissingSchemaError(error)) {
      return NextResponse.json({ has_active_refresh: false, access_expires_at: null, refresh_expires_at: null }, { headers: { "Cache-Control": "no-store" } });
    }
    if (error) return NextResponse.json({ error: "Token status unavailable." }, { status: 503 });
    return NextResponse.json(firstRow(data), { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ has_active_refresh: false, access_expires_at: null, refresh_expires_at: null }, { headers: { "Cache-Control": "no-store" } });
});

export const POST = withRequestLog(async function POST(request: NextRequest) {
  const auth = await resolveRequestAuth(request);
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (auth.kind !== "session") return NextResponse.json({ error: "Sign in to generate API tokens." }, { status: 403 });
  if (canUseDatabaseTokenRpcs()) {
    const { data, error } = await auth.client.rpc("future_atlas_issue_api_tokens");
    if (!error) {
      const issued = firstRow(data);
      if (issued) return NextResponse.json(issued, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    if (error && !isMissingSchemaError(error)) return NextResponse.json({ error: "Could not generate API tokens." }, { status: 503 });
  }
  return NextResponse.json(issueSignedTokens(auth.user.id), { status: 201, headers: { "Cache-Control": "no-store" } });
});

export const DELETE = withRequestLog(async function DELETE(request: NextRequest) {
  if (Number(request.headers.get("content-length") || 0) > 4_000) return new NextResponse(null, { status: 413 });
  const body = await request.json().catch(() => ({})) as { accessToken?: unknown; refreshToken?: unknown; all?: unknown };
  const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
  const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken.trim() : "";
  const revokeAll = body.all === true;
  if (!revokeAll && !accessToken && !refreshToken) return NextResponse.json({ error: "Provide an access token, refresh token, or all." }, { status: 400 });

  const auth = await resolveRequestAuth(request);
  if (revokeAll && auth?.kind !== "session") return NextResponse.json({ error: "Sign in to revoke all API tokens." }, { status: 401 });

  const signedRevoked = revokeSignedTokens({
    accessToken: accessToken || undefined,
    refreshToken: refreshToken || undefined,
    all: revokeAll,
    userId: auth?.user.id,
  });

  try {
    if (!canUseDatabaseTokenRpcs()) return NextResponse.json({ revoked: signedRevoked });
    const client = auth?.client || createAdminSupabase();
    const { data, error } = await client.rpc("future_atlas_revoke_api_tokens", {
      p_access_token: accessToken || null,
      p_refresh_token: refreshToken || null,
      p_all: revokeAll,
    });
    if (isMissingSchemaError(error)) return NextResponse.json({ revoked: signedRevoked });
    if (error) return NextResponse.json({ error: "Could not revoke tokens." }, { status: 503 });
    return NextResponse.json({ revoked: data === true || signedRevoked });
  } catch {
    if (signedRevoked) return NextResponse.json({ revoked: true });
    return NextResponse.json({ error: "Token revocation unavailable." }, { status: 503 });
  }
});
