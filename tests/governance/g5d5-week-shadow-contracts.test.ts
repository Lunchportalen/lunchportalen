/**
 * G5d.5b — /week shadow read contract/governance tests (tests only).
 * Locks boundaries before G5d.5c helper / G5d.5d API implementation.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import {
  LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV,
  isMenuProfileWeekShadowReadEnabled,
} from "@/lib/menu-profile/featureFlag";
import {
  G5D5_WEEK_SHADOW_CONTRACT_FIXTURE,
  WEEK_SHADOW_FORBIDDEN_OUTPUT_FIELDS,
  WEEK_SHADOW_FORBIDDEN_SOURCE_OF_TRUTH_WORDS,
  type WeekShadowEvaluationDto,
} from "../fixtures/g5d5-week-shadow-contract.constants";

const ROOT = process.cwd();
const G5D5_DESIGN_DOC = "docs/engineering/G5d5-week-shadow-read-design-audit.md";
const CANONICAL_WEEK_SHADOW_API_ROUTE = "app/api/provider/menu-profile/week-shadow/route.ts";
const CANONICAL_WEEK_SHADOW_HELPER = "lib/menu-profile/runtimeMappingWeekShadow.server.ts";

const FUTURE_WEEK_SHADOW_ALLOWED_PATHS = [
  "lib/menu-profile/runtimeMappingWeekShadow.server.ts",
  "app/api/provider/menu-profile/week-shadow/route.ts",
  "tests/lib/menu-profile/runtimeMappingWeekShadow.test.ts",
  "tests/api/provider/menu-profile-week-shadow-api.test.ts",
];

const FUTURE_WEEK_SHADOW_FORBIDDEN_IMPORTS = [
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

const WEEK_SHADOW_MODULE_IMPORT =
  /from\s+["']@\/lib\/menu-profile\/runtimeMappingWeekShadow\.server|runtimeMappingWeekShadow\.server/;
const WEEK_SHADOW_API_IMPORT = /week-shadow\/route|menu-profile\/week-shadow/;

const PROTECTED_PREFIXES = [
  "app/api/week",
  "app/(app)/week",
  "app/api/order/window",
  "lib/week",
  "app/api/orders",
  "lib/orders",
  "app/api/provider/menu-days",
  "app/api/provider/menu-catalog",
  "lib/menu-publish",
];

const PROTECTED_FILES = [
  "lib/provider-menu/menuDayPayload.ts",
  "lib/provider-menu/menuCatalogWrite.ts",
  "lib/provider-menu/varmrettSharedWrite.ts",
  "lib/integrations/tripletex/tripletexEngine.ts",
  "components/providers/ProviderMenuBuilder.tsx",
  "app/api/provider/menu-profile/publish-shadow/route.ts",
  "app/api/provider/menu-profile/mapping-draft/route.ts",
  "app/api/provider/menu-profile/mapping-draft/archive/route.ts",
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
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(ent.name)) {
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

function existingFutureWeekShadowFiles(): string[] {
  return FUTURE_WEEK_SHADOW_ALLOWED_PATHS.map((p) => path.join(ROOT, p)).filter((p) =>
    fs.existsSync(p),
  );
}

describe("G5d.5b — LP_MENU_PROFILE_WEEK_SHADOW_READ flag contract", () => {
  test("env key is stable", () => {
    expect(LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV).toBe("LP_MENU_PROFILE_WEEK_SHADOW_READ");
  });

  test("defaults to false", () => {
    expect(isMenuProfileWeekShadowReadEnabled({})).toBe(false);
    expect(
      isMenuProfileWeekShadowReadEnabled({ [LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV]: undefined }),
    ).toBe(false);
  });

  test('is true only for exact "true"', () => {
    expect(
      isMenuProfileWeekShadowReadEnabled({ [LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV]: "true" }),
    ).toBe(true);
    expect(
      isMenuProfileWeekShadowReadEnabled({ [LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV]: "true\r\n" }),
    ).toBe(true);
  });

  test("is false for non-true values", () => {
    for (const value of ["", "false", "1", "yes", "TRUE", "on"]) {
      expect(
        isMenuProfileWeekShadowReadEnabled({ [LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV]: value }),
      ).toBe(false);
    }
  });

  test("week shadow read flag is wired only in week-shadow API route", () => {
    const scanRoots = ["app", "components"];
    const offenders: string[] = [];
    for (const root of scanRoots) {
      for (const filePath of walkFiles(path.join(ROOT, root))) {
        const r = rel(filePath).replace(/\\/g, "/");
        if (r.includes("/tests/")) continue;
        if (r === CANONICAL_WEEK_SHADOW_API_ROUTE) continue;
        const src = fs.readFileSync(filePath, "utf8");
        if (
          src.includes("isMenuProfileWeekShadowReadEnabled") ||
          src.includes("LP_MENU_PROFILE_WEEK_SHADOW_READ")
        ) {
          offenders.push(r);
        }
      }
    }
    expect(
      offenders,
      `week shadow read flag wired outside week-shadow API:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test("menuProfileResolverHostEnv does not expose week shadow read yet", () => {
    const src = readSource("lib/providers/providerMenuProfileDiagnostic.ts");
    expect(src).not.toContain("LP_MENU_PROFILE_WEEK_SHADOW_READ");
  });
});

describe("G5d.5b — week shadow output contract fixture", () => {
  test("fixture enforces shadowOnly, providerOnly, and zero change counters", () => {
    const dto: WeekShadowEvaluationDto = G5D5_WEEK_SHADOW_CONTRACT_FIXTURE;
    expect(dto.shadowOnly).toBe(true);
    expect(dto.providerOnly).toBe(true);
    expect(dto.currentWeekUnchanged).toBe(true);
    expect(dto.employeeVisibleChanges).toBe(0);
    expect(dto.orderChanges).toBe(0);
    expect(dto.weekResponseChanges).toBe(0);
    expect(dto.priceVisibleChanges).toBe(0);
    expect(dto.commercialVisibleChanges).toBe(0);
    expect(dto.comparison.hashesEqual).toBe(true);
  });

  test("fixture has no forbidden output or source-of-truth fields", () => {
    for (const field of WEEK_SHADOW_FORBIDDEN_OUTPUT_FIELDS) {
      expect(Object.keys(G5D5_WEEK_SHADOW_CONTRACT_FIXTURE)).not.toContain(field);
    }
    const notes = [
      ...G5D5_WEEK_SHADOW_CONTRACT_FIXTURE.comparison.notes,
      ...G5D5_WEEK_SHADOW_CONTRACT_FIXTURE.wouldAffectDays.flatMap((d) => d.notes),
    ].join(" ");
    for (const word of WEEK_SHADOW_FORBIDDEN_SOURCE_OF_TRUTH_WORDS) {
      expect(notes.toLowerCase()).not.toMatch(new RegExp(`\\b${word}\\b`, "i"));
    }
  });
});

describe("G5d.5b — design document contract guards", () => {
  test("G5d5 design audit document exists", () => {
    expect(fs.existsSync(path.join(ROOT, G5D5_DESIGN_DOC))).toBe(true);
  });

  test("design doc locks Production OFF, no /week change, and explicit GO gates", () => {
    const doc = readSource(G5D5_DESIGN_DOC);
    expect(doc).toContain("LP_MENU_PROFILE_WEEK_SHADOW_READ");
    expect(doc).toMatch(/Production.*OFF/i);
    expect(doc).toMatch(/no Sanity write|Sanity writes|Write to Sanity/i);
    expect(doc).toMatch(/no `\/week` changes|Alter `GET \/api\/week`|no \/week runtime change/i);
    expect(doc).toMatch(/employee|employeeVisibleChanges|Employee visibility/i);
    expect(doc).toMatch(/order|orderChanges|order write-path/i);
    expect(doc).toMatch(/menuDayPayload mutation|Mutate `menuDayPayload`/i);
    expect(doc).toMatch(/G5d\.5b.*explicit GO|G5d\.5b requires.*explicit GO/i);
    expect(doc).toMatch(/G5d\.6 must not start|not authorized here/i);
    expect(doc).toMatch(/no Production flags|Production OFF/i);
  });
});

describe("G5d.5b — future week shadow module import guards", () => {
  test("future week shadow server/API files must not import forbidden runtime modules", () => {
    const files = existingFutureWeekShadowFiles().filter(
      (p) => !p.includes(`${path.sep}tests${path.sep}`),
    );
    if (files.length === 0) return;

    const offenders: string[] = [];
    for (const filePath of files) {
      const src = fs.readFileSync(filePath, "utf8");
      for (const pattern of FUTURE_WEEK_SHADOW_FORBIDDEN_IMPORTS) {
        if (pattern.test(src)) {
          offenders.push(`${rel(filePath)} → ${pattern}`);
          break;
        }
      }
    }
    expect(offenders, `forbidden imports in week shadow files:\n${offenders.join("\n")}`).toEqual(
      [],
    );
  });

  test("week-shadow API route may exist only at canonical path and uses flag gate", () => {
    expect(fs.existsSync(path.join(ROOT, CANONICAL_WEEK_SHADOW_API_ROUTE))).toBe(true);

    const src = readSource(CANONICAL_WEEK_SHADOW_API_ROUTE);
    expect(src).toContain('import "server-only"');
    expect(src).toContain("isMenuProfileWeekShadowReadEnabled");
    expect(src).toContain("buildRuntimeMappingWeekShadowEvaluation");

    const offenders: string[] = [];
    for (const filePath of walkFiles(path.join(ROOT, "app/api/provider/menu-profile"))) {
      const r = rel(filePath).replace(/\\/g, "/");
      if (r === CANONICAL_WEEK_SHADOW_API_ROUTE) continue;
      const fileSrc = fs.readFileSync(filePath, "utf8");
      if (/menu-profile\/week-shadow\/route/.test(r) || /week-shadow\/route/.test(fileSrc)) {
        offenders.push(r);
      }
    }
    expect(
      offenders,
      `week shadow API duplicated outside canonical path:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test("week shadow helper may exist only at lib/menu-profile/runtimeMappingWeekShadow.server.ts", () => {
    const helperPath = path.join(ROOT, "lib/menu-profile/runtimeMappingWeekShadow.server.ts");
    expect(fs.existsSync(helperPath)).toBe(true);

    const src = readSource("lib/menu-profile/runtimeMappingWeekShadow.server.ts");
    expect(src).toContain('import "server-only"');

    const offenders: string[] = [];
    for (const filePath of walkFiles(path.join(ROOT, "lib/menu-profile"))) {
      const r = rel(filePath).replace(/\\/g, "/");
      if (r === "lib/menu-profile/runtimeMappingWeekShadow.server.ts") continue;
      if (r === "lib/menu-profile/runtimeMappingWeekShadowTypes.ts") continue;
      const fileSrc = fs.readFileSync(filePath, "utf8");
      if (/runtimeMappingWeekShadow\.server/.test(fileSrc)) {
        offenders.push(r);
      }
    }
    expect(
      offenders,
      `week shadow helper duplicated outside canonical path:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test("week shadow helper may be imported only by week-shadow API route in app/", () => {
    const scanRoots = ["app", "components"];
    const offenders: string[] = [];
    for (const root of scanRoots) {
      for (const filePath of walkFiles(path.join(ROOT, root))) {
        const r = rel(filePath).replace(/\\/g, "/");
        if (r.includes("/tests/")) continue;
        if (r === CANONICAL_WEEK_SHADOW_API_ROUTE) continue;
        const src = fs.readFileSync(filePath, "utf8");
        if (WEEK_SHADOW_MODULE_IMPORT.test(src)) {
          offenders.push(r);
        }
      }
    }
    expect(
      offenders,
      `week shadow helper imported outside week-shadow API:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test("week-shadow API route must not import /week runtime or forbidden modules", () => {
    const src = readSource(CANONICAL_WEEK_SHADOW_API_ROUTE);
    expect(src).not.toMatch(/from\s+["']@\/app\/api\/week/);
    expect(src).not.toMatch(/from\s+["']@\/app\/\(app\)\/week/);
    expect(src).not.toMatch(/from\s+["']@\/lib\/week/);
    expect(src).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
    for (const pattern of FUTURE_WEEK_SHADOW_FORBIDDEN_IMPORTS) {
      expect(src, `week-shadow API → ${pattern}`).not.toMatch(pattern);
    }
  });
});

describe("G5d.5b — protected runtime paths must not import week shadow", () => {
  test("protected paths must not import runtimeMappingWeekShadow helper or week-shadow API", () => {
    const files = [
      ...filesUnderPrefixes(PROTECTED_PREFIXES),
      ...PROTECTED_FILES.map((f) => path.join(ROOT, f)).filter((p) => fs.existsSync(p)),
    ];
    const offenders: string[] = [];
    for (const filePath of files) {
      const r = rel(filePath);
      if (r.includes(`${path.sep}tests${path.sep}`)) continue;
      const src = fs.readFileSync(filePath, "utf8");
      if (WEEK_SHADOW_MODULE_IMPORT.test(src) || WEEK_SHADOW_API_IMPORT.test(src)) {
        offenders.push(r);
      }
    }
    expect(
      offenders,
      `week shadow leaked into protected runtime:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

describe("G5d.5b — runtime separation from employee/week/order/menuDayPayload surfaces", () => {
  const REFERENCE_PATTERNS = [
    /week-shadow/,
    /runtimeMappingWeekShadow/,
    /LP_MENU_PROFILE_WEEK_SHADOW_READ/,
    /WeekShadowEvaluation/,
  ];

  function assertNoWeekShadowReferences(prefixes: string[], label: string) {
    const offenders: string[] = [];
    for (const filePath of filesUnderPrefixes(prefixes)) {
      const r = rel(filePath);
      if (r.includes(`${path.sep}tests${path.sep}`)) continue;
      const src = fs.readFileSync(filePath, "utf8");
      for (const pattern of REFERENCE_PATTERNS) {
        if (pattern.test(src)) {
          offenders.push(`${r} → ${pattern}`);
          break;
        }
      }
    }
    expect(
      offenders,
      `${label} must not reference week shadow read:\n${offenders.join("\n")}`,
    ).toEqual([]);
  }

  test("employee week UI has no week-shadow references", () => {
    assertNoWeekShadowReferences(["app/(app)/week"], "employee week UI");
  });

  test("week API and lib have no week-shadow references", () => {
    assertNoWeekShadowReferences(["app/api/week", "lib/week"], "week runtime");
  });

  test("order runtime has no week-shadow references", () => {
    assertNoWeekShadowReferences(["app/api/orders", "lib/orders"], "order runtime");
  });

  test("menuDayPayload has no week-shadow references", () => {
    const src = readSource("lib/provider-menu/menuDayPayload.ts");
    for (const pattern of REFERENCE_PATTERNS) {
      expect(src, `menuDayPayload → ${pattern}`).not.toMatch(pattern);
    }
  });

  test("public customer pages have no week-shadow references", () => {
    const publicRoots = ["app/(public)", "app/(marketing)"].filter((p) =>
      fs.existsSync(path.join(ROOT, p)),
    );
    if (publicRoots.length === 0) return;
    assertNoWeekShadowReferences(publicRoots, "public pages");
  });

  test("provider UI must not import runtimeMappingWeekShadow", () => {
    const providersDir = path.join(ROOT, "components/providers");
    if (!fs.existsSync(providersDir)) return;

    const offenders: string[] = [];
    for (const filePath of walkFiles(providersDir)) {
      const src = fs.readFileSync(filePath, "utf8");
      if (WEEK_SHADOW_MODULE_IMPORT.test(src) || src.includes("runtimeMappingWeekShadow")) {
        offenders.push(rel(filePath));
      }
    }
    expect(offenders, `provider UI imports week shadow helper:\n${offenders.join("\n")}`).toEqual(
      [],
    );
  });
});
