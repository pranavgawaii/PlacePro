import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    // Next 15.5 enables the segment explorer in dev by default. It is crashing
    // this workspace with missing React client manifest entries.
    devtoolSegmentExplorer: false,
    // Avoid stale server-component HMR cache artifacts when the local dev
    // server is restarted or .next is cleaned during active development.
    serverComponentsHmrCache: false
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }

    return config;
  }
};

export default nextConfig;
