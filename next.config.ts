import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: [
    "**.run.app",
    "*.run.app",
    "**.googleusercontent.com",
    "127.0.0.1",
    "localhost",
  ],
  async headers() {
    return [
      {
        source: "/staff/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
