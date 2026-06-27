/**
 * G5d.4b — Publish shadow contract/governance tests (tests only).
 * Locks boundaries before G5d.4c helper / G5d.4d API implementation.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import {
  LP_MENU_PROFILE_PUBLISH_SHADOW_ENV,
  isMenuProfilePublishShadowEnabled,
} from "@/lib/menu-profile/featureFlag";
import {
  G5D4_PUBLISH_SHADOW_CONTRACT_FIXTURE,
  PUBLISH_SHADOW_CLIENT_FORBIDDEN_BODY_FIELDS,
  type PublishShadowEvaluationDto,
} from "../fixtures/g5d4-publish-shadow-contract.constants";

const ROOT = process.cwd();
const G5D4_DESIGN_DOC = "docs/engineering/G5d4-publish-shadow-design-audit.md";

const FUTURE_SHADOW_ALLOWED_PATHS = [
  "lib/menu-profile/runtimeMappingPublishShadow.server.ts",
  "app/api/provider/menu-profile/publish-shadow/route.ts",
  "tests/lib/menu-profile/runtimeMappingPublishShadow.test.ts",
  "tests/api/provider/menu-profile-publish-shadow-api.test.ts",
];

const FUTURE_SHADOW_FORBIDDEN_IMPORTS = [
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
];

const SHADOW_MODULE_IMPORT =
  /from\s+["']@\/lib\/menu-profile\/runtimeMappingPublishShadow\.server|runtimeMappingPublishShadow\.server/;
const SHADOW_API_IMPORT = /publish-shadow\/route|menu-profile\/publish-shadow/;

const PROTECTED_PREFIXES = [
  "app/api/provider/menu-days",
  "app/api/provider/menu-catalog",
  "lib/menu-publish",
  "app/(app)/week",
  "app/api/week",
  "app/api/order/window",
  "lib/week",
  "app/api/orders",
  "lib/orders",
];

const PROTECTED_FILES = [
  "lib/provider-menu/menuDayPayload.ts",
  "lib/provider-menu/menuCatalogWrite.ts",
  "lib/provider-menu/varmrettSharedWrite.ts",
  "lib/integrations/tripletex/tripletexEngine.ts",
  "components/providers/ProviderMenuBuilder.tsx",
  "components/providers/ProviderMenuRuntimeMappingDraftSaveControls.tsx",
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

function existingFutureShadowFiles(): string[] {
  return FUTURE_SHADOW_ALLOWED_PATHS.map((p) => path.join(ROOT, p)).filter((p) => fs.existsSync(p));
}

describe("G5d.4b — LP_MENU_PROFILE_PUBLISH_SHADOW flag contract", () => {
  test("env key is stable", () => {
    expect(LP_MENU_PROFILE_PUBLISH_SHADOW_ENV).toBe("LP_MENU_PROFILE_PUBLISH_SHADOW");
  });

  test("defaults to false", () => {
    expect(isMenuProfilePublishShadowEnabled({})).toBe(false);
    expect(isMenuProfilePublishShadowEnabled({ [LP_MENU_PROFILE_PUBLISH_SHADOW_ENV]: undefined })).toBe(
      false,
    );
  });

  test('is true only for exact "true"', () => {
    expect(isMenuProfilePublishShadowEnabled({ [LP_MENU_PROFILE_PUBLISH_SHADOW_ENV]: "true" })).toBe(
      true,
    );
    expect(isMenuProfilePublishShadowEnabled({ [LP_MENU_PROFILE_PUBLISH_SHADOW_ENV]: "true\r\n" })).toBe(
      true,
    );
  });

  test("is false for non-true values", () => {
    for (const value of ["", "false", "1", "yes", "TRUE", "on"]) {
      expect(isMenuProfilePublishShadowEnabled({ [LP_MENU_PROFILE_PUBLISH_SHADOW_ENV]: value })).toBe(
        false,
      );
    }
  });

  test("publish shadow flag is only wired in publish-shadow API route", () => {
    const allowed = new Set(["app/api/provider/menu-profile/publish-shadow/route.ts"]);
    const scanRoots = ["app", "components"];
    const offenders: string[] = [];
    for (const root of scanRoots) {
      for (const filePath of walkFiles(path.join(ROOT, root))) {
        const r = rel(filePath).replace(/\\/g, "/");
        if (r.includes("/tests/")) continue;
        if (allowed.has(r)) continue;
        const src = fs.readFileSync(filePath, "utf8");
        if (
          src.includes("isMenuProfilePublishShadowEnabled") ||
          src.includes("LP_MENU_PROFILE_PUBLISH_SHADOW")
        ) {
          offenders.push(r);
        }
      }
    }
    expect(offenders, `publish shadow flag wired outside API route:\n${offenders.join("\n")}`).toEqual(
      [],
    );
  });

  test("menuProfileResolverHostEnv does not expose publish shadow yet", () => {
    const src = readSource("lib/providers/providerMenuProfileDiagnostic.ts");
    expect(src).not.toContain("LP_MENU_PROFILE_PUBLISH_SHADOW");
  });
});

describe("G5d.4b — publish shadow output contract fixture", () => {
  test("fixture enforces shadowOnly and zero publishImpact", () => {
    const dto: PublishShadowEvaluationDto = G5D4_PUBLISH_SHADOW_CONTRACT_FIXTURE;
    expect(dto.shadowOnly).toBe(true);
    expect(dto.publishImpact.runtimeWrites).toBe(0);
    expect(dto.publishImpact.sanityWrites).toBe(0);
    expect(dto.publishImpact.orderChanges).toBe(0);
    expect(dto.publishImpact.weekChanges).toBe(0);
    expect(dto.publishImpact.employeeVisibleChanges).toBe(0);
    expect(dto.comparisonToCurrentPublish.currentPublishUnchanged).toBe(true);
    expect(dto.warmDishPreviewSummary.previewOnly).toBe(true);
  });

  test("fixture has no source-of-truth activation fields", () => {
    for (const field of PUBLISH_SHADOW_CLIENT_FORBIDDEN_BODY_FIELDS) {
      if (field === "providerId") continue;
      expect(Object.keys(G5D4_PUBLISH_SHADOW_CONTRACT_FIXTURE)).not.toContain(field);
    }
    const notes = G5D4_PUBLISH_SHADOW_CONTRACT_FIXTURE.comparisonToCurrentPublish.notes.join(" ");
    for (const word of ["apply", "commit", "activate", "enable"]) {
      expect(notes.toLowerCase()).not.toMatch(new RegExp(`\\b${word}\\b`, "i"));
    }
  });

  test("providerId is server-side fixture only — not a client body field contract", () => {
    expect(G5D4_PUBLISH_SHADOW_CONTRACT_FIXTURE.providerId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(PUBLISH_SHADOW_CLIENT_FORBIDDEN_BODY_FIELDS).toContain("providerId");
  });
});

describe("G5d.4b — design document contract guards", () => {
  test("G5d4 design audit document exists", () => {
    expect(fs.existsSync(path.join(ROOT, G5D4_DESIGN_DOC))).toBe(true);
  });

  test("design doc locks Production OFF and explicit GO gates", () => {
    const doc = readSource(G5D4_DESIGN_DOC);
    expect(doc).toContain("LP_MENU_PROFILE_PUBLISH_SHADOW");
    expect(doc).toMatch(/Production.*OFF/i);
    expect(doc).toMatch(/no Sanity write|never writes to Sanity|Write to Sanity/i);
    expect(doc).toMatch(/\/week|weekChanges|Change `\/week`/i);
    expect(doc).toMatch(/order|orderChanges|Integrate orders/i);
    expect(doc).toMatch(/employee|employeeVisibleChanges|Employee visibility/i);
    expect(doc).toMatch(/G5d\.4b.*explicit GO|G5d\.4b requires.*explicit GO/i);
    expect(doc).toMatch(/G5d\.5 must not start|not authorized here/i);
    expect(doc).toMatch(/Never as routine rollback|Do not drop|do not drop/i);
  });
});

describe("G5d.4b — future shadow module import guards", () => {
  test("future shadow server/API files must not import forbidden runtime modules", () => {
    const files = existingFutureShadowFiles().filter((p) => !p.includes(`${path.sep}tests${path.sep}`));
    if (files.length === 0) return;

    const offenders: string[] = [];
    for (const filePath of files) {
      const src = fs.readFileSync(filePath, "utf8");
      for (const pattern of FUTURE_SHADOW_FORBIDDEN_IMPORTS) {
        if (pattern.test(src)) {
          offenders.push(`${rel(filePath)} → ${pattern}`);
          break;
        }
      }
    }
    expect(offenders, `forbidden imports in shadow files:\n${offenders.join("\n")}`).toEqual([]);
  });

  test("future shadow server/API files must not import menuDayPayload for mutation", () => {
    const files = existingFutureShadowFiles().filter((p) => !p.includes(`${path.sep}tests${path.sep}`));
    if (files.length === 0) return;

    for (const filePath of files) {
      const src = fs.readFileSync(filePath, "utf8");
      expect(src, rel(filePath)).not.toMatch(/buildMenuDayPayload/);
    }
  });
});

describe("G5d.4b — protected runtime paths must not import publish shadow", () => {
  test("protected paths must not import runtimeMappingPublishShadow helper", () => {
    const files = [
      ...filesUnderPrefixes(PROTECTED_PREFIXES),
      ...PROTECTED_FILES.map((f) => path.join(ROOT, f)).filter((p) => fs.existsSync(p)),
    ];
    const offenders: string[] = [];
    for (const filePath of files) {
      const r = rel(filePath);
      if (r.includes(`${path.sep}tests${path.sep}`)) continue;
      const src = fs.readFileSync(filePath, "utf8");
      if (SHADOW_MODULE_IMPORT.test(src) || SHADOW_API_IMPORT.test(src)) offenders.push(r);
    }
    expect(
      offenders,
      `publish shadow leaked into protected runtime:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

describe("G5d.4c — shadow helper allowed but isolated", () => {
  test("runtimeMappingPublishShadow.server.ts exists and passes forbidden import scan", () => {
    const helperPath = path.join(ROOT, "lib/menu-profile/runtimeMappingPublishShadow.server.ts");
    expect(fs.existsSync(helperPath)).toBe(true);
    const src = fs.readFileSync(helperPath, "utf8");
    expect(src).toContain('"server-only"');
    for (const pattern of FUTURE_SHADOW_FORBIDDEN_IMPORTS) {
      expect(src, `forbidden import in shadow helper: ${pattern}`).not.toMatch(pattern);
    }
    expect(src).not.toMatch(/buildMenuDayPayload/);
  });

  test("publish-shadow API route exists and passes forbidden import scan", () => {
    const routePath = path.join(ROOT, "app/api/provider/menu-profile/publish-shadow/route.ts");
    expect(fs.existsSync(routePath)).toBe(true);
    const src = fs.readFileSync(routePath, "utf8");
    expect(src).toContain('"server-only"');
    for (const pattern of FUTURE_SHADOW_FORBIDDEN_IMPORTS) {
      expect(src, `forbidden import in publish-shadow API: ${pattern}`).not.toMatch(pattern);
    }
    expect(src).not.toMatch(/buildMenuDayPayload/);
    expect(src).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
  });

  test("only publish-shadow API route may import runtimeMappingPublishShadow in app/", () => {
    const allowed = new Set(["app/api/provider/menu-profile/publish-shadow/route.ts"]);
    const offenders: string[] = [];
    for (const filePath of walkFiles(path.join(ROOT, "app"))) {
      const r = rel(filePath).replace(/\\/g, "/");
      if (r.includes("/tests/")) continue;
      const src = fs.readFileSync(filePath, "utf8");
      if (SHADOW_MODULE_IMPORT.test(src) && !allowed.has(r)) {
        offenders.push(r);
      }
    }
    expect(
      offenders,
      `unexpected shadow helper imports in app/:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test("provider UI must not import runtimeMappingPublishShadow", () => {
    const providersDir = path.join(ROOT, "components/providers");
    if (!fs.existsSync(providersDir)) return;

    const offenders: string[] = [];
    for (const filePath of walkFiles(providersDir)) {
      const src = fs.readFileSync(filePath, "utf8");
      if (SHADOW_MODULE_IMPORT.test(src) || src.includes("runtimeMappingPublishShadow")) {
        offenders.push(rel(filePath));
      }
    }
    expect(offenders, `provider UI imports shadow helper:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("G5d.4b — runtime separation from employee/week/order surfaces", () => {
  const REFERENCE_PATTERNS = [
    /publish-shadow/,
    /runtimeMappingPublishShadow/,
    /LP_MENU_PROFILE_PUBLISH_SHADOW/,
    /PublishShadowEvaluation/,
  ];

  function assertNoShadowReferences(prefixes: string[], label: string) {
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
    expect(offenders, `${label} must not reference publish shadow:\n${offenders.join("\n")}`).toEqual(
      [],
    );
  }

  test("employee week UI has no publish-shadow references", () => {
    assertNoShadowReferences(["app/(app)/week"], "employee week UI");
  });

  test("order runtime has no publish-shadow references", () => {
    assertNoShadowReferences(["app/api/orders", "lib/orders"], "order runtime");
  });

  test("public customer pages have no publish-shadow references", () => {
    const publicRoots = ["app/(public)", "app/(marketing)"].filter((p) =>
      fs.existsSync(path.join(ROOT, p)),
    );
    if (publicRoots.length === 0) return;
    assertNoShadowReferences(publicRoots, "public pages");
  });
});
