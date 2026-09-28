import type { NextConfig } from "next";

// Self-hostable, Node runtime only. No experimental or platform-specific features.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
