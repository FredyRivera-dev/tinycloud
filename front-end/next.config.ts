import type { NextConfig } from "next";

// Same-origin proxy target. Next.js reads this file during `next build` and
// serializes the value into the standalone server, so docker builds pass it as
// a build arg and Vercel deployments set it in the project environment.
const apiProxyTarget = (
  process.env.API_PROXY_TARGET || "http://127.0.0.1:5950"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // Vercel uses its own build output; standalone is only needed for the Docker
  // image and other self-hosted deployments.
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  devIndicators: false,
  allowedDevOrigins: [
    "192.168.1.20",
    "192.168.1.20:3000",
    "localhost",
    "127.0.0.1",
    "192.168.1.20:*",
  ],
};

export default nextConfig;
