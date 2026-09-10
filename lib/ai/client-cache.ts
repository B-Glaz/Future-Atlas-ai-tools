"use client";

const CLIENT_CACHE_TTL_MS = 1000 * 60 * 10;

type CachedResponse<T> = {
  data: T;
  expiresAt: number;
};

const responseCache = new Map<string, CachedResponse<unknown>>();

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
      .map(
        ([key, item]) =>
          `${JSON.stringify(key)}:${stableStringify(item)}`
      )
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function getHash(value: string) {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

export function getAIClientCacheKey(payload: unknown) {
  return `future-atlas-ai-response:${getHash(stableStringify(payload))}`;
}

export function readAIClientCache<T>(cacheKey: string) {
  const cached = responseCache.get(cacheKey) as CachedResponse<T> | undefined;

  if (!cached || cached.expiresAt <= Date.now()) {
    responseCache.delete(cacheKey);
    return null;
  }

  return cached.data;
}

export function writeAIClientCache<T>(cacheKey: string, data: T) {
  responseCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + CLIENT_CACHE_TTL_MS,
  });
}

export function clearAIClientCache() {
  responseCache.clear();
}