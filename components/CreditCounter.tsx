"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthGate";
import { supabase } from "@/lib/supabase";

export default function CreditCounter() {
  const { user, requireAuth } = useAuth();
  const [remaining, setRemaining] = useState<number>();
  const [status, setStatus] = useState<"loading" | "ready" | "pending" | "unavailable">("loading");

  useEffect(() => {
    if (!user) return;
    const update = (event: Event) => {
      setRemaining(Math.floor((event as CustomEvent<number>).detail));
      setStatus("ready");
    };
    window.addEventListener("future-atlas:credits", update);
    if (user.id === "local-developer") {
      Promise.resolve().then(() => { setRemaining(30); setStatus("ready"); });
      return () => window.removeEventListener("future_atlas:credits", update);
    }
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        setStatus("unavailable");
        return;
      }
      const response = await fetch("/api/credits", { headers: { Authorization: `Bearer ${data.session.access_token}` } });
      const payload = await response.json().catch(() => null);
      if (response.ok && Number.isFinite(payload?.credits_remaining)) {
        setRemaining(Math.floor(payload.credits_remaining));
        setStatus("ready");
      } else {
        setStatus(payload?.pendingMigration ? "pending" : "unavailable");
      }
    });
    return () => window.removeEventListener("future-atlas:credits", update);
  }, [user]);

  if (!user) return <button type="button" onClick={() => requireAuth()} className="whitespace-nowrap text-xs font-semibold text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline" aria-label="Sign in to view AI credits">Sign in for credits</button>;
  if (status === "pending") return <span className="whitespace-nowrap text-xs font-medium text-amber-600" aria-label="Credits are waiting for database setup">Credits pending</span>;
  if (status === "unavailable") return <span className="whitespace-nowrap text-xs font-medium text-rose-500" aria-label="Credits unavailable">Credits unavailable</span>;
  return <span className="whitespace-nowrap text-xs font-medium text-slate-500" aria-label={`${remaining ?? "Loading"} AI credits remaining today`}>{remaining ?? "Loading"} credits today</span>;
}
