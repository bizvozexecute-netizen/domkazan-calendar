import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: { root: process.cwd() },
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "no-referrer" },
      ] },
      ...["/admin/:path*", "/api/admin/:path*"].map((source) => ({ source, headers: [
        { key: "Cache-Control", value: "no-store" }, { key: "X-Frame-Options", value: "DENY" },
      ] })),
    ];
  },
};

export default nextConfig;
