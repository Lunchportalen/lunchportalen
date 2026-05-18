import type { UserConfig } from "vitest/config";
import base from "./vitest.config";

const cfg = base as UserConfig;
const exclude = (cfg.test?.exclude ?? []).filter((p) => p !== "tests/rls/**");

/**
 * Opt-in config for `tests/rls/**` — base vitest.config excludes that tree so default `npm run test` stays fast.
 */
const out: UserConfig = {
  ...cfg,
  test: {
    ...cfg.test,
    exclude,
  },
};

export default out;
