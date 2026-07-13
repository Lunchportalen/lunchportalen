import { defineConfig } from "vitest/config";
import base from "./vitest.config";

/**
 * Opt-in config for `tests/rls/**` — base vitest.config excludes that tree so default `npm run test` stays fast.
 *
 * NOTE: `mergeConfig` concatenates arrays, which re-introduced the base
 * `tests/rls/**` exclude and made the suite unrunnable (0 files found).
 * We override `exclude` explicitly instead.
 */
export default defineConfig({
  ...base,
  test: {
    ...(base as { test?: Record<string, unknown> }).test,
    exclude: ((base as { test?: { exclude?: string[] } }).test?.exclude ?? []).filter(
      (p) => p !== "tests/rls/**",
    ),
  },
});
