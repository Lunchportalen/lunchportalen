/**
 * G5d.7b — Pure week runtime compatibility resolver tests (read-only, no I/O).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import {
  assertNoForbiddenWeekRuntimeCompatibilityFields,
  buildWeekRuntimeCompatibilityDecision,
  findForbiddenWeekRuntimeCompatibilityFields,
  stableSerializeWeekRuntimeCompatibilityValue,
  summarizeWeekRuntimeCompatibilityValue,
  validateWeekRuntimeCompatibilityInput,
  WEEK_RUNTIME_COMPATIBILITY_FORBIDDEN_FIELD_NAMES,
  type WeekRuntimeCompatibilityInput,
} from "@/lib/menu-profile/weekRuntimeCompatibilityResolver.server";

const ROOT = process.cwd();
const RESOLVER_HELPER = "lib/menu-profile/weekRuntimeCompatibilityResolver.server.ts";

function baseInput(overrides: Partial<WeekRuntimeCompatibilityInput> = {}): WeekRuntimeCompatibilityInput {
  return {
    current: { days: [{ dateISO: "2026-06-16", title: "Laks" }] },
    candidate: { days: [{ dateISO: "2026-06-16", title: "Laks" }] },
    ...overrides,
  };
}

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      walkFiles(p, out);
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

function rel(absPath: string): string {
  return path.normalize(path.relative(ROOT, absPath)).replace(/\\/g, "/");
}

describe("G5d.7b — server-only / imports / no writes", () => {
  const FORBIDDEN_IMPORT_PATTERNS = [
    /@supabase/,
    /sanityWriteClient/,
    /requireSanityWrite/,
    /lp_order_set/,
    /lp_order_advance_status/,
    /buildMenuDayPayload/,
    /pricePreview/,
    /provider_price_rules/,
    /app\/api\/week/,
    /app\/\(app\)\/week/,
    /lib\/week/,
    /EmployeeWeekClient/,
    /tripletex/i,
    /menuDayPayload/,
    /menu-publish/,
    /featureFlag/,
    /process\.env/,
    /\bfetch\s*\(/,
  ];

  test("helper starts with import server-only", () => {
    const src = fs.readFileSync(path.join(ROOT, RESOLVER_HELPER), "utf8");
    expect(src).toMatch(/^import\s+["']server-only["'];/m);
  });

  test("helper source has no forbidden imports", () => {
    const src = fs.readFileSync(path.join(ROOT, RESOLVER_HELPER), "utf8");
    const importBlock = src
      .split(/\r?\n/)
      .filter((line) => /^\s*import\s/.test(line))
      .join("\n");
    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      expect(importBlock, `${RESOLVER_HELPER} imports → ${pattern}`).not.toMatch(pattern);
    }
  });

  test("helper contains no DB mutations", () => {
    const src = fs.readFileSync(path.join(ROOT, RESOLVER_HELPER), "utf8");
    expect(src).not.toMatch(/\.insert\s*\(|\.delete\s*\(|\.upsert\s*\(/);
  });

  test("helper is not imported from week runtime", () => {
    const prefixes = ["app/api/week", "app/(app)/week", "lib/week"];
    const offenders: string[] = [];
    for (const prefix of prefixes) {
      for (const filePath of walkFiles(path.join(ROOT, prefix))) {
        const src = fs.readFileSync(filePath, "utf8");
        if (/weekRuntimeCompatibilityResolver/.test(src)) {
          offenders.push(rel(filePath));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test("helper is not imported by components, order, publish, menuDayPayload, or billing", () => {
    const scanTargets = [
      "components",
      "app/api/orders",
      "lib/orders",
      "lib/provider-menu/menuDayPayload.ts",
      "lib/menu-publish",
      "lib/integrations/tripletex",
    ];

    const offenders: string[] = [];
    for (const target of scanTargets) {
      const abs = path.join(ROOT, target);
      if (!fs.existsSync(abs)) continue;
      const files = fs.statSync(abs).isDirectory() ? walkFiles(abs) : [abs];
      for (const filePath of files) {
        const src = fs.readFileSync(filePath, "utf8");
        if (/weekRuntimeCompatibilityResolver/.test(src)) {
          offenders.push(rel(filePath));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("G5d.7b — default decision", () => {
  test("valid current + candidate returns fail-closed current decision", () => {
    const decision = buildWeekRuntimeCompatibilityDecision(baseInput());

    expect(decision.selectedSource).toBe("current");
    expect(decision.canUseCandidateRuntime).toBe(false);
    expect(decision.fallbackToCurrent).toBe(true);
    expect(decision.runtimeHookActive).toBe(false);
    expect(decision.sourceOfTruthChanged).toBe(false);
    expect(decision.autoRollout).toBe(false);
    expect(decision.candidateOrderable).toBe(false);
    expect(decision.employeeVisibleChangeAllowed).toBe(false);
    expect(decision.productionActivationAllowed).toBe(false);
    expect(decision.requiresExplicitGo).toBe(true);
    expect(decision.validation.ok).toBe(true);
    expect(decision.safeSummary.wired).toBe(false);
    expect(decision.safeSummary.adapterPhase).toBe("G5d.7b");
  });
});

describe("G5d.7b — no candidate selection", () => {
  test("matching current/candidate still selects current", () => {
    const input = baseInput({
      current: { days: [{ dateISO: "2026-06-16" }] },
      candidate: { days: [{ dateISO: "2026-06-16" }] },
    });
    const decision = buildWeekRuntimeCompatibilityDecision(input);
    expect(decision.selectedSource).toBe("current");
    expect(decision.safeSummary.valuesEqual).toBe(true);
  });

  test("compatibilityEvidence green does not select candidate", () => {
    const decision = buildWeekRuntimeCompatibilityDecision(
      baseInput({
        compatibilityEvidence: {
          canProceedToPreviewCompare: true,
          hashesEqual: true,
        },
      }),
    );
    expect(decision.selectedSource).toBe("current");
    expect(decision.canUseCandidateRuntime).toBe(false);
  });

  test("flags object with runtime hook true does not select candidate", () => {
    const decision = buildWeekRuntimeCompatibilityDecision(
      baseInput({
        flags: { runtimeHookActive: true, LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK: "true" },
      }),
    );
    expect(decision.selectedSource).toBe("current");
    expect(decision.runtimeHookActive).toBe(false);
    expect(decision.messages.join(" ")).toMatch(/G5d\.7c requires explicit GO/i);
  });
});

describe("G5d.7b — forbidden fields", () => {
  for (const field of WEEK_RUNTIME_COMPATIBILITY_FORBIDDEN_FIELD_NAMES) {
    test(`rejects forbidden field ${field}`, () => {
      const input = baseInput({ context: { [field]: "blocked" } });
      const decision = buildWeekRuntimeCompatibilityDecision(input);
      expect(decision.selectedSource).toBe("current");
      expect(decision.validation.ok).toBe(false);
      expect(decision.validation.forbiddenFieldPaths.length).toBeGreaterThan(0);
      expect(decision.fallbackToCurrent).toBe(true);
      expect(decision.canUseCandidateRuntime).toBe(false);
      expect(JSON.stringify(decision)).not.toContain("blocked");
    });
  }

  test("rejects candidateOrderable true", () => {
    const decision = buildWeekRuntimeCompatibilityDecision(
      baseInput({ context: { candidateOrderable: true } }),
    );
    expect(decision.validation.ok).toBe(false);
    expect(decision.selectedSource).toBe("current");
  });

  test("findForbiddenWeekRuntimeCompatibilityFields detects nested forbidden fields", () => {
    const paths = findForbiddenWeekRuntimeCompatibilityFields({
      current: {},
      candidate: { nested: { providerId: "x" } },
    });
    expect(paths.some((p) => p.includes("providerId"))).toBe(true);
  });
});

describe("G5d.7b — validation behavior", () => {
  test("validate does not throw", () => {
    expect(() => validateWeekRuntimeCompatibilityInput(null)).not.toThrow();
    expect(() => validateWeekRuntimeCompatibilityInput(baseInput())).not.toThrow();
  });

  test("assert helper throws only safe error without raw payload", () => {
    expect(() =>
      assertNoForbiddenWeekRuntimeCompatibilityFields(
        baseInput({ context: { employeePayload: { secret: "x" } } }),
      ),
    ).toThrow(/Week runtime compatibility input rejected/);
    expect(() =>
      assertNoForbiddenWeekRuntimeCompatibilityFields(
        baseInput({ context: { employeePayload: { secret: "x" } } }),
      ),
    ).not.toThrow(/secret/);
  });

  test("stable serialization is deterministic", () => {
    const value = { b: 2, a: 1, nested: [{ z: 3, y: 2 }] };
    const first = stableSerializeWeekRuntimeCompatibilityValue(value);
    const second = stableSerializeWeekRuntimeCompatibilityValue(value);
    expect(first).toBe(second);
  });

  test("summarizeWeekRuntimeCompatibilityValue returns kind only", () => {
    expect(summarizeWeekRuntimeCompatibilityValue(null)).toBe("null");
    expect(summarizeWeekRuntimeCompatibilityValue([])).toBe("array");
    expect(summarizeWeekRuntimeCompatibilityValue({})).toBe("object");
  });
});

describe("G5d.7b — employee/commercial boundary", () => {
  test("decision JSON contains no forbidden commercial/provider fields", () => {
    const decision = buildWeekRuntimeCompatibilityDecision(baseInput());
    const serialized = JSON.stringify(decision);
    for (const token of [
      "providerId",
      "employeePayload",
      "orderPayload",
      "pricePreview",
      "provider_price_rules",
      "commission",
      "billing",
      "Tripletex",
    ]) {
      expect(serialized).not.toContain(token);
    }
  });
});

describe("G5d.7b — future explicit GO guards", () => {
  test("decision states adapter not wired and later phases require GO", () => {
    const decision = buildWeekRuntimeCompatibilityDecision(baseInput());
    expect(decision.reasons).toContain("g5d7b_pure_adapter_only");
    expect(decision.reasons).toContain("runtime_hook_not_wired");
    expect(decision.reasons).toContain("g5d7c_requires_explicit_go");
    expect(decision.reasons).toContain("g5d8_production_requires_separate_final_go");
    expect(decision.messages.join(" ")).toMatch(/not wired/i);
    expect(decision.messages.join(" ")).toMatch(/G5d\.7c requires explicit GO/i);
    expect(decision.messages.join(" ")).toMatch(/Production activation requires separate final GO/i);
  });
});
