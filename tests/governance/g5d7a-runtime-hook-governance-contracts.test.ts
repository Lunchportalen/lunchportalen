/**
 * G5d.7a — Future runtime hook contract/governance tests (tests only).
 * Locks boundaries before G5d.7b adapter / G5d.7c hook implementation.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = process.cwd();
const G5D7_DESIGN_DOC = "docs/engineering/G5d7-compatibility-cutover-design-plan.md";

const RUNTIME_HOOK_FLAG = "LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK";
const EMPLOYEE_PROFILE_RUNTIME_FLAG = "LP_MENU_PROFILE_EMPLOYEE_PROFILE_RUNTIME";

const FUTURE_HOOK_HELPER_PATH = "lib/menu-profile/weekRuntimeCompatibilityResolver.server.ts";
const FUTURE_HOOK_TEST_PATH = "tests/lib/menu-profile/weekRuntimeCompatibilityResolver.test.ts";
const G5D7C_WEEK_HOOK_BOUNDARY_PATH = "lib/menu-profile/weekRuntimeCompatibilityHook.server.ts";
const G5D7C_WEEK_HOOK_ROUTE_PATH = "app/api/week/route.ts";
const G5D7C_HOOK_UNIT_TEST_PATH = "tests/lib/menu-profile/weekRuntimeCompatibilityHook.test.ts";
const G5D7C_WEEK_API_TEST_PATH = "tests/api/week-runtime-compatibility-hook.test.ts";

const G5D7C_WEEK_HOOK_BOUNDARY_PATHS = [
  G5D7C_WEEK_HOOK_ROUTE_PATH,
  G5D7C_WEEK_HOOK_BOUNDARY_PATH,
] as const;

const G5D8_CONTROL_PATH = "lib/menu-profile/g5d8RuntimeCompatibilityControl.ts";
const G5D8_CONTROL_TEST_PATH = "tests/lib/menu-profile/g5d8RuntimeCompatibilityControl.test.ts";

const RUNTIME_HOOK_FLAG_ALLOWED_PATHS = [
  "lib/menu-profile/featureFlag.ts",
  G5D8_CONTROL_PATH,
  ...G5D7C_WEEK_HOOK_BOUNDARY_PATHS,
  FUTURE_HOOK_HELPER_PATH,
  FUTURE_HOOK_TEST_PATH,
  G5D7C_HOOK_UNIT_TEST_PATH,
  G5D8_CONTROL_TEST_PATH,
  G5D7C_WEEK_API_TEST_PATH,
  "lib/providers/providerMenuProfileDiagnostic.ts",
  "tests/lib/providers/providerMenuProfileDiagnostic.test.ts",
  "lib/server/superadmin/loadSuperadminMenuProfileOverview.ts",
];

const G5D7_GOVERNANCE_ALLOWED_PATHS = [
  G5D7_DESIGN_DOC,
  "tests/governance/g5d7-compatibility-cutover-design-contracts.test.ts",
  "tests/governance/g5d7a-runtime-hook-governance-contracts.test.ts",
  "docs/engineering/G5d6-compatibility-cutover-design-audit.md",
  "docs/engineering/G5d6e-compatibility-cutover-smoke-evidence.md",
  FUTURE_HOOK_HELPER_PATH,
  FUTURE_HOOK_TEST_PATH,
  G5D7C_WEEK_HOOK_BOUNDARY_PATH,
  G5D7C_WEEK_HOOK_ROUTE_PATH,
  G5D7C_HOOK_UNIT_TEST_PATH,
  G5D7C_WEEK_API_TEST_PATH,
  G5D8_CONTROL_PATH,
  G5D8_CONTROL_TEST_PATH,
  "lib/menu-generator/sotFeatureFlag.ts",
  "lib/menu-generator/localizedGeneratorSotResolver.ts",
  "lib/menu-generator/localizedGeneratorSotControl.ts",
  "lib/menu-generator/sotMsdiItemMapping.ts",
  "lib/menu-generator/sotMsdiMappingPolicy.ts",
  "lib/menu-publish/msdiLocalizedItemSnapshot.ts",
  "lib/menu-publish/syncMenuServiceDayItems.ts",
  "tests/lib/menu-generator/localizedGeneratorSotFeatureFlag.test.ts",
  "tests/lib/menu-generator/localizedGeneratorSotResolver.test.ts",
  "tests/lib/menu-generator/sotMsdiItemMapping.test.ts",
  "tests/sync-menu-service-day-items.test.ts",
  "tests/governance/localized-generator-sot-runtime-hook-governance-contracts.test.ts",
  "docs/engineering/localized-generator-sot-cutover-implementation-plan.md",
  "docs/runbooks/g5d8-planning.md",
];

const FUTURE_HOOK_ALLOWED_RUNTIME_PATHS = [
  FUTURE_HOOK_HELPER_PATH,
  FUTURE_HOOK_TEST_PATH,
  G5D7C_WEEK_HOOK_BOUNDARY_PATH,
];

const PROPOSED_FLAG_TOKENS = [EMPLOYEE_PROFILE_RUNTIME_FLAG] as const;

const RUNTIME_HOOK_FLAG_TOKENS = [RUNTIME_HOOK_FLAG] as const;

const HOOK_REFERENCE_PATTERNS = [
  /LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK/,
  /LP_MENU_PROFILE_EMPLOYEE_PROFILE_RUNTIME/,
  /weekRuntimeCompatibilityResolver/,
  /isMenuProfileRuntimeCompatibilityHookEnabled/,
  /isMenuProfileEmployeeProfileRuntimeEnabled/,
  /runtime compatibility hook/i,
];

const SOURCE_OF_TRUTH_SWITCH_TOKENS = [
  "useProfileRuntimeAsSource",
  "sourceOfTruthSwitch",
  "menuProfileSourceOfTruth",
  "promoteCandidate",
  "activateCandidate",
  "applyCandidateToWeek",
  "orderableCandidate",
  "candidateOrderable",
] as const;

const SOURCE_OF_TRUTH_SWITCH_PATTERNS = [
  /\bautoRollout\b/,
  /\bauto-rollout\b/,
] as const;

function containsSourceOfTruthSwitchToken(src: string): string | null {
  for (const token of SOURCE_OF_TRUTH_SWITCH_TOKENS) {
    if (src.includes(token)) return token;
  }
  for (const pattern of SOURCE_OF_TRUTH_SWITCH_PATTERNS) {
    if (pattern.test(src)) return String(pattern);
  }
  return null;
}

const COMMERCIAL_SENSITIVE_TOKENS = [
  "provider_price_rules",
  "pricePreview",
  "commission",
  "provisjon",
  "vat",
  "mva",
  "billing",
  "Tripletex",
  "commercialVisibleChanges",
  "priceVisibleChanges",
] as const;

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
  "components/providers",
];

const PROTECTED_FILES = [
  "lib/provider-menu/menuDayPayload.ts",
  "lib/provider-menu/menuCatalogWrite.ts",
  "app/api/week/route.ts",
];

const ENV_CONFIG_SCAN_PATHS = [
  ".env.example",
  ".env.production.example",
  "vercel.json",
  "render.yaml",
];

const RUNTIME_SCAN_ROOTS = ["app", "components", "lib"] as const;

const G5D6_RUNTIME_ALLOWED_PREFIXES = [
  "lib/menu-profile/runtimeCompatibilityCutover",
  "lib/menu-profile/runtimeCompatibilityCutoverTypes",
  "app/api/provider/menu-profile/compatibility-cutover",
];

const FUTURE_HOOK_FORBIDDEN_IMPORTS = [
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
  /buildMenuDayPayload/,
  /EmployeeWeekClient/,
  /provider_price_rules/,
  /pricePreview/,
  /from\s+["']@\/app\/api\/week/,
  /from\s+["']@\/app\/\(app\)\/week/,
  /employeePayload/,
  /orderPayload/,
  /compatibilityCutover/,
  /weekShadow/,
  /publishShadow/,
];

const HOOK_MODULE_IMPORT =
  /from\s+["']@\/lib\/menu-profile\/weekRuntimeCompatibilityResolver|weekRuntimeCompatibilityResolver\.server/;

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function readFileIfExists(absPath: string): string | null {
  if (!fs.existsSync(absPath)) return null;
  try {
    return fs.readFileSync(absPath, "utf8");
  } catch {
    return null;
  }
}

function rel(absPath: string): string {
  return path.normalize(path.relative(ROOT, absPath)).replace(/\\/g, "/");
}

/** Strip comments so governance-only mentions (e.g. “no auto-rollout”) do not false-positive. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, " ");
}

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (
        ent.name === "node_modules" ||
        ent.name === ".next" ||
        ent.name === ".git" ||
        ent.name === ".backups" ||
        ent.name === "test-results" ||
        ent.name === "playwright-report" ||
        ent.name === "temp" ||
        ent.name === "coverage" ||
        ent.name === "artifacts" ||
        ent.name.startsWith("artifacts-") ||
        ent.name === ".cursor"
      ) {
        continue;
      }
      walkFiles(p, out);
    } else if (/\.(ts|tsx|js|jsx|mjs|json|yaml|yml|env)$/.test(ent.name)) {
      // Phase 18 evidence dumps are not runtime wiring and can be multi-GB.
      const r = rel(p);
      if (r.includes("/artifacts-") || r.includes("/artifacts/")) continue;
      if (r.startsWith("docs/rc/phase18scale/") && /\.(ndjson|json)$/.test(ent.name)) continue;
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

function isG5d7GovernanceAllowedPath(fileRel: string): boolean {
  return G5D7_GOVERNANCE_ALLOWED_PATHS.some((p) => fileRel === p.replace(/\\/g, "/"));
}

function isRuntimeHookFlagAllowedPath(fileRel: string): boolean {
  return RUNTIME_HOOK_FLAG_ALLOWED_PATHS.some((p) => fileRel === p.replace(/\\/g, "/"));
}

function isFutureHookAllowedRuntimePath(fileRel: string): boolean {
  return FUTURE_HOOK_ALLOWED_RUNTIME_PATHS.some((p) => fileRel === p.replace(/\\/g, "/"));
}

function isG5d7cWeekHookBoundaryPath(fileRel: string): boolean {
  return G5D7C_WEEK_HOOK_BOUNDARY_PATHS.some((p) => fileRel === p.replace(/\\/g, "/"));
}

function isG5d6RuntimeAllowedPath(fileRel: string): boolean {
  return G5D6_RUNTIME_ALLOWED_PREFIXES.some((prefix) => fileRel.includes(prefix.replace(/\\/g, "/")));
}

function isRuntimeScopeFile(fileRel: string): boolean {
  if (fileRel.includes("/tests/")) return false;
  if (isG5d7GovernanceAllowedPath(fileRel)) return false;
  if (isFutureHookAllowedRuntimePath(fileRel)) return false;
  if (isG5d6RuntimeAllowedPath(fileRel)) return false;
  return (
    fileRel.startsWith("app/") ||
    fileRel.startsWith("components/") ||
    fileRel.startsWith("lib/")
  );
}

function assertNoHookReferences(prefixes: string[], label: string) {
  const offenders: string[] = [];
  for (const filePath of filesUnderPrefixes(prefixes)) {
    const r = rel(filePath);
    if (r.includes("/tests/")) continue;
    if (isG5d7GovernanceAllowedPath(r)) continue;
    const src = fs.readFileSync(filePath, "utf8");
    for (const pattern of HOOK_REFERENCE_PATTERNS) {
      if (pattern.test(src)) {
        offenders.push(`${r} → ${pattern}`);
        break;
      }
    }
  }
  expect(offenders, `${label} must not reference G5d.7 runtime hook:\n${offenders.join("\n")}`).toEqual(
    [],
  );
}

function existingFutureHookFiles(): string[] {
  return FUTURE_HOOK_ALLOWED_RUNTIME_PATHS.map((p) => path.join(ROOT, p)).filter((p) =>
    fs.existsSync(p),
  );
}

describe("G5d.7a — G5d.7 design remains planning only", () => {
  test("G5d7 design plan document exists", () => {
    expect(fs.existsSync(path.join(ROOT, G5D7_DESIGN_DOC))).toBe(true);
  });

  test("design plan locks planning only, no implementation, and explicit GO", () => {
    const doc = readSource(G5D7_DESIGN_DOC);
    expect(doc).toMatch(/design\/planning only|Design \/ planning only/i);
    expect(doc).toMatch(/no runtime changes|no API changes|no UI changes|no DB\/RLS changes/i);
    expect(doc).toMatch(/no `\/week` changes|no \/week changes|\/week` changes/i);
    expect(doc).toMatch(/no implementation|not implementation/i);
    expect(doc).toMatch(/explicit GO|separate explicit GO/i);
    expect(doc).toMatch(/Production activation requires.*separate|separate final GO/i);
    expect(doc).toMatch(/G5d\.8.*not started|not authorized from G5d\.7/i);
    expect(doc).toMatch(/G5d\.7 \(this PR\) authorizes none of the above/i);
  });
});

describe("G5d.7a/7c — runtime hook flag and employee proposed flag guards", () => {
  test("featureFlag.ts exports G5d.7c hook helper but not employee exposure flag", () => {
    const src = readSource("lib/menu-profile/featureFlag.ts");
    expect(src).toContain("LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK");
    expect(src).toContain("isMenuProfileRuntimeCompatibilityHookEnabled");
    expect(src).not.toContain("LP_MENU_PROFILE_EMPLOYEE_PROFILE_RUNTIME");
    expect(src).not.toContain("isMenuProfileEmployeeProfileRuntimeEnabled");
  });

  test("LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK appears only in allowed paths", () => {
    const offenders: string[] = [];
    for (const token of RUNTIME_HOOK_FLAG_TOKENS) {
      for (const filePath of walkFiles(ROOT)) {
        const r = rel(filePath);
        if (!/\.(ts|tsx|js|jsx|mjs|json|yaml|yml|env|md)$/.test(r)) continue;
        if (r.includes("node_modules/") || r.includes(".next/")) continue;
        // Generated repo inventory indexes source symbols; it is not runtime wiring.
        if (r.startsWith("repo-intelligence/")) continue;
        if (isG5d7GovernanceAllowedPath(r)) continue;
        if (isRuntimeHookFlagAllowedPath(r)) continue;
        const src = fs.readFileSync(filePath, "utf8");
        if (src.includes(token)) {
          offenders.push(`${r} → ${token}`);
        }
      }
    }
    expect(
      offenders,
      `runtime hook flag wired outside allowed G5d.7c paths:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test(
    "LP_MENU_PROFILE_EMPLOYEE_PROFILE_RUNTIME appears only in docs/governance",
    () => {
      const offenders: string[] = [];
      for (const token of PROPOSED_FLAG_TOKENS) {
        for (const filePath of walkFiles(ROOT)) {
          const r = rel(filePath);
          if (!/\.(ts|tsx|js|jsx|mjs|json|yaml|yml|env|md)$/.test(r)) continue;
          if (r.includes("node_modules/") || r.includes(".next/")) continue;
          // Generated repo inventory indexes source symbols; it is not runtime wiring.
          if (r.startsWith("repo-intelligence/")) continue;
          if (isG5d7GovernanceAllowedPath(r)) continue;
          const src = fs.readFileSync(filePath, "utf8");
          if (src.includes(token)) {
            offenders.push(`${r} → ${token}`);
          }
        }
      }
      expect(
        offenders,
        `employee profile runtime flag wired outside docs/governance:\n${offenders.join("\n")}`,
      ).toEqual([]);
    },
    180_000,
  );

  test("components have no runtime hook flag wiring", () => {
    const offenders: string[] = [];
    for (const filePath of walkFiles(path.join(ROOT, "components"))) {
      const r = rel(filePath);
      const src = fs.readFileSync(filePath, "utf8");
      for (const token of [...RUNTIME_HOOK_FLAG_TOKENS, ...PROPOSED_FLAG_TOKENS]) {
        if (src.includes(token)) offenders.push(`${r} → ${token}`);
      }
    }
    expect(offenders, `hook flags in components:\n${offenders.join("\n")}`).toEqual([]);
  });

  test("lib/week has no runtime hook flag wiring", () => {
    assertNoHookReferences(["lib/week"], "lib/week");
  });
});

describe("G5d.7a/7b — pure adapter exists but is not wired", () => {
  test("canonical adapter and unit test paths are documented", () => {
    const doc = readSource(G5D7_DESIGN_DOC);
    expect(doc).toContain(FUTURE_HOOK_HELPER_PATH);
    expect(doc).toContain(FUTURE_HOOK_TEST_PATH);
  });

  test("G5d.7b adapter exists at canonical path only", () => {
    expect(fs.existsSync(path.join(ROOT, FUTURE_HOOK_HELPER_PATH))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, FUTURE_HOOK_TEST_PATH))).toBe(true);
  });

  test("G5d.7b adapter is server-only pure helper with no writes or forbidden imports", () => {
    const src = readSource(FUTURE_HOOK_HELPER_PATH);
    expect(src).toMatch(/import\s+["']server-only["']/);
    expect(src).not.toMatch(/\.insert\s*\(|\.delete\s*\(|\.upsert\s*\(/);
    const importBlock = src
      .split(/\r?\n/)
      .filter((line) => /^\s*import\s/.test(line))
      .join("\n");
    expect(importBlock).not.toMatch(/process\.env/);
    expect(importBlock).not.toMatch(/featureFlag/);
    expect(importBlock).not.toMatch(/from\s+["']@\/lib\/week/);
    expect(importBlock).not.toMatch(/from\s+["']@\/components/);
    expect(importBlock).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/candidateOrderable:\s*true/);
    expect(src).not.toMatch(/autoRollout:\s*true/);
    expect(src).not.toMatch(/\bauto-rollout\b/);
    for (const token of SOURCE_OF_TRUTH_SWITCH_TOKENS) {
      if (token === "candidateOrderable") {
        expect(src).not.toMatch(/candidateOrderable:\s*true/);
        continue;
      }
      expect(src, `adapter → ${token}`).not.toContain(token);
    }
    for (const pattern of FUTURE_HOOK_FORBIDDEN_IMPORTS) {
      expect(importBlock, `adapter imports → ${pattern}`).not.toMatch(pattern);
    }
  });

  test("G5d.7c week route imports hook boundary only, not adapter directly", () => {
    const src = readSource(G5D7C_WEEK_HOOK_ROUTE_PATH);
    expect(src).toContain("weekRuntimeCompatibilityHook.server");
    expect(src).toContain("maybeRunWeekRuntimeCompatibilityHook");
    expect(src).not.toMatch(HOOK_MODULE_IMPORT);
    expect(src).not.toContain("buildWeekRuntimeCompatibilityDecision");
  });

  test("G5d.7c hook boundary is server-only and imports adapter only", () => {
    const src = readSource(G5D7C_WEEK_HOOK_BOUNDARY_PATH);
    expect(src).toMatch(/import\s+["']server-only["']/);
    expect(src).toContain("buildWeekRuntimeCompatibilityDecision");
    expect(src).toContain("isMenuProfileRuntimeCompatibilityHookEnabled");
    expect(src).not.toMatch(/\.insert\s*\(|\.delete\s*\(|\.upsert\s*\(/);
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/candidateOrderable:\s*true/);
    expect(src).not.toMatch(/sourceOfTruthSwitch/);
    expect(src).not.toMatch(/promoteCandidate/);
  });

  test("G5d.7b adapter server file must not import forbidden runtime modules", () => {
    const files = existingFutureHookFiles().filter(
      (p) =>
        !p.includes(`${path.sep}tests${path.sep}`) &&
        p.endsWith(".server.ts") &&
        p.includes("weekRuntimeCompatibilityResolver.server.ts"),
    );
    expect(files.length).toBe(1);

    const offenders: string[] = [];
    const importBlock = fs
      .readFileSync(files[0]!, "utf8")
      .split(/\r?\n/)
      .filter((line) => /^\s*import\s/.test(line))
      .join("\n");
    for (const pattern of FUTURE_HOOK_FORBIDDEN_IMPORTS) {
      if (pattern.test(importBlock)) {
        offenders.push(`${rel(files[0]!)} → ${pattern}`);
      }
    }
    expect(
      offenders,
      `forbidden imports in G5d.7b adapter:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test("G5d.7b adapter must not be imported by components, provider UI, or employee UI", () => {
    const prefixes = ["components", "app/(app)/week", "app/leverandor"];
    const offenders: string[] = [];
    for (const prefix of prefixes) {
      const dir = path.join(ROOT, prefix);
      if (!fs.existsSync(dir)) continue;
      for (const filePath of walkFiles(dir)) {
        const r = rel(filePath);
        if (r === FUTURE_HOOK_HELPER_PATH) continue;
        const src = fs.readFileSync(filePath, "utf8");
        if (HOOK_MODULE_IMPORT.test(src) || src.includes("weekRuntimeCompatibilityResolver")) {
          offenders.push(r);
        }
      }
    }
    expect(
      offenders,
      `G5d.7b adapter imported by UI before G5d.7c:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

describe("G5d.7a — protected paths have no hook refs", () => {
  test("week API and lib have no G5d.7 runtime hook references", () => {
    assertNoHookReferences(["app/api/week", "lib/week"], "week runtime");
  });

  test("employee week UI has no G5d.7 runtime hook references", () => {
    assertNoHookReferences(["app/(app)/week", "components/employee", "components/week"], "employee week UI");
  });

  test("order runtime has no G5d.7 runtime hook references", () => {
    assertNoHookReferences(["app/api/orders", "app/api/order", "lib/orders"], "order runtime");
  });

  test("publish/Sanity/menuDayPayload have no G5d.7 runtime hook references", () => {
    assertNoHookReferences(
      ["lib/menu-publish", "lib/sanity", "lib/cms"],
      "publish/Sanity runtime",
    );
    const src = readSource("lib/provider-menu/menuDayPayload.ts");
    for (const pattern of HOOK_REFERENCE_PATTERNS) {
      expect(src, `menuDayPayload → ${pattern}`).not.toMatch(pattern);
    }
  });

  test("billing/Tripletex and provider UI have no G5d.7 runtime hook references", () => {
    assertNoHookReferences(["lib/integrations/tripletex"], "Tripletex runtime");
    assertNoHookReferences(["components/providers"], "provider UI");
  });

  test("public customer pages have no G5d.7 runtime hook references", () => {
    const publicRoots = ["app/(public)", "app/(marketing)"].filter((p) =>
      fs.existsSync(path.join(ROOT, p)),
    );
    if (publicRoots.length === 0) return;
    assertNoHookReferences(publicRoots, "public pages");
  });

  test("protected paths must not import weekRuntimeCompatibilityResolver helper directly", () => {
    const files = [
      ...filesUnderPrefixes(PROTECTED_PREFIXES),
      ...PROTECTED_FILES.map((f) => path.join(ROOT, f)).filter((p) => fs.existsSync(p)),
    ];
    const offenders: string[] = [];
    for (const filePath of files) {
      const r = rel(filePath);
      if (r.includes("/tests/")) continue;
      if (isG5d7cWeekHookBoundaryPath(r)) continue;
      const src = fs.readFileSync(filePath, "utf8");
      if (HOOK_MODULE_IMPORT.test(src) || src.includes("weekRuntimeCompatibilityResolver")) {
        offenders.push(r);
      }
    }
    expect(
      offenders,
      `G5d.7 resolver leaked into protected runtime:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test("only G5d.7c week boundary may import weekRuntimeCompatibilityHook.server", () => {
    const offenders: string[] = [];
    for (const root of ["app", "components", "lib"] as const) {
      for (const filePath of walkFiles(path.join(ROOT, root))) {
        const r = rel(filePath);
        if (r.includes("/tests/")) continue;
        if (isG5d7cWeekHookBoundaryPath(r)) continue;
        const src = fs.readFileSync(filePath, "utf8");
        if (/weekRuntimeCompatibilityHook\.server|maybeRunWeekRuntimeCompatibilityHook/.test(src)) {
          offenders.push(r);
        }
      }
    }
    expect(
      offenders,
      `hook boundary imported outside G5d.7c allowed paths:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

describe("G5d.7a — no source-of-truth switch / no auto-rollout in runtime", () => {
  test("runtime scopes do not contain G5d.7 source-of-truth switch tokens", () => {
    const offenders: string[] = [];
    for (const root of RUNTIME_SCAN_ROOTS) {
      for (const filePath of walkFiles(path.join(ROOT, root))) {
        const r = rel(filePath);
        if (!isRuntimeScopeFile(r)) continue;
        const src = readFileIfExists(filePath);
        if (src === null) continue;
        const hit = containsSourceOfTruthSwitchToken(stripComments(src));
        if (hit) {
          offenders.push(`${r} → ${hit}`);
        }
      }
    }
    expect(
      offenders,
      `source-of-truth / auto-rollout tokens in runtime:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test("runtime does not couple G5d.7 hook flags with auto-rollout", () => {
    const offenders: string[] = [];
    for (const root of RUNTIME_SCAN_ROOTS) {
      for (const filePath of walkFiles(path.join(ROOT, root))) {
        const r = rel(filePath);
        if (!isRuntimeScopeFile(r)) continue;
        const src = readFileIfExists(filePath);
        if (src === null) continue;
        const hasHook =
          RUNTIME_HOOK_FLAG_TOKENS.some((t) => src.includes(t)) ||
          PROPOSED_FLAG_TOKENS.some((t) => src.includes(t)) ||
          src.includes("weekRuntimeCompatibilityResolver") ||
          src.includes("weekRuntimeCompatibilityHook");
        if (hasHook && /runMenuWeekRollout|auto-rollout|autoRollout/.test(src)) {
          offenders.push(r);
        }
      }
    }
    expect(
      offenders,
      `auto-rollout coupled to G5d.7 hook:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

describe("G5d.7a — employee/commercial boundary", () => {
  test("runtime scopes do not combine G5d.7 hook terms with commercial-sensitive terms", () => {
    const offenders: string[] = [];
    for (const root of RUNTIME_SCAN_ROOTS) {
      for (const filePath of walkFiles(path.join(ROOT, root))) {
        const r = rel(filePath);
        if (!isRuntimeScopeFile(r)) continue;
        const src = readFileIfExists(filePath);
        if (src === null) continue;
        const hasHook =
          HOOK_REFERENCE_PATTERNS.some((p) => p.test(src)) ||
          RUNTIME_HOOK_FLAG_TOKENS.some((t) => src.includes(t)) ||
          PROPOSED_FLAG_TOKENS.some((t) => src.includes(t));
        if (!hasHook) continue;
        for (const token of COMMERCIAL_SENSITIVE_TOKENS) {
          if (src.includes(token)) {
            offenders.push(`${r} → hook + ${token}`);
            break;
          }
        }
      }
    }
    expect(
      offenders,
      `G5d.7 hook coupled to commercial fields:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

describe("G5d.7a — Production OFF / env guard", () => {
  test("no committed env/config sets proposed G5d.7 flags to true", () => {
    const offenders: string[] = [];
    for (const relPath of ENV_CONFIG_SCAN_PATHS) {
      const abs = path.join(ROOT, relPath);
      if (!fs.existsSync(abs)) continue;
      const src = readSource(relPath);
      for (const token of PROPOSED_FLAG_TOKENS) {
        const pattern = new RegExp(`${token}\\s*=\\s*true`, "i");
        if (pattern.test(src)) offenders.push(`${relPath} → ${token}=true`);
      }
    }
    expect(
      offenders,
      `env/config enables proposed G5d.7 flags:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test("design plan does not authorize Production ON for proposed hook flags", () => {
    const doc = readSource(G5D7_DESIGN_DOC);
    expect(doc).toMatch(/Production.*OFF/i);
    expect(doc).toMatch(/Do not add these flags in G5d\.7/i);
    expect(doc).toMatch(/separate final GO/i);
    expect(doc).not.toMatch(/Production ON for.*RUNTIME_COMPATIBILITY_HOOK/i);
  });
});

describe("G5d.7a — G5d.7b/G5d.7c/G5d.8 requires explicit GO", () => {
  test("design plan documents phased implementation with explicit GO per phase", () => {
    const doc = readSource(G5D7_DESIGN_DOC);
    expect(doc).toMatch(/G5d\.7a/);
    expect(doc).toMatch(/G5d\.7b/);
    expect(doc).toMatch(/G5d\.7c/);
    expect(doc).toMatch(/G5d\.8/);
    expect(doc).toMatch(/explicit GO per phase|explicit GO.*phase/i);
    expect(doc).toMatch(/STOP before merge/i);
    expect(doc).toMatch(/G5d\.7a implementation GO.*Not granted|G5d\.7a.*GO/i);
    expect(doc).toMatch(/Production activation.*not allowed.*from G5d\.7/i);
    expect(doc).not.toMatch(/G5d\.7b implementation authorized from G5d\.7a/i);
    expect(doc).not.toMatch(/G5d\.7c implementation authorized from G5d\.7a/i);
  });
});
