/**
 * Gate F0 — Localized generator SOT runtime hook governance (tests only).
 * Locks boundaries before any /week or materialization wiring.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { PHASE_D_RICH_MARKET_TARGETS } from "@/lib/provider-onboarding/phaseDLocales";
import { resolveLocalizedGeneratorSotDecision } from "@/lib/menu-generator/localizedGeneratorSotResolver";

const ROOT = process.cwd();
const IMPLEMENTATION_PLAN_DOC =
  "docs/engineering/localized-generator-sot-cutover-implementation-plan.md";

const SOT_FLAG_TOKENS = [
  "LP_LOCALIZED_GENERATOR_SOT_ENABLED",
  "LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST",
  "LP_LOCALIZED_GENERATOR_SOT_DRY_RUN",
] as const;

const AUTO_ROLLOUT_FLAG = "LP_LOCALIZED_GENERATOR_AUTO_ROLLOUT_ENABLED";

const SOT_RUNTIME_ALLOWED_PATHS = [
  "lib/menu-generator/sotFeatureFlag.ts",
  "lib/menu-generator/localizedGeneratorSotResolver.ts",
  "lib/menu-generator/localizedGeneratorSotControl.ts",
  "lib/menu-generator/index.ts",
  "tests/lib/menu-generator/localizedGeneratorSotFeatureFlag.test.ts",
  "tests/lib/menu-generator/localizedGeneratorSotResolver.test.ts",
  "tests/governance/localized-generator-sot-runtime-hook-governance-contracts.test.ts",
  IMPLEMENTATION_PLAN_DOC,
  "docs/engineering/localized-generator-sot-cutover-design.md",
  "docs/runbooks/localized-generator-sot-rollout-readiness.md",
] as const;

const SOT_GOVERNANCE_ALLOWED_PATHS = [...SOT_RUNTIME_ALLOWED_PATHS] as const;

const PROTECTED_PREFIXES = [
  "app/api/week",
  "app/api/order/window",
  "app/api/orders",
  "lib/orders",
  "lib/menu-publish/syncMenuServiceDaysFromMenuDay.ts",
  "lib/menu-publish/syncMenuServiceDayItems.ts",
  "lib/menu-publish/runMenuWeekRolloutCore.ts",
  "lib/billing",
  "lib/integrations/tripletex",
];

const SOT_FORBIDDEN_IMPORTS = [
  /syncMenuServiceDaysFromMenuDay/,
  /syncMenuServiceDayItems/,
  /runMenuWeekRolloutCore/,
  /runMenuWeekRollout/,
  /lp_order_set/,
  /tripletex/i,
  /invoiceEngine/,
  /from\s+["']@\/app\/api\/week/,
  /from\s+["']@\/lib\/billing/,
];

const SOT_HOOK_REFERENCE_PATTERNS = [
  /resolveLocalizedGeneratorSotDecision/,
  /buildLocalizedGeneratorSotProviderControl/,
  /isLocalizedGeneratorSotEnabled/,
  /LP_LOCALIZED_GENERATOR_SOT_ENABLED/,
];

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function rel(absPath: string): string {
  return path.normalize(path.relative(ROOT, absPath)).replace(/\\/g, "/");
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

function isSotGovernanceAllowedPath(fileRel: string): boolean {
  return SOT_GOVERNANCE_ALLOWED_PATHS.some((p) => fileRel === p.replace(/\\/g, "/"));
}

function isSotRuntimeAllowedPath(fileRel: string): boolean {
  return SOT_RUNTIME_ALLOWED_PATHS.some((p) => fileRel === p.replace(/\\/g, "/"));
}

const DANISH_PILOT = "799ba3a2-a127-48a0-87b7-87944a2f42a3";

describe("Gate F0 — implementation plan remains planning authority", () => {
  test("implementation plan exists and locks F0 default OFF", () => {
    const doc = readSource(IMPLEMENTATION_PLAN_DOC);
    expect(doc).toMatch(/SOT NOT STARTED/i);
    expect(doc).toMatch(/auto-rollout NOT STARTED/i);
    expect(doc).toMatch(/LP_LOCALIZED_GENERATOR_SOT_ENABLED/);
    expect(doc).toMatch(/tier-products.*NOK|NOK.*tier-product/i);
    expect(doc).toMatch(/lp_order_set/);
  });
});

describe("Gate F0 — SOT feature flag guards", () => {
  test("sotFeatureFlag.ts exports required helpers", () => {
    const src = readSource("lib/menu-generator/sotFeatureFlag.ts");
    for (const token of SOT_FLAG_TOKENS) {
      expect(src).toContain(token);
    }
    expect(src).toContain(AUTO_ROLLOUT_FLAG);
    expect(src).toContain("isLocalizedGeneratorSotEnabled");
    expect(src).toContain("parseLocalizedGeneratorSotProviderAllowlist");
  });

  test("SOT flag tokens appear only in allowed paths", () => {
    const offenders: string[] = [];
    for (const token of [...SOT_FLAG_TOKENS, AUTO_ROLLOUT_FLAG]) {
      for (const filePath of walkFiles(ROOT)) {
        const r = rel(filePath);
        if (!/\.(ts|tsx|js|jsx|mjs|md)$/.test(r)) continue;
        if (r.includes("node_modules/") || r.startsWith("repo-intelligence/")) continue;
        if (isSotGovernanceAllowedPath(r)) continue;
        const src = fs.readFileSync(filePath, "utf8");
        if (src.includes(token)) offenders.push(`${r} → ${token}`);
      }
    }
    expect(offenders, `SOT flags outside allowed paths:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("Gate F0 — SOT hook not wired to protected surfaces", () => {
  test("protected runtime paths do not reference SOT hook", () => {
    const offenders: string[] = [];
    for (const prefix of PROTECTED_PREFIXES) {
      const abs = path.join(ROOT, prefix);
      if (!fs.existsSync(abs)) continue;
      const files = fs.statSync(abs).isDirectory() ? walkFiles(abs) : [abs];
      for (const filePath of files) {
        const r = rel(filePath);
        if (r.includes("/tests/")) continue;
        const src = fs.readFileSync(filePath, "utf8");
        for (const pattern of SOT_HOOK_REFERENCE_PATTERNS) {
          if (pattern.test(src)) {
            offenders.push(`${r} → ${pattern}`);
            break;
          }
        }
      }
    }
    expect(offenders, `SOT hook referenced in protected paths:\n${offenders.join("\n")}`).toEqual([]);
  });

  test("SOT modules do not import protected write paths", () => {
    const modules = [
      "lib/menu-generator/localizedGeneratorSotResolver.ts",
      "lib/menu-generator/localizedGeneratorSotControl.ts",
      "lib/menu-generator/sotFeatureFlag.ts",
    ];
    for (const mod of modules) {
      const src = readSource(mod);
      for (const pattern of SOT_FORBIDDEN_IMPORTS) {
        expect(pattern.test(src), `${mod} must not import ${pattern}`).toBe(false);
      }
    }
  });
});

describe("Gate F0 — resolver runtime contracts", () => {
  test("default OFF keeps legacy and no mutation intent", () => {
    const decision = resolveLocalizedGeneratorSotDecision({ providerId: DANISH_PILOT });
    expect(decision.selectedSource).toBe("legacy");
    expect(decision.hasMutationIntent).toBe(false);
    expect(decision.sourceOfTruthChanged).toBe(false);
    expect(decision.autoRollout).toBe(false);
  });

  test("eligible provider still fail-closed to legacy in F0", () => {
    const decision = resolveLocalizedGeneratorSotDecision({
      providerId: DANISH_PILOT,
      env: {
        LP_LOCALIZED_GENERATOR_SOT_ENABLED: "true",
        LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST: DANISH_PILOT,
      },
    });
    expect(decision.sotEligible).toBe(true);
    expect(decision.selectedSource).toBe("legacy");
    expect(decision.canServeGeneratedAsAuthoritative).toBe(false);
  });

  test("dry-run reports intent without mutation", () => {
    const decision = resolveLocalizedGeneratorSotDecision({
      providerId: DANISH_PILOT,
      env: {
        LP_LOCALIZED_GENERATOR_SOT_ENABLED: "true",
        LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST: DANISH_PILOT,
        LP_LOCALIZED_GENERATOR_SOT_DRY_RUN: "true",
      },
    });
    expect(decision.dryRun).toBe(true);
    expect(decision.hasMutationIntent).toBe(false);
    expect(decision.wouldSelectGenerated).toBe(true);
  });

  test("documents MSDI tier-product global catalog v1 boundary", () => {
    const decision = resolveLocalizedGeneratorSotDecision({
      providerId: DANISH_PILOT,
      env: {
        LP_LOCALIZED_GENERATOR_SOT_ENABLED: "true",
        LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST: DANISH_PILOT,
      },
    });
    expect(decision.msdiSnapshotMode).toBe("tier_products_global_catalog");
    expect(decision.msdiLocalizedMappingBlocked).toBe(true);
  });
});

describe("Gate F0 — no Phase D leakage", () => {
  test("Phase D targets remain source-only", () => {
    for (const target of PHASE_D_RICH_MARKET_TARGETS) {
      expect(target.status).toBe("SOURCE_ONLY");
      expect(target.applyEnabled).toBe(false);
      expect(target.publishEnabled).toBe(false);
      expect(target.rolloutAutomationEnabled).toBe(false);
    }
  });

  test("SOT resolver does not reference Phase D locale activation", () => {
    const src = readSource("lib/menu-generator/localizedGeneratorSotResolver.ts");
    expect(src).not.toMatch(/phaseDTargetForLocale|PHASE_D_RICH_MARKET_TARGETS/);
    expect(src).not.toMatch(/applyEnabled|publishEnabled/);
  });
});

describe("Gate F0 — billing and order path boundary", () => {
  test("SOT modules contain no billing or order write references", () => {
    const modules = [
      "lib/menu-generator/localizedGeneratorSotResolver.ts",
      "lib/menu-generator/localizedGeneratorSotControl.ts",
      "lib/menu-generator/sotFeatureFlag.ts",
    ];
    const forbidden = ["lp_order_set", "invoiceEngine", "tripletex", "Stripe", "provider_invoices"];
    for (const mod of modules) {
      const src = readSource(mod);
      for (const token of forbidden) {
        expect(src.includes(token), `${mod} must not reference ${token}`).toBe(false);
      }
    }
  });
});

describe("Gate F0 — no auto-rollout coupling", () => {
  test("resolver never sets autoRollout true", () => {
    const cases = [
      {},
      { LP_LOCALIZED_GENERATOR_SOT_ENABLED: "true" },
      {
        LP_LOCALIZED_GENERATOR_SOT_ENABLED: "true",
        LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST: DANISH_PILOT,
        LP_LOCALIZED_GENERATOR_AUTO_ROLLOUT_ENABLED: "true",
      },
    ];
    for (const env of cases) {
      const decision = resolveLocalizedGeneratorSotDecision({ providerId: DANISH_PILOT, env });
      expect(decision.autoRollout).toBe(false);
    }
  });

  test("SOT modules do not import menu week rollout core", () => {
    for (const mod of SOT_RUNTIME_ALLOWED_PATHS.filter((p) => p.startsWith("lib/"))) {
      const src = readSource(mod);
      expect(src.includes("runMenuWeekRollout")).toBe(false);
    }
  });
});
