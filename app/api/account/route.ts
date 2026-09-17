import { NextRequest, NextResponse } from "next/server";

import { createAdminSupabase, createRequestSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function token(request: NextRequest) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
}

export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") || 0) > 128_000) return new NextResponse(null, { status: 413 });
  const accessToken = token(request);
  if (!accessToken) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.history !== "object" || Array.isArray(body.history)) return NextResponse.json({ error: "Valid history required." }, { status: 400 });
  if (JSON.stringify(body.history).length > 128_000) return new NextResponse(null, { status: 413 });

  try {
    const admin = createAdminSupabase();
    const { data: { user } } = await admin.auth.getUser(accessToken);
    if (!user) return NextResponse.json({ error: "Session expired." }, { status: 401 });
    const { error } = await admin.from("future_atlas_history_backups").upsert({
      user_id: user.id,
      history: body.history,
      consent: typeof body.consent === "string" ? body.consent.slice(0, 20) : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    return new NextResponse(null, { status: error ? 503 : 204 });
  } catch {
    return NextResponse.json({ error: "History backup unavailable." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const accessToken = token(request);
  if (!accessToken) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const client = createRequestSupabase(accessToken);
    const { data: { user } } = await client.auth.getUser(accessToken);
    if (!user) return NextResponse.json({ error: "Session expired." }, { status: 401 });
    const { error } = await client.rpc("future_atlas_delete_my_data");
    if (error) return NextResponse.json({ error: "Account data deletion failed." }, { status: 503 });
    const { error: authError } = await createAdminSupabase().auth.admin.deleteUser(user.id);
    return new NextResponse(null, { status: authError ? 503 : 204 });
  } catch {
    return NextResponse.json({ error: "Account deletion unavailable." }, { status: 503 });
  }
}
