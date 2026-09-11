import type { NextRequest } from "next/server";

import { createRequestSupabase } from "@/lib/supabase";

export class CreditError extends Error {
  constructor(message: string, public status: number, public retryAfter?: number) {
    super(message);
  }
}

export async function consumeCredit(request: NextRequest, mode: string) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!accessToken) throw new CreditError("Sign in to use Future Atlas AI.", 401);

  const supabase = createRequestSupabase(accessToken);
  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

  if (userError || !user) throw new CreditError("Your session has expired. Please sign in again.", 401);

  const { error: usageError } = await supabase.from("future_atlas_ai_usage").insert({
    user_id: user.id,
    request_id: crypto.randomUUID(),
    mode,
  });

  if (usageError) {
    const cooldown = usageError.message.includes("wait 2 seconds");
    throw new CreditError(
      cooldown ? "Please wait 2 seconds before another AI request." : "Daily AI credits exhausted. Credits renew automatically within 24 hours.",
      429,
      cooldown ? 2 : undefined
    );
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("future_atlas_ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("used_at", since);

  return { userId: user.id, creditsRemaining: Math.max(0, 30 - (count ?? 1)) };
}
