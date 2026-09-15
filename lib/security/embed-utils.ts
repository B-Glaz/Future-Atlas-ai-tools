export function normalizeOrigin(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) return null;

  try {
    const parsedUrl = new URL(trimmedValue);

    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return null;
    }

    return parsedUrl.origin;
  } catch {
    return null;
  }
}

export function getAllowedEmbedOrigins() {
  return (process.env.EMBED_ALLOWED_ORIGINS || "")
    .split(",")
    .map(normalizeOrigin)
    .filter((origin): origin is string => Boolean(origin));
}

export function getEmbedFrameAncestors() {
  const allowedOrigins = getAllowedEmbedOrigins();

  if (!allowedOrigins.length) {
    return "'none'";
  }

  return allowedOrigins.join(" ");
}

export function getRefererOrigin(referer: string | null) {
  if (!referer) return undefined;
  return normalizeOrigin(referer) || undefined;
}

export function getClientIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");

  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    forwardedFor?.split(",")[0]?.trim() ||
    undefined
  );
}