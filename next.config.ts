import type { NextConfig } from "next";
import firebaseAppletConfig from "./firebase-applet-config.json";

const upstreamAuthDomain = firebaseAppletConfig.authDomain;

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
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: `https://${upstreamAuthDomain}/__/auth/:path*`,
      },
      {
        source: "/__/firebase/:path*",
        destination: `https://${upstreamAuthDomain}/__/firebase/:path*`,
      },
    ];
  },
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
