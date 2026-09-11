import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(
  url || "https://nfcixmyfqhpenbocplaa.supabase.co",
  key || "sb_publishable_g1QMLujrPuKfhAjjQ-BM4w_JkF8AtVE"
);

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
