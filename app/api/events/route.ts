import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

const EVENTS = new Set(["page_view", "tool_result", "guidance_open", "forum_cta"]);

export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") || 0) > 8_000) return new NextResponse(null, { status: 413 });
  const body = await request.json().catch(() => null);
  if (!body || !EVENTS.has(body.event) || !["necessary", "additional"].includes(body.category) || !/^[0-9a-f-]{36}$/i.test(body.anonymousId || "")) return new NextResponse(null, { status: 400 });
  const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {};
  try {
    const admin = createAdminSupabase();
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    const user = token ? (await admin.auth.getUser(token)).data.user : null;
    const { error } = await admin.from("future_atlas_events").insert({ user_id: user?.id || null, anonymous_id: body.anonymousId, event_name: body.event, category: body.category, metadata });
    return new NextResponse(null, { status: error ? 503 : 204 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
