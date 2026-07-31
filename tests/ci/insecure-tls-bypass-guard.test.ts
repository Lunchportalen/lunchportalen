import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const WORKFLOW = resolve(
  process.cwd(),
  ".github/workflows/norway-menu-capacity-production-e2e.yml",
);
const ENTERPRISE_WORKFLOW = resolve(
  process.cwd(),
  ".github/workflows/norway-enterprise-production-acceptance.yml",
);

describe("insecure TLS bypass guard", () => {
  test("norway menu/capacity production E2E workflow does not set NODE_TLS_REJECT_UNAUTHORIZED=0", () => {
    const src = readFileSync(WORKFLOW, "utf8");
    expect(src).not.toMatch(/NODE_TLS_REJECT_UNAUTHORIZED\s*:\s*["']?0["']?/);
    expect(src).toContain("INSECURE_TLS_BYPASS");
  });

  test("norway enterprise acceptance workflow does not set NODE_TLS_REJECT_UNAUTHORIZED=0", () => {
    const src = readFileSync(ENTERPRISE_WORKFLOW, "utf8");
    expect(src).not.toMatch(/NODE_TLS_REJECT_UNAUTHORIZED\s*:\s*["']?0["']?/);
  });
});
