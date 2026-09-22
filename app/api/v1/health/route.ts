import { NextResponse } from "next/server";
import { withRequestLog } from "@/lib/security/request-log";

export const dynamic = "force-dynamic";

export const GET = withRequestLog(function GET() {
  const requestId = crypto.randomUUID();
  const databaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const aiConfigured = Boolean(process.env.AI_API_KEY || process.env.NVIDIA_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY) && process.env.AI_ENABLED !== "false";
  const ready = databaseConfigured && aiConfigured;
  return NextResponse.json(
    { status: ready ? "ready" : "degraded", services: { databaseConfigured, aiConfigured }, requestId },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store", "X-Request-ID": requestId } }
  );
});
