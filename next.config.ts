import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/ai-music",
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
