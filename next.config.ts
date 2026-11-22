import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["*.run.app", "127.0.0.1", "localhost"],
};

export default nextConfig;
