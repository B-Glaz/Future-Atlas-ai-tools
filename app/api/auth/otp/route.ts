import { NextRequest, NextResponse } from "next/server";

import { createAdminSupabase, createPublicSupabase } from "@/lib/supabase";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 10;
const memory = new Map<string, number[]>();

function clientKey(request: NextRequest, email: string) {
  return `${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"}:${email.toLowerCase()}`;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const now = Date.now();
  const key = clientKey(request, email);
  const recent = (memory.get(key) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((recent[0] + WINDOW_MS - now) / 1000);
    return NextResponse.json({ error: "Too many OTP requests. Please try again later.", retryAfter }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }

  if (process.env.SUPABASE_SECRET_KEY) {
    try {
      const admin = createAdminSupabase();
      const { data: allowed, error: rateError } = await admin.rpc("future_atlas_authorize_otp_request", { p_key: key, p_window_started_at: new Date(now - WINDOW_MS).toISOString(), p_max_requests: MAX_REQUESTS });
      if (rateError) console.error(JSON.stringify({ event: "otp_rate_limit_failed", code: rateError.code }));
      if (rateError === null && allowed === false) return NextResponse.json({ error: "Too many OTP requests. Please try again later.", retryAfter: 3600 }, { status: 429, headers: { "Retry-After": "3600" } });
    } catch {
      // Local development falls back to the process limiter.
    }
  }

  const { error } = await createPublicSupabase().auth.signInWithOtp({ email, options: { shouldCreateUser: true, data: { full_name: name } } });
  if (error) return NextResponse.json({ error: error.message }, { status: 429 });
  recent.push(now);
  memory.set(key, recent);
  return NextResponse.json({ ok: true });
}
