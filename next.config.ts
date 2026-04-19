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
    /**
     * Proxy the real Umbraco backoffice (repo: `Umbraco/`, ASP.NET host) onto this app’s `/umbraco`.
     * Origin resolution:
     * - `UMBRACO_CMS_ORIGIN` if set (scheme + host, no path; optional override when backoffice ≠ Delivery host)
     * - else `UMBRACO_DELIVERY_BASE_URL` — same site origin as `lib/cms/umbraco/marketingAdapter.ts` (`…/umbraco/delivery/api/…`)
     * Auth is Umbraco backoffice — not Next `/backoffice`.
     */
    async rewrites() {
      const explicit = (process.env.UMBRACO_CMS_ORIGIN ?? "").trim().replace(/\/+$/, "");
      const fromDelivery = (process.env.UMBRACO_DELIVERY_BASE_URL ?? "").trim().replace(/\/+$/, "");
      const origin = explicit || fromDelivery;
      if (!origin) return [];
      return [
        { source: "/umbraco", destination: `${origin}/umbraco` },
        { source: "/umbraco/:path*", destination: `${origin}/umbraco/:path*` },
      ];
    },
    async redirects() {
      return [
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
