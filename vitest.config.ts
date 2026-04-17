// vitest.config.ts
import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

// Normalize test environment so local and CI behave the same (isTestEnv(), testDefaults, etc.)
if (!process.env["NODE_ENV"]) {
  Object.assign(process.env, { NODE_ENV: "test" });
}
Object.assign(process.env, { VITEST: "true" });
// Runner profitability gate uses live margin/budget math; disable in Vitest unless a test sets it explicitly.
if (process.env.AI_PROFITABILITY_ENABLED === undefined) {
  Object.assign(process.env, { AI_PROFITABILITY_ENABLED: "false" });
}

// Local: load .env.local then .env. CI: env comes from workflow env (no .env required).
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

// Dev .env.local often sets LP_CMS_RUNTIME_MODE=local_provider. That short-circuits CMS loaders
// (e.g. getContentBySlug → local provider) before supabaseAdmin mocks apply, breaking unit tests.
// Tests that need a runtime mode must vi.stubEnv(...) explicitly.
for (const key of [
  "LP_CMS_RUNTIME_MODE",
  "LP_LOCAL_CMS_RUNTIME",
  "LOCAL_CMS_RUNTIME_MODE",
  "LOCAL_DEV_CONTENT_RESERVE",
  "LP_MARKETING_CMS_SOURCE",
  "LP_MARKETING_UMBRACO_EXTRA_SLUG",
  "UMBRACO_DELIVERY_BASE_URL",
  "UMBRACO_DELIVERY_API_KEY",
  "UMBRACO_DELIVERY_START_ITEM",
] as const) {
  delete process.env[key];
}

// Fail-closed: surface async failures that would otherwise warn-only in the runner.
process.on("unhandledRejection", (reason) => {
  console.error("[vitest] unhandledRejection", reason);
  throw reason instanceof Error ? reason : new Error(String(reason));
});
process.on("uncaughtException", (err) => {
  console.error("[vitest] uncaughtException", err);
  throw err;
});

export default defineConfig({
  plugins: [
    // ✅ gjør at @/… resolves via tsconfig.json paths (samme som Next)
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      // ✅ FIKS: Vitest kjenner ikke "server-only" (Next.js helper)
      // Mapper til tom mock slik at tester ikke krasjer
      "server-only": path.resolve(__dirname, "tests/_mocks/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    testTimeout: 120000,
    hookTimeout: 120000,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // Vitest: kjør bare unit/integration.
    // - E2E-spesifikasjoner i `e2e/` kjøres av Playwright (playwright.config.ts).
    // - Playwright sine *.spec.ts-filer i `e2e/` skal aldri plukkes opp av Vitest.
    // - Tunge RLS-end-to-end tester i `tests/rls/**` er eksplisitt opt-in via egen npm-script.
    exclude: [
      "e2e/**",
      "tests/rls/**",
      "**/*.spec.ts",
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "studio/node_modules/**",
      "studio/lunchportalen-studio/node_modules/**",
    ],
  },
});
