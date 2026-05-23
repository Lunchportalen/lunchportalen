import { afterEach, describe, expect, test } from "vitest";

import {
  Flow1DisabledError,
  isTripletexFlow1Enabled,
} from "@/lib/server/config/featureFlags";

describe("isTripletexFlow1Enabled", () => {
  const orig = process.env.TRIPLETEX_FLOW_1_ENABLED;

  afterEach(() => {
    if (orig === undefined) delete process.env.TRIPLETEX_FLOW_1_ENABLED;
    else process.env.TRIPLETEX_FLOW_1_ENABLED = orig;
  });

  test("returns false when env is missing", () => {
    delete process.env.TRIPLETEX_FLOW_1_ENABLED;
    expect(isTripletexFlow1Enabled()).toBe(false);
  });

  test.each(["false", "0", "no", "TRUE", "True", ""])("returns false when env=%s", (value) => {
    process.env.TRIPLETEX_FLOW_1_ENABLED = value;
    expect(isTripletexFlow1Enabled()).toBe(false);
  });

  test("returns true only for exact 'true'", () => {
    process.env.TRIPLETEX_FLOW_1_ENABLED = "true";
    expect(isTripletexFlow1Enabled()).toBe(true);
  });

  test("Flow1DisabledError has code FLOW1_DISABLED", () => {
    const err = new Flow1DisabledError();
    expect(err.code).toBe("FLOW1_DISABLED");
    expect(err.name).toBe("Flow1DisabledError");
    expect(err.message).toContain("not enabled");
  });
});
