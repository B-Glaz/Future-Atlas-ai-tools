export class AIRequestError extends Error {
  retryAfterSeconds?: number;

  constructor(message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "AIRequestError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type AIRequestOptions = {
  timeoutMs?: number;
};

export async function requestAI<T>(
  body: Record<string, unknown>,
  { timeoutMs = 55_000 }: AIRequestOptions = {}
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { supabase } = await import("@/lib/supabase");
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new AIRequestError("Sign in to use Future Atlas AI.");
    }

    const response = await fetch("/api/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new AIRequestError(
        payload?.error || "The AI service could not complete this request.",
        Number(response.headers.get("Retry-After")) || undefined
      );
    }

    if (!payload || typeof payload !== "object") {
      throw new AIRequestError("The AI service returned an empty response.");
    }

    return payload as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AIRequestError(
        "The AI service took too long to respond. Please try again."
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
