import { NextRequest, NextResponse } from "next/server";
import { createRequestSupabase } from "@/lib/supabase";
import { guestCreditStatus } from "@/lib/ai/credits";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const client = createRequestSupabase(token);
  const { data: auth } = await client.auth.getUser(token);
  if (!auth.user) return NextResponse.json({ error: "Session expired." }, { status: 401 });
  const { data, error } = await client.rpc("future_atlas_credit_status");
  if (error?.code === "PGRST202" || error?.code === "42883" || error?.message.includes("future_atlas_credit_status")) {
    return NextResponse.json({ ...guestCreditStatus(request, auth.user.id), pendingMigration: true }, { headers: { "Cache-Control": "no-store" } });
  }
  if (error) return NextResponse.json({ error: "Credit status unavailable." }, { status: 503 });
  return NextResponse.json(Array.isArray(data) ? data[0] : data, { headers: { "Cache-Control": "no-store" } });
}
