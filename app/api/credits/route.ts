import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAuth } from "@/lib/auth/request-auth";
import { signedInCreditStatus } from "@/lib/ai/credits";
import { isMissingTable } from "@/lib/platform/credits/daily";
import { withRequestLog } from "@/lib/security/request-log";

export const dynamic = "force-dynamic";

export const GET = withRequestLog(async function GET(request: NextRequest) {
  const auth = await resolveRequestAuth(request);
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    return NextResponse.json(await signedInCreditStatus(auth.user.id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (isMissingTable(error as { code?: string; message?: string })) {
      return NextResponse.json({ credits_remaining: 0, pendingMigration: true }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Credit status unavailable." }, { status: 503 });
  }
});
