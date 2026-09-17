export type ConsentLevel = "necessary" | "additional";

export async function trackEvent(event: string, metadata: Record<string, unknown> = {}, category: ConsentLevel = "necessary") {
  if (typeof window === "undefined") return;
  const consent = localStorage.getItem("future-atlas:consent");
  if (!consent || (category === "additional" && consent !== "additional")) return;
  const anonymousId = localStorage.getItem("future-atlas:anonymous-id") || crypto.randomUUID();
  localStorage.setItem("future-atlas:anonymous-id", anonymousId);
  const { data } = await supabase.auth.getSession();
  void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json", ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}) }, body: JSON.stringify({ event, category, anonymousId, metadata }), keepalive: true });
}
import { supabase } from "@/lib/supabase";
