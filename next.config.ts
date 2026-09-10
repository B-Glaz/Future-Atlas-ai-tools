import type { NextConfig } from "next";

function normalizeOrigin(value: string) {
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

function getEmbedFrameAncestors() {
  const allowedOrigins = (process.env.EMBED_ALLOWED_ORIGINS || "")
    .split(",")
    .map(normalizeOrigin)
    .filter((origin): origin is string => Boolean(origin));

  if (!allowedOrigins.length) {
    return "'none'";
  }

  return allowedOrigins.join(" ");
}

const protectedPageHeaders = [
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self';",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/",
        headers: protectedPageHeaders,
      },
      {
        source: "/countries/:path*",
        headers: protectedPageHeaders,
      },
      {
        source: "/universities/:path*",
        headers: protectedPageHeaders,
      },
      {
        source: "/scholarships/:path*",
        headers: protectedPageHeaders,
      },
      {
        source: "/cost-calculator/:path*",
        headers: protectedPageHeaders,
      },
      {
        source: "/eligibility/:path*",
        headers: protectedPageHeaders,
      },
      {
        source: "/embed/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${getEmbedFrameAncestors()};`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
