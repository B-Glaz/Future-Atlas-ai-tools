import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAuth } from "@/lib/auth/request-auth";
import { guestCreditStatus } from "@/lib/ai/credits";
import { withRequestLog } from "@/lib/security/request-log";

export const dynamic = "force-dynamic";

export const GET = withRequestLog(async function GET(request: NextRequest) {
  const auth = await resolveRequestAuth(request);
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { data, error } = await auth.client.rpc("future_atlas_credit_status");
  if (error?.code === "PGRST202" || error?.code === "42883" || error?.message.includes("future_atlas_credit_status")) {
    return NextResponse.json({ ...guestCreditStatus(request, auth.user.id), pendingMigration: true }, { headers: { "Cache-Control": "no-store" } });
  }
  if (error) return NextResponse.json({ error: "Credit status unavailable." }, { status: 503 });
  return NextResponse.json(Array.isArray(data) ? data[0] : data, { headers: { "Cache-Control": "no-store" } });
});
