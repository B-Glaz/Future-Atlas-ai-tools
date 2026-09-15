import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(
  url || "https://nfcixmyfqhpenbocplaa.supabase.co",
  key || "sb_publishable_g1QMLujrPuKfhAjjQ-BM4w_JkF8AtVE"
);

export function createPublicSupabase() {
  return createClient(
    url || "https://nfcixmyfqhpenbocplaa.supabase.co",
    key || "sb_publishable_g1QMLujrPuKfhAjjQ-BM4w_JkF8AtVE",
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export function createAdminSupabase() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not configured.");
  return createClient(
    url || "https://nfcixmyfqhpenbocplaa.supabase.co",
    secret,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export function createRequestSupabase(accessToken: string) {
  return createClient(
    url || "https://nfcixmyfqhpenbocplaa.supabase.co",
    key || "sb_publishable_g1QMLujrPuKfhAjjQ-BM4w_JkF8AtVE",
    {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    }
  );
}
