// @ts-nocheck
import { describe, test, expect } from "vitest";
import fs from "node:fs";

const B8_ROUTES = [
  { path: "/api/ai/continue", file: "app/api/ai/continue/route.ts", method: "POST" },
  { path: "/api/ai/copilot", file: "app/api/ai/copilot/route.ts", method: "POST" },
  { path: "/api/ai/dashboard", file: "app/api/ai/dashboard/route.ts", method: "GET" },
  { path: "/api/ai/design/analyze", file: "app/api/ai/design/analyze/route.ts", method: "POST" },
  { path: "/api/ai/design/generate", file: "app/api/ai/design/generate/route.ts", method: "POST" },
  { path: "/api/ai/growth/ads", file: "app/api/ai/growth/ads/route.ts", method: "POST" },
  { path: "/api/ai/growth/funnel", file: "app/api/ai/growth/funnel/route.ts", method: "POST" },
  { path: "/api/ai/growth/seo", file: "app/api/ai/growth/seo/route.ts", method: "POST" },
  { path: "/api/ai/inline", file: "app/api/ai/inline/route.ts", method: "POST" },
  { path: "/api/ai/page/audit", file: "app/api/ai/page/audit/route.ts", method: "POST" },
  { path: "/api/ai/rewrite", file: "app/api/ai/rewrite/route.ts", method: "POST" },
  { path: "/api/backoffice/experiments/event", file: "app/api/backoffice/experiments/event/route.ts", method: "POST" },
  { path: "/api/public/track-event", file: "app/api/public/track-event/route.ts", method: "POST" },
];

describe("B8 AI routes — session gate (DC-027)", () => {
  for (const route of B8_ROUTES) {
    test(`${route.path} source prepends denyUnlessSession outside withApiAiEntrypoint`, () => {
      const src = fs.readFileSync(route.file, "utf8");
      expect(src).toContain("denyUnlessSession");
      const denyIdx = src.indexOf("denyUnlessSession");
      const wrapIdx = src.indexOf("withApiAiEntrypoint");
      expect(denyIdx).toBeGreaterThan(-1);
      expect(wrapIdx).toBeGreaterThan(-1);
      expect(denyIdx).toBeLessThan(wrapIdx);
    });
  }
});
