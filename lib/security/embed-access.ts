export type EmbedAccessDecision = {
  allowed: boolean;
  reason?: string;
  matchedOrigin?: string;
  detectedOrigin?: string;
  refererOrigin?: string;
  allowedOrigins: string[];
};

export type SecurityEventMetadata = {
  timestamp: string;
  path: string;
  detectedOrigin?: string;
  referer?: string;
  refererOrigin?: string;
  userAgent?: string;
  ip?: string;
  reason: string;
  clientId?: string;
};

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

export function evaluateEmbedAccess(headers: Headers): EmbedAccessDecision {
  const allowedOrigins = getAllowedEmbedOrigins();
  const detectedOrigin = normalizeOrigin(headers.get("origin") || "");
  const refererOrigin = getRefererOrigin(headers.get("referer"));

  if (!allowedOrigins.length) {
    return {
      allowed: false,
      reason: "No authorized iframe origins are configured.",
      detectedOrigin: detectedOrigin || undefined,
      refererOrigin,
      allowedOrigins,
    };
  }

  const matchedOrigin = [detectedOrigin, refererOrigin].find(
    (origin): origin is string =>
      Boolean(origin && allowedOrigins.includes(origin))
  );

  if (matchedOrigin) {
    return {
      allowed: true,
      detectedOrigin: detectedOrigin || undefined,
      refererOrigin,
      matchedOrigin,
      allowedOrigins,
    };
  }

  return {
    allowed: false,
    reason:
      detectedOrigin || refererOrigin
        ? "Detected origin is not in EMBED_ALLOWED_ORIGINS."
        : "No origin or referer signal was available for embed authorization.",
    detectedOrigin: detectedOrigin || undefined,
    refererOrigin,
    allowedOrigins,
  };
}

export function getSecurityEventMetadata(
  headers: Headers,
  path: string,
  reason: string
): SecurityEventMetadata {
  return {
    timestamp: new Date().toISOString(),
    path,
    detectedOrigin: normalizeOrigin(headers.get("origin") || "") || undefined,
    referer: headers.get("referer") || undefined,
    refererOrigin: getRefererOrigin(headers.get("referer")),
    userAgent: headers.get("user-agent") || undefined,
    ip: getClientIp(headers),
    reason,
  };
}
