/**
 * G5d.6b — Compatibility cutover contract/governance tests (tests only).
 * Locks boundaries before G5d.6c helper / G5d.6d API implementation.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import {
  LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV,
  isMenuProfileCompatibilityCutoverEnabled,
} from "@/lib/menu-profile/featureFlag";
import {
  COMPATIBILITY_CUTOVER_DOC_PATH,
  COMPATIBILITY_CUTOVER_FLAG,
  COMPATIBILITY_CUTOVER_FORBIDDEN_OUTPUT_FIELDS,
  COMPATIBILITY_CUTOVER_FORBIDDEN_SOURCE_OF_TRUTH_WORDS,
  COMPATIBILITY_CUTOVER_HELPER,
  FUTURE_COMPATIBILITY_API_PATH,
  FUTURE_COMPATIBILITY_HELPER_PATH,
  G5D6_COMPATIBILITY_CUTOVER_CONTRACT_FIXTURE,
  type CompatibilityCutoverEvaluationDto,
} from "../fixtures/g5d6-compatibility-cutover-contract.constants";

const ROOT = process.cwd();
const G5D6_DESIGN_DOC = COMPATIBILITY_CUTOVER_DOC_PATH;

const FUTURE_COMPATIBILITY_ALLOWED_PATHS = [
  FUTURE_COMPATIBILITY_HELPER_PATH,
  "lib/menu-profile/runtimeCompatibilityCutoverTypes.ts",
  FUTURE_COMPATIBILITY_API_PATH,
  "tests/lib/menu-profile/runtimeCompatibilityCutover.test.ts",
  "tests/api/provider/menu-profile-compatibility-cutover-api.test.ts",
];

const CANONICAL_COMPATIBILITY_HELPER = "lib/menu-profile/runtimeCompatibilityCutover.server.ts";
const CANONICAL_COMPATIBILITY_TYPES = "lib/menu-profile/runtimeCompatibilityCutoverTypes.ts";
const CANONICAL_COMPATIBILITY_API_ROUTE = FUTURE_COMPATIBILITY_API_PATH;

const FUTURE_COMPATIBILITY_FORBIDDEN_IMPORTS = [
  /requireSanityWrite/,
  /sanityWriteClient/,
  /menuCatalogWrite/,
  /syncMenuServiceDaysFromMenuDay/,
  /syncMenuServiceDayItems/,
  /runMenuWeekRolloutCore/,
  /runMenuWeekRollout/,
  /lp_order_set/,
  /lp_order_advance_status/,
  /tripletex/i,
  /menu-publish\/syncMenuServiceDay/,
  /buildMenuDayPayload/,
  /EmployeeWeekClient/,
  /provider_price_rules/,
  /pricePreview/,
  /app\/api\/week\/route/,
  /from\s+["']@\/app\/api\/week/,
  /from\s+["']@\/app\/\(app\)\/week/,
];

const COMPATIBILITY_MODULE_IMPORT =
  /from\s+["']@\/lib\/menu-profile\/runtimeCompatibilityCutover\.server|runtimeCompatibilityCutover\.server/;
const COMPATIBILITY_API_IMPORT = /compatibility-cutover\/route|menu-profile\/compatibility-cutover/;

const COMPATIBILITY_REFERENCE_PATTERNS = [
  /compatibility-cutover/,
  /runtimeCompatibilityCutover/,
  /LP_MENU_PROFILE_COMPATIBILITY_CUTOVER/,
  /CompatibilityCutoverEvaluation/,
  /isMenuProfileCompatibilityCutoverEnabled/,
];

const PROTECTED_PREFIXES = [
  "app/api/week",
  "app/(app)/week",
  "app/api/order/window",
  "lib/week",
  "app/api/orders",
  "app/api/order",
  "lib/orders",
  "app/api/provider/menu-days",
  "app/api/provider/menu-catalog",
  "lib/menu-publish",
  "lib/sanity",
  "lib/cms",
  "lib/integrations/tripletex",
  "components/employee",
  "components/week",
];

const PROTECTED_FILES = [
  "lib/provider-menu/menuDayPayload.ts",
  "lib/provider-menu/menuCatalogWrite.ts",
  "lib/provider-menu/varmrettSharedWrite.ts",
  "lib/integrations/tripletex/tripletexEngine.ts",
  "components/providers/ProviderMenuBuilder.tsx",
  "app/api/provider/menu-profile/publish-shadow/route.ts",
  "app/api/provider/menu-profile/week-shadow/route.ts",
  "app/api/provider/menu-profile/mapping-draft/route.ts",
  "app/api/provider/menu-profile/mapping-draft/archive/route.ts",
  "app/api/week/route.ts",
];

const ENV_CONFIG_SCAN_PATHS = [
  ".env.example",
  ".env.production.example",
  "vercel.json",
  "render.yaml",
];

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function rel(absPath: string): string {
  return path.normalize(path.relative(ROOT, absPath));
}

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      walkFiles(p, out);
    } else if (/\.(ts|tsx|js|jsx|mjs|json|md|yaml|yml|env)$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

function filesUnderPrefixes(prefixes: string[]): string[] {
  const out: string[] = [];
  for (const prefix of prefixes) {
    walkFiles(path.join(ROOT, prefix), out);
  }
  return out;
}

function existingFutureCompatibilityFiles(): string[] {
  return FUTURE_COMPATIBILITY_ALLOWED_PATHS.map((p) => path.join(ROOT, p)).filter((p) =>
    fs.existsSync(p),
  );
}

function assertNoCompatibilityReferences(prefixes: string[], label: string) {
  const offenders: string[] = [];
  for (const filePath of filesUnderPrefixes(prefixes)) {
    const r = rel(filePath);
    if (r.includes(`${path.sep}tests${path.sep}`)) continue;
    const src = fs.readFileSync(filePath, "utf8");
    for (const pattern of COMPATIBILITY_REFERENCE_PATTERNS) {
      if (pattern.test(src)) {
        offenders.push(`${r} → ${pattern}`);
        break;
      }
    }
  }
  expect(
    offenders,
    `${label} must not reference compatibility cutover:\n${offenders.join("\n")}`,
  ).toEqual([]);
}

describe("G5d.6b — LP_MENU_PROFILE_COMPATIBILITY_CUTOVER flag contract", () => {
  test("env key is stable", () => {
    expect(LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV).toBe(COMPATIBILITY_CUTOVER_FLAG);
    expect(COMPATIBILITY_CUTOVER_HELPER).toBe("isMenuProfileCompatibilityCutoverEnabled");
  });

  test("defaults to false", () => {
    expect(isMenuProfileCompatibilityCutoverEnabled({})).toBe(false);
    expect(
      isMenuProfileCompatibilityCutoverEnabled({
        [LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV]: undefined,
      }),
    ).toBe(false);
  });

  test('is true only for exact "true"', () => {
    expect(
      isMenuProfileCompatibilityCutoverEnabled({
        [LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV]: "true",
      }),
    ).toBe(true);
  });

  test("is false for non-exact true values", () => {
    for (const value of ["", "false", "1", "yes", "TRUE", "on", " true ", "true\r\n"]) {
      expect(
        isMenuProfileCompatibilityCutoverEnabled({
          [LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV]: value,
        }),
      ).toBe(false);
    }
  });

  test("compatibility cutover flag is wired only in compatibility-cutover API route", () => {
    const scanRoots = ["app", "components"];
    const offenders: string[] = [];
    for (const root of scanRoots) {
      for (const filePath of walkFiles(path.join(ROOT, root))) {
        const r = rel(filePath).replace(/\\/g, "/");
        if (r.includes("/tests/")) continue;
        if (r === CANONICAL_COMPATIBILITY_API_ROUTE) continue;
        const src = fs.readFileSync(filePath, "utf8");
        if (
          src.includes("isMenuProfileCompatibilityCutoverEnabled") ||
          src.includes("LP_MENU_PROFILE_COMPATIBILITY_CUTOVER")
        ) {
          offenders.push(r);
        }
      }
    }
    expect(
      offenders,
      `compatibility cutover flag wired outside compatibility-cutover API:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test("menuProfileResolverHostEnv does not expose compatibility cutover yet", () => {
    const src = readSource("lib/providers/providerMenuProfileDiagnostic.ts");
    expect(src).not.toContain("LP_MENU_PROFILE_COMPATIBILITY_CUTOVER");
    expect(src).not.toContain("isMenuProfileCompatibilityCutoverEnabled");
  });

  test("provider UI does not reference compatibility cutover flag", () => {
    const providersDir = path.join(ROOT, "components/providers");
    if (!fs.existsSync(providersDir)) return;

    const offenders: string[] = [];
    for (const filePath of walkFiles(providersDir)) {
      const src = fs.readFileSync(filePath, "utf8");
      if (
        src.includes("LP_MENU_PROFILE_COMPATIBILITY_CUTOVER") ||
        src.includes("isMenuProfileCompatibilityCutoverEnabled")
      ) {
        offenders.push(rel(filePath));
      }
    }
    expect(offenders, `provider UI references compatibility flag:\n${offenders.join("\n")}`).toEqual(
      [],
    );
  });

  test("employee week UI does not reference compatibility cutover flag", () => {
    assertNoCompatibilityReferences(["app/(app)/week"], "employee week UI");
  });
});

describe("G5d.6b — compatibility cutover output contract fixture", () => {
  test("fixture enforces compatibilityOnly, providerOnly, and zero change counters", () => {
    const dto: CompatibilityCutoverEvaluationDto = G5D6_COMPATIBILITY_CUTOVER_CONTRACT_FIXTURE;
    expect(dto.compatibilityOnly).toBe(true);
    expect(dto.providerOnly).toBe(true);
    expect(dto.currentNoRuntimeUnchanged).toBe(true);
    expect(dto.weekResponseChanges).toBe(0);
    expect(dto.employeeVisibleChanges).toBe(0);
    expect(dto.orderChanges).toBe(0);
    expect(dto.publishChanges).toBe(0);
    expect(dto.sanityWrites).toBe(0);
    expect(dto.menuDayPayloadMutations).toBe(0);
    expect(dto.priceVisibleChanges).toBe(0);
    expect(dto.commercialVisibleChanges).toBe(0);
    expect(dto.canProceedToRuntimeHook).toBe(false);
    expect(dto.canProceedToProduction).toBe(false);
    expect(dto.comparison.hashesEqual).toBe(true);
  });

  test("fixture has no forbidden output or source-of-truth fields", () => {
    for (const field of COMPATIBILITY_CUTOVER_FORBIDDEN_OUTPUT_FIELDS) {
      expect(Object.keys(G5D6_COMPATIBILITY_CUTOVER_CONTRACT_FIXTURE)).not.toContain(field);
    }
    const notes = G5D6_COMPATIBILITY_CUTOVER_CONTRACT_FIXTURE.comparison.diffSummary.join(" ");
    for (const word of COMPATIBILITY_CUTOVER_FORBIDDEN_SOURCE_OF_TRUTH_WORDS) {
      expect(notes.toLowerCase()).not.toMatch(new RegExp(`\\b${word}\\b`, "i"));
    }
  });
});

describe("G5d.6b — design document contract guards", () => {
  test("G5d6 design audit document exists", () => {
    expect(fs.existsSync(path.join(ROOT, G5D6_DESIGN_DOC))).toBe(true);
  });

  test("design doc locks design-audit only, Production OFF, and explicit GO gates", () => {
    const doc = readSource(G5D6_DESIGN_DOC);
    expect(doc).toContain("LP_MENU_PROFILE_COMPATIBILITY_CUTOVER");
    expect(doc).toMatch(/design \/ audit only|design\/audit only/i);
    expect(doc).toMatch(/Production.*OFF/i);
    expect(doc).toMatch(/no runtime cutover|not runtime cutover|no runtime cutover/i);
    expect(doc).toMatch(/no source-of-truth switch|source of truth|not source of truth/i);
    expect(doc).toMatch(/no auto-rollout|Auto-rollout|auto-rollout/i);
    expect(doc).toMatch(/G5d\.6b.*explicit GO|G5d\.6b requires.*explicit GO|G5d\.6b.*Contract/i);
    expect(doc).toMatch(/Do not skip G5d\.6b governance before G5d\.6c|After G5d\.6b/i);
    expect(doc).toMatch(/G5d\.7.*not.*start from this PR/i);
    expect(doc).toMatch(/Production activation requires.*separate|separate final GO/i);
    expect(doc).toMatch(/no Sanity write|Sanity writes|Write to Sanity/i);
    expect(doc).toMatch(/\/week|weekResponseChanges|week runtime/i);
    expect(doc).toMatch(/employee|employeeVisibleChanges|Employee UI/i);
    expect(doc).toMatch(/order|orderChanges|order write-path|lp_order_set/i);
    expect(doc).toMatch(/menuDayPayload mutation|Mutate `menuDayPayload`/i);
  });
});

describe("G5d.6b — canonical paths (helper + API allowed after G5d.6c/G5d.6d)", () => {
  test("compatibility-cutover API route may exist only at canonical path", () => {
    expect(fs.existsSync(path.join(ROOT, CANONICAL_COMPATIBILITY_API_ROUTE))).toBe(true);

    const src = readSource(CANONICAL_COMPATIBILITY_API_ROUTE);
    expect(src).toContain('import "server-only"');
    expect(src).toContain("isMenuProfileCompatibilityCutoverEnabled");
    expect(src).toContain("buildCompatibilityCutoverEvaluation");

    const offenders: string[] = [];
    for (const filePath of walkFiles(path.join(ROOT, "app/api/provider/menu-profile"))) {
      const r = rel(filePath).replace(/\\/g, "/");
      if (r === CANONICAL_COMPATIBILITY_API_ROUTE) continue;
      const fileSrc = fs.readFileSync(filePath, "utf8");
      if (/menu-profile\/compatibility-cutover\/route/.test(r) || /compatibility-cutover\/route/.test(fileSrc)) {
        offenders.push(r);
      }
    }
    expect(
      offenders,
      `compatibility cutover API duplicated outside canonical path:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test("no other compatibility-cutover route/helper paths exist outside allowed set", () => {
    const allowed = new Set(FUTURE_COMPATIBILITY_ALLOWED_PATHS);
    const offenders: string[] = [];

    for (const filePath of walkFiles(path.join(ROOT, "lib/menu-profile"))) {
      const r = rel(filePath).replace(/\\/g, "/");
      if (r.includes("/tests/")) continue;
      const src = fs.readFileSync(filePath, "utf8");
      if (/runtimeCompatibilityCutover/.test(src) && !allowed.has(r)) {
        offenders.push(r);
      }
    }

    for (const filePath of walkFiles(path.join(ROOT, "app/api/provider/menu-profile"))) {
      const r = rel(filePath).replace(/\\/g, "/");
      if (r.includes("/tests/")) continue;
      const fileSrc = fs.readFileSync(filePath, "utf8");
      if (
        (/compatibility-cutover\/route/.test(r) || /compatibility-cutover\/route/.test(fileSrc)) &&
        !allowed.has(r)
      ) {
        offenders.push(r);
      }
    }

    expect(
      offenders,
      `compatibility cutover duplicated outside canonical paths:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

describe("G5d.6c — pure compatibility comparison helper guards", () => {
  test("runtimeCompatibilityCutover helper may exist only at canonical path", () => {
    const helperPath = path.join(ROOT, CANONICAL_COMPATIBILITY_HELPER);
    expect(fs.existsSync(helperPath)).toBe(true);

    const src = readSource(CANONICAL_COMPATIBILITY_HELPER);
    expect(src).toContain('import "server-only"');
    expect(src).not.toMatch(/\.insert\(|\.delete\(|\.upsert\(/);
    expect(src).not.toMatch(/\bfetch\s*\(/);

    const offenders: string[] = [];
    for (const filePath of walkFiles(path.join(ROOT, "lib/menu-profile"))) {
      const r = rel(filePath).replace(/\\/g, "/");
      if (r === CANONICAL_COMPATIBILITY_HELPER) continue;
      if (r === CANONICAL_COMPATIBILITY_TYPES) continue;
      const fileSrc = fs.readFileSync(filePath, "utf8");
      if (/runtimeCompatibilityCutover\.server/.test(fileSrc)) {
        offenders.push(r);
      }
    }
    expect(
      offenders,
      `compatibility helper duplicated outside canonical path:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test("compatibility helper must not import forbidden runtime modules", () => {
    const files = [path.join(ROOT, CANONICAL_COMPATIBILITY_HELPER)].filter((p) => fs.existsSync(p));

    const offenders: string[] = [];
    for (const filePath of files) {
      const src = fs.readFileSync(filePath, "utf8");
      for (const pattern of FUTURE_COMPATIBILITY_FORBIDDEN_IMPORTS) {
        if (pattern.test(src)) {
          offenders.push(`${rel(filePath)} → ${pattern}`);
          break;
        }
      }
    }
    expect(
      offenders,
      `forbidden imports in compatibility cutover helper:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test("compatibility helper is not imported from week runtime", () => {
    assertNoCompatibilityReferences(["app/api/week", "lib/week"], "week runtime");
  });

  test("compatibility helper is not imported from employee week UI", () => {
    const offenders: string[] = [];
    for (const filePath of walkFiles(path.join(ROOT, "app/(app)/week"))) {
      const src = fs.readFileSync(filePath, "utf8");
      if (COMPATIBILITY_MODULE_IMPORT.test(src)) {
        offenders.push(rel(filePath));
      }
    }
    expect(offenders).toEqual([]);
  });

  test("compatibility helper is not imported by order, publish, Sanity, menuDayPayload, or billing", () => {
    const scanTargets = [
      "app/api/orders",
      "app/api/order",
      "lib/orders",
      "lib/provider-menu/menuDayPayload.ts",
      "lib/menu-publish",
      "lib/sanity",
      "lib/cms",
      "lib/integrations/tripletex",
    ];

    const offenders: string[] = [];
    for (const target of scanTargets) {
      const abs = path.join(ROOT, target);
      if (!fs.existsSync(abs)) continue;
      const files = fs.statSync(abs).isDirectory() ? walkFiles(abs) : [abs];
      for (const filePath of files) {
        const src = fs.readFileSync(filePath, "utf8");
        if (COMPATIBILITY_MODULE_IMPORT.test(src) || /runtimeCompatibilityCutover/.test(src)) {
          offenders.push(rel(filePath));
        }
      }
    }
    expect(
      offenders,
      `compatibility helper leaked into protected runtime:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test("compatibility helper must not be barrel-exported from lib/menu-profile/index.ts", () => {
    const indexPath = path.join(ROOT, "lib/menu-profile/index.ts");
    if (!fs.existsSync(indexPath)) return;
    const src = readSource("lib/menu-profile/index.ts");
    expect(src).not.toMatch(/runtimeCompatibilityCutover/);
  });

  test("helper cannot authorize runtime hook or production cutover", () => {
    const src = readSource(CANONICAL_COMPATIBILITY_HELPER);
    expect(src).toMatch(/canProceedToRuntimeHook:\s*false/);
    expect(src).toMatch(/canProceedToProduction:\s*false/);
    expect(src).not.toMatch(/canProceedToProduction:\s*true/);
    expect(src).not.toMatch(/canProceedToRuntimeHook:\s*true/);
    expect(src).not.toMatch(/sourceOfTruth|source_of_truth|autoRollout|auto-rollout/i);
  });
});

describe("G5d.6d — provider-only compatibility-cutover API guards", () => {
  test("compatibility-cutover API route may import compatibility helper only at canonical paths", () => {
    const src = readSource(CANONICAL_COMPATIBILITY_API_ROUTE);
    expect(src).toContain("buildCompatibilityCutoverEvaluation");
    expect(src).not.toMatch(/from\s+["']@\/app\/api\/week/);
    expect(src).not.toMatch(/from\s+["']@\/app\/\(app\)\/week/);
    expect(src).not.toMatch(/from\s+["']@\/lib\/week/);
    expect(src).not.toMatch(/\.insert\(|\.delete\(|\.upsert\(/);

    for (const pattern of FUTURE_COMPATIBILITY_FORBIDDEN_IMPORTS) {
      expect(src, `compatibility-cutover API → ${pattern}`).not.toMatch(pattern);
    }
  });

  test("runtimeCompatibilityCutover helper may be imported only by compatibility-cutover API in app/", () => {
    const scanRoots = ["app", "components"];
    const offenders: string[] = [];
    for (const root of scanRoots) {
      for (const filePath of walkFiles(path.join(ROOT, root))) {
        const r = rel(filePath).replace(/\\/g, "/");
        if (r.includes("/tests/")) continue;
        if (r === CANONICAL_COMPATIBILITY_API_ROUTE) continue;
        const src = fs.readFileSync(filePath, "utf8");
        if (COMPATIBILITY_MODULE_IMPORT.test(src)) {
          offenders.push(r);
        }
      }
    }
    expect(
      offenders,
      `compatibility helper imported outside compatibility-cutover API:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test("compatibility-cutover API must fail-closed with 404 when flag OFF", () => {
    const src = readSource(CANONICAL_COMPATIBILITY_API_ROUTE);
    expect(src).toMatch(/isMenuProfileCompatibilityCutoverEnabled\(process\.env\)/);
    expect(src).toMatch(/404/);
    const getHandler = src.slice(src.indexOf("export async function GET"));
    const flagIndex = getHandler.indexOf("isMenuProfileCompatibilityCutoverEnabled");
    const authCallIndex = getHandler.indexOf("resolveProviderAdmin");
    expect(flagIndex).toBeGreaterThan(-1);
    expect(authCallIndex).toBeGreaterThan(flagIndex);
  });

  test("compatibility-cutover API response must not include providerId field", () => {
    const src = readSource(CANONICAL_COMPATIBILITY_API_ROUTE);
    const returnBlocks = src.match(/return jsonOk\([\s\S]*?\);/g) ?? [];
    expect(returnBlocks.length).toBeGreaterThan(0);
    for (const block of returnBlocks) {
      expect(block).not.toContain("providerId");
    }
  });

  test("no provider UI wiring for compatibility cutover flag", () => {
    const providersDir = path.join(ROOT, "components/providers");
    if (!fs.existsSync(providersDir)) return;

    const offenders: string[] = [];
    for (const filePath of walkFiles(providersDir)) {
      const src = fs.readFileSync(filePath, "utf8");
      if (
        src.includes("LP_MENU_PROFILE_COMPATIBILITY_CUTOVER") ||
        src.includes("isMenuProfileCompatibilityCutoverEnabled") ||
        src.includes("compatibility-cutover")
      ) {
        offenders.push(rel(filePath));
      }
    }
    expect(offenders, `provider UI references compatibility cutover:\n${offenders.join("\n")}`).toEqual(
      [],
    );
  });
});

describe("G5d.6c — G5d.6e / G5d.7 gate reminders", () => {
  test("G5d.6e smoke evidence requires explicit GO and G5d.7 must not start", () => {
    const doc = readSource(G5D6_DESIGN_DOC);
    expect(doc).toMatch(/G5d\.6d/);
    expect(doc).toMatch(/G5d\.7/);
    expect(doc).toMatch(/explicit GO|separate final GO/i);
    expect(doc).not.toMatch(/G5d\.7 implementation authorized from G5d\.6d/i);
  });
});

describe("G5d.6b — protected runtime isolation", () => {
  test("week API and lib have no compatibility-cutover references", () => {
    assertNoCompatibilityReferences(["app/api/week", "lib/week"], "week runtime");
  });

  test("employee week UI has no compatibility-cutover references", () => {
    assertNoCompatibilityReferences(["app/(app)/week"], "employee week UI");
  });

  test("order runtime has no compatibility-cutover references", () => {
    assertNoCompatibilityReferences(["app/api/orders", "app/api/order", "lib/orders"], "order runtime");
  });

  test("menuDayPayload has no compatibility-cutover references", () => {
    const src = readSource("lib/provider-menu/menuDayPayload.ts");
    for (const pattern of COMPATIBILITY_REFERENCE_PATTERNS) {
      expect(src, `menuDayPayload → ${pattern}`).not.toMatch(pattern);
    }
  });

  test("publish/Sanity write paths have no compatibility-cutover references", () => {
    assertNoCompatibilityReferences(
      ["lib/menu-publish", "lib/sanity", "lib/cms"],
      "publish/Sanity runtime",
    );
  });

  test("billing/Tripletex has no compatibility-cutover references", () => {
    assertNoCompatibilityReferences(["lib/integrations/tripletex"], "Tripletex runtime");
  });

  test("provider UI must not import runtimeCompatibilityCutover", () => {
    const providersDir = path.join(ROOT, "components/providers");
    if (!fs.existsSync(providersDir)) return;

    const offenders: string[] = [];
    for (const filePath of walkFiles(providersDir)) {
      const src = fs.readFileSync(filePath, "utf8");
      if (COMPATIBILITY_MODULE_IMPORT.test(src) || src.includes("runtimeCompatibilityCutover")) {
        offenders.push(rel(filePath));
      }
    }
    expect(
      offenders,
      `provider UI imports compatibility helper:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test("public customer pages have no compatibility-cutover references", () => {
    const publicRoots = ["app/(public)", "app/(marketing)"].filter((p) =>
      fs.existsSync(path.join(ROOT, p)),
    );
    if (publicRoots.length === 0) return;
    assertNoCompatibilityReferences(publicRoots, "public pages");
  });
});

describe("G5d.6b — future compatibility module import guards", () => {
  test("future compatibility server files must not import forbidden runtime modules", () => {
    const files = existingFutureCompatibilityFiles().filter(
      (p) =>
        !p.includes(`${path.sep}tests${path.sep}`) &&
        p.endsWith(".server.ts"),
    );
    if (files.length === 0) return;

    const offenders: string[] = [];
    for (const filePath of files) {
      const src = fs.readFileSync(filePath, "utf8");
      for (const pattern of FUTURE_COMPATIBILITY_FORBIDDEN_IMPORTS) {
        if (pattern.test(src)) {
          offenders.push(`${rel(filePath)} → ${pattern}`);
          break;
        }
      }
    }
    expect(
      offenders,
      `forbidden imports in compatibility cutover files:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test("future compatibility server files must not contain DB mutations if they exist", () => {
    const files = existingFutureCompatibilityFiles().filter(
      (p) =>
        !p.includes(`${path.sep}tests${path.sep}`) &&
        p.endsWith(".server.ts"),
    );
    if (files.length === 0) return;

    for (const filePath of files) {
      const src = fs.readFileSync(filePath, "utf8");
      expect(src, rel(filePath)).not.toMatch(/\.insert\(|\.delete\(|\.upsert\(/);
    }
  });
});

describe("G5d.6b — protected paths must not import compatibility cutover", () => {
  test("protected paths must not import runtimeCompatibilityCutover helper or compatibility API", () => {
    const files = [
      ...filesUnderPrefixes(PROTECTED_PREFIXES),
      ...PROTECTED_FILES.map((f) => path.join(ROOT, f)).filter((p) => fs.existsSync(p)),
    ];
    const offenders: string[] = [];
    for (const filePath of files) {
      const r = rel(filePath);
      if (r.includes(`${path.sep}tests${path.sep}`)) continue;
      const src = fs.readFileSync(filePath, "utf8");
      if (COMPATIBILITY_MODULE_IMPORT.test(src) || COMPATIBILITY_API_IMPORT.test(src)) {
        offenders.push(r);
      }
    }
    expect(
      offenders,
      `compatibility cutover leaked into protected runtime:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

describe("G5d.6b — Golden Path protection", () => {
  test("/week route does not import compatibility cutover", () => {
    const src = readSource("app/api/week/route.ts");
    for (const pattern of COMPATIBILITY_REFERENCE_PATTERNS) {
      expect(src, `/week route → ${pattern}`).not.toMatch(pattern);
    }
  });

  test("order write-path files do not import compatibility cutover", () => {
    assertNoCompatibilityReferences(["lib/orders", "app/api/orders"], "order write-path");
  });

  test("menuDayPayload files do not import compatibility cutover", () => {
    const src = readSource("lib/provider-menu/menuDayPayload.ts");
    expect(src).not.toMatch(/runtimeCompatibilityCutover/);
    expect(src).not.toMatch(/compatibility-cutover/);
  });
});

describe("G5d.6b — Production activation guard", () => {
  test("no committed env/config sets LP_MENU_PROFILE_COMPATIBILITY_CUTOVER=true", () => {
    const offenders: string[] = [];
    for (const relPath of ENV_CONFIG_SCAN_PATHS) {
      const abs = path.join(ROOT, relPath);
      if (!fs.existsSync(abs)) continue;
      const src = readSource(relPath);
      if (/LP_MENU_PROFILE_COMPATIBILITY_CUTOVER\s*=\s*true/i.test(src)) {
        offenders.push(relPath);
      }
    }
    expect(
      offenders,
      `Production-style config enables compatibility cutover:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test("design doc does not authorize Production ON for compatibility cutover", () => {
    const doc = readSource(G5D6_DESIGN_DOC);
    expect(doc).toMatch(/Production.*OFF/i);
    expect(doc).not.toMatch(/Production ON for compatibility cutover/i);
    expect(doc).toMatch(/separate final GO/i);
  });
});

describe("G5d.6b — no rollout / source-of-truth guard", () => {
  test("app/lib runtime does not couple auto-rollout to compatibility cutover", () => {
    const scanRoots = ["app", "lib"];
    const offenders: string[] = [];
    for (const root of scanRoots) {
      for (const filePath of walkFiles(path.join(ROOT, root))) {
        const r = rel(filePath).replace(/\\/g, "/");
        if (r.includes("/tests/")) continue;
        const src = fs.readFileSync(filePath, "utf8");
        if (
          /runtimeCompatibilityCutover|isMenuProfileCompatibilityCutoverEnabled/.test(src) &&
          /runMenuWeekRollout|auto-rollout|autoRollout/.test(src)
        ) {
          offenders.push(r);
        }
      }
    }
    expect(
      offenders,
      `auto-rollout coupled to compatibility cutover:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test("design doc forbids source-of-truth switch and auto-rollout", () => {
    const doc = readSource(G5D6_DESIGN_DOC);
    expect(doc).toMatch(/no source-of-truth switch|Source-of-truth switch|source of truth/i);
    expect(doc).toMatch(/no auto-rollout|Auto-rollout|auto-rollout/i);
    expect(doc).toMatch(/Do not skip G5d\.6b governance before G5d\.6c|G5d\.6c/);
    expect(doc).toMatch(/G5d\.7.*not.*start/i);
  });
});

describe("G5d.6b — G5d.6c / G5d.7 gate reminders", () => {
  test("design doc states G5d.6c requires explicit GO and G5d.7 is separate", () => {
    const doc = readSource(G5D6_DESIGN_DOC);
    expect(doc).toMatch(/G5d\.6 implementation must not start|must not start until this design audit/i);
    expect(doc).toMatch(/G5d\.6c/);
    expect(doc).toMatch(/G5d\.7/);
    expect(doc).not.toMatch(/G5d\.7 implementation authorized from G5d\.6a/i);
  });
});
