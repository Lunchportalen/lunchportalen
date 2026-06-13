import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config";

/**
 * Opt-in config for `tests/rls/**` — base vitest.config excludes that tree so default `npm run test` stays fast.
 */
export default mergeConfig(
  base,
  defineConfig({
    test: {
      exclude: (base.test?.exclude ?? []).filter((p) => p !== "tests/rls/**"),
    },
  }),
);
