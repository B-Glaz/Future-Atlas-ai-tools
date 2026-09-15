import type { NextConfig } from "next";

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
    ];
  },
};

export default nextConfig;
