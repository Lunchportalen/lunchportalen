import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";
import { resolveNextDistDir } from "./lib/runtime/nextOutput";

const withNextIntl = createNextIntlPlugin();

/** Keep ORT native binaries out of Vercel serverless traces (250 MB cap). */
const ONNX_TRACE_EXCLUDES = [
  "node_modules/onnxruntime-node/**",
  "node_modules/onnxruntime-common/**",
] as const;

const sharedConfig: NextConfig = {
  typescript: {
    // Typecheck kjøres som egen enterprise gate før build.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Lint kjøres som egen enterprise gate før build.
    ignoreDuringBuilds: true,
  },
  /** Native ORT binaries are huge; keep them out of Vercel serverless traces (250 MB cap). */
  serverExternalPackages: ["onnxruntime-node"],
  outputFileTracingExcludes: {
    "/api/cron/autopilot": [...ONNX_TRACE_EXCLUDES],
    "/api/superadmin/control-tower/autopilot": [...ONNX_TRACE_EXCLUDES],
    "/api/revenue/autopilot": [...ONNX_TRACE_EXCLUDES],
    "/api/autonomy/revenue": [...ONNX_TRACE_EXCLUDES],
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

function buildNextConfig(phase: string): NextConfig {
  return {
    ...sharedConfig,
    distDir: resolveNextDistDir(phase),
    /**
     * Proxy Umbraco backoffice (ASP.NET host in `Umbraco/`, deployed via Azure Web App workflow) onto this app’s `/umbraco`.
     *
     * **Separation of concerns (env):**
     * - `UMBRACO_DELIVERY_BASE_URL` — server-side Delivery API only (`…/umbraco/delivery/api/…`).
     * - `UMBRACO_CMS_ORIGIN` — preferred origin for **this** rewrite when backoffice and Delivery are not the same host; scheme + host, no path.
     * - If `UMBRACO_CMS_ORIGIN` is unset, the rewrite falls back to the origin of `UMBRACO_DELIVERY_BASE_URL` (same host as Delivery).
     * - `UMBRACO_PUBLIC_SITE_URL` — documented canonical public origin for the Umbraco HTML site; not used in Next rewrites.
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
          destination: "https://lunchportalen.no/ai-motor-demo",
          permanent: true,
        },
        {
          source: "/public/demo/:path*",
          destination: "https://lunchportalen.no/ai-motor-demo",
          permanent: true,
        },
        {
          source: "/faq",
          destination: "https://lunchportalen.no/faq",
          permanent: true,
        },
        {
          source: "/hvordan",
          destination: "https://lunchportalen.no/hvordan",
          permanent: true,
        },
        {
          source: "/vilkar",
          destination: "https://lunchportalen.no/vilkar",
          permanent: true,
        },
        {
          source: "/personvern",
          destination: "https://lunchportalen.no/personvern",
          permanent: true,
        },
        {
          source: "/om-oss",
          destination: "https://lunchportalen.no/om-oss",
          permanent: true,
        },
        {
          source: "/investor",
          destination: "https://lunchportalen.no/investor",
          permanent: true,
        },
        {
          source: "/pitch",
          destination: "https://lunchportalen.no/pitch",
          permanent: true,
        },
        {
          source: "/ai-motor-demo",
          destination: "https://lunchportalen.no/ai-motor-demo",
          permanent: true,
        },
        {
          source: "/alternativ-til-kantine",
          destination: "https://lunchportalen.no/alternativ-til-kantine",
          permanent: true,
        },
        {
          source: "/lunsjordning",
          destination: "https://lunchportalen.no/lunsjordning",
          permanent: true,
        },
        {
          source: "/kontakt",
          destination: "https://lunchportalen.no/kontakt",
          permanent: true,
        },
        {
          source: "/priser",
          destination: "https://lunchportalen.no/priser",
          permanent: true,
        },
        {
          source: "/definitiv-guide-firmalunsj",
          destination: "https://lunchportalen.no/definitiv-guide-firmalunsj",
          permanent: true,
        },
        {
          source: "/hva-er-lunsjordning",
          destination: "https://lunchportalen.no/hva-er-lunsjordning",
          permanent: true,
        },
        {
          source: "/lunsj-levering-oslo",
          destination: "https://lunchportalen.no/lunsj-levering-oslo",
          permanent: true,
        },
        {
          source: "/lunch-levering-bergen",
          destination: "https://lunchportalen.no/lunch-levering-bergen",
          permanent: true,
        },
        {
          source: "/lunsjordning-trondheim",
          destination: "https://lunchportalen.no/lunsjordning-trondheim",
          permanent: true,
        },
        {
          source: "/sikkerhet",
          destination: "https://lunchportalen.no/sikkerhet",
          permanent: true,
        },
        {
          source: "/system-for-lunsjbestilling",
          destination: "https://lunchportalen.no/system-for-lunsjbestilling",
          permanent: true,
        },
      ];
    },
  };
}

export { buildNextConfig };

export default withSentryConfig(withNextIntl(buildNextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
