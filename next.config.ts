import type { NextConfig } from "next";
import { resolveNextDistDir } from "./lib/runtime/nextOutput";

const sharedConfig: NextConfig = {
  /** Native ORT binaries are huge; keep them out of Vercel serverless traces (250 MB cap). */
  serverExternalPackages: ["onnxruntime-node"],
  outputFileTracingExcludes: {
    "/*": [
      "node_modules/onnxruntime-node/**",
      "node_modules/onnxruntime-common/**",
    ],
  },
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
    async redirects() {
      return [
        // Production alias: Umbraco CMS uses /umbraco; map to the existing Next backoffice surface.
        {
          source: "/umbraco",
          destination: "/backoffice",
          permanent: true,
        },
        {
          source: "/umbraco/:path*",
          destination: "/backoffice/:path*",
          permanent: true,
        },
        {
          source: "/registrer-firma",
          destination: "/registrering",
          permanent: true,
        },
        {
          source: "/public/demo",
          destination: "/ai-motor-demo",
          permanent: true,
        },
        {
          source: "/public/demo/:path*",
          destination: "/ai-motor-demo",
          permanent: true,
        },
      ];
    },
  };
}
