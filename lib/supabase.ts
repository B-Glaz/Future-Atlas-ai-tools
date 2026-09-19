import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) throw new Error("Supabase runtime configuration is missing.");
const supabaseUrl = url;
const supabaseKey = key;

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

export function createPublicSupabase() {
  return createClient(
    supabaseUrl,
    supabaseKey,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export function createAdminSupabase() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not configured.");
  return createClient(
    supabaseUrl,
    secret,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export function createRequestSupabase(accessToken: string) {
  return createClient(
    supabaseUrl,
    supabaseKey,
    {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    }
  );
}
