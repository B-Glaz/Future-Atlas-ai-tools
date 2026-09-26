import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) throw new Error("Supabase runtime configuration is missing.");
const supabaseUrl = url;
const supabaseKey = key;

function opaqueKeyFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("apikey", apiKey);
    if (apiKey.startsWith("sb_") && headers.get("authorization") === `Bearer ${apiKey}`) {
      headers.delete("authorization");
    }
    return fetch(input, { ...init, headers });
  };
}

function clientOptions(apiKey: string, extraHeaders?: Record<string, string>) {
  return {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: opaqueKeyFetch(apiKey),
      headers: extraHeaders,
    },
  };
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { fetch: opaqueKeyFetch(supabaseKey) },
});

export function createPublicSupabase() {
  return createClient(supabaseUrl, supabaseKey, clientOptions(supabaseKey));
}

export function createAdminSupabase() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not configured.");
  return createClient(supabaseUrl, secret, clientOptions(secret));
}

export function createRequestSupabase(accessToken: string) {
  return createClient(supabaseUrl, supabaseKey, clientOptions(supabaseKey, { Authorization: `Bearer ${accessToken}` }));
}

export function createAccessTokenSupabase(accessToken: string) {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not configured.");
  return createClient(supabaseUrl, secret, clientOptions(secret, { "x-future-atlas-token": accessToken }));
}

export type { SupabaseClient };
