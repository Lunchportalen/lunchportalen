import type { NextConfig } from "next";
import { resolveNextDistDir } from "./lib/runtime/nextOutput";

const sharedConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/og/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default function nextConfig(phase: string): NextConfig {
  return {
    ...sharedConfig,
    distDir: resolveNextDistDir(phase),
  };
}
