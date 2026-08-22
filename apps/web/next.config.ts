import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: [
    "@label-normalizer/config",
    "@label-normalizer/core",
    "@label-normalizer/ui",
  ],
};

export default nextConfig;
