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
     * Proxy Umbraco backoffice (ASP.NET host in `Umbraco/`, deployed via Azure Web App workflow) onto this app’s `/umbraco`.
     *
     * **Separation of concerns (env):**
     * - `UMBRACO_DELIVERY_BASE_URL` — server-side Delivery API only (`…/umbraco/delivery/api/…`), see `lib/cms/umbraco/marketingAdapter.ts`.
     * - `UMBRACO_CMS_ORIGIN` — preferred origin for **this** rewrite when backoffice and Delivery are not the same host; scheme + host, no path.
     * - If `UMBRACO_CMS_ORIGIN` is unset, the rewrite falls back to the origin of `UMBRACO_DELIVERY_BASE_URL` (same host as Delivery).
     * - `UMBRACO_PUBLIC_SITE_URL` — canonical public origin for middleware redirect of marketing paths to Umbraco HTML (see `docs/architecture/PUBLIC_SITE_AND_APP_BOUNDARIES.md`); not used in rewrites.
     *
     * Without at least one of `UMBRACO_CMS_ORIGIN` / `UMBRACO_DELIVERY_BASE_URL`, no `/umbraco` proxy exists → `/umbraco` is handled by Next and typically 404s.
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
