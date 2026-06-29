/**
 * G5d.6c — Pure compatibility cutover comparison helper tests (read-only, no I/O).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import {
  assertValidCompatibilityCutoverEvaluation,
  assertValidCompatibilityCutoverInput,
  buildCompatibilityBlockedReasons,
  buildCompatibilityCutoverEvaluation,
  buildCompatibilityRequiredEvidence,
  findForbiddenCompatibilityFields,
  hashCompatibilitySnapshot,
  stableSerializeCompatibilityValue,
  validateCompatibilityCutoverInput,
} from "@/lib/menu-profile/runtimeCompatibilityCutover.server";
import {
  COMPATIBILITY_CUTOVER_DEFAULT_REQUIRED_EVIDENCE,
  COMPATIBILITY_CUTOVER_FORBIDDEN_FIELD_NAMES,
  COMPATIBILITY_CUTOVER_HELPER_BASE_BLOCKED_REASONS,
  type CompatibilityCutoverInput,
  type CompatibilityRuntimeSnapshot,
} from "@/lib/menu-profile/runtimeCompatibilityCutoverTypes";
import {
  COMPATIBILITY_CUTOVER_BASE_BLOCKED_REASONS,
  G5D6_COMPATIBILITY_CUTOVER_CONTRACT_FIXTURE,
} from "../../fixtures/g5d6-compatibility-cutover-contract.constants";

const ROOT = process.cwd();
const COMPATIBILITY_HELPER = "lib/menu-profile/runtimeCompatibilityCutover.server.ts";

function currentSnapshot(
  overrides: Partial<CompatibilityRuntimeSnapshot> = {},
): CompatibilityRuntimeSnapshot {
  return {
    snapshotKind: "current_no_runtime",
    menuProfileId: "norwegian_company_lunch",
    mappingVersion: "g5d.1",
    days: [{ dateISO: "2026-06-16", weekdayKey: "mon", title: "Laks" }],
    ...overrides,
  };
}

function candidateSnapshot(
  overrides: Partial<CompatibilityRuntimeSnapshot> = {},
): CompatibilityRuntimeSnapshot {
  return {
    snapshotKind: "candidate_profile_runtime",
    menuProfileId: "norwegian_company_lunch",
    mappingVersion: "g5d.1",
    sourceDraftId: "draft-compatibility-test",
    sourceMappingVersion: "g5d.1",
    days: [{ dateISO: "2026-06-16", weekdayKey: "mon", title: "Laks" }],
    ...overrides,
  };
}

function baseInput(overrides: Partial<CompatibilityCutoverInput> = {}): CompatibilityCutoverInput {
  return {
    providerMenuProfileId: "norwegian_company_lunch",
    sourceDraftId: "draft-compatibility-test",
    sourceMappingVersion: "g5d.1",
    currentNoRuntimeSnapshot: currentSnapshot(),
    candidateProfileRuntimeSnapshot: candidateSnapshot(),
    evaluatedAt: "2026-06-28T22:00:00.000Z",
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

describe("G5d.6c — server-only / imports", () => {
  const FORBIDDEN_IMPORT_PATTERNS = [
    /@supabase/,
    /sanityWriteClient/,
    /requireSanityWrite/,
    /lp_order_set/,
    /lp_order_advance_status/,
    /buildMenuDayPayload/,
    /pricePreview/,
    /provider_price_rules/,
    /app\/api\/week\/route/,
    /EmployeeWeekClient/,
    /tripletex/i,
  ];

  test("helper contains import server-only", () => {
    const src = fs.readFileSync(path.join(ROOT, COMPATIBILITY_HELPER), "utf8");
    expect(src).toContain('import "server-only"');
  });

  test("helper source has no forbidden imports", () => {
    const src = fs.readFileSync(path.join(ROOT, COMPATIBILITY_HELPER), "utf8");
    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      expect(src, `${COMPATIBILITY_HELPER} → ${pattern}`).not.toMatch(pattern);
    }
    expect(src).not.toMatch(/from\s+["']@\/app\/\(app\)\/week/);
    expect(src).not.toMatch(/menuDayPayload/);
    expect(src).not.toMatch(/menu-publish/);
  });

  test("helper contains no DB mutations or fetch", () => {
    const src = fs.readFileSync(path.join(ROOT, COMPATIBILITY_HELPER), "utf8");
    expect(src).not.toMatch(/\.insert\(|\.delete\(|\.upsert\(/);
    expect(src).not.toMatch(/\bfetch\s*\(/);
  });

  test("helper is not imported from week runtime", () => {
    const prefixes = ["app/api/week", "app/(app)/week", "lib/week"];
    const offenders: string[] = [];
    for (const prefix of prefixes) {
      for (const filePath of walkFiles(path.join(ROOT, prefix))) {
        const src = fs.readFileSync(filePath, "utf8");
        if (/runtimeCompatibilityCutover/.test(src)) {
          offenders.push(rel(filePath));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test("helper is not imported by order, menuDayPayload, publish, or billing", () => {
    const scanTargets = [
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
        if (/runtimeCompatibilityCutover/.test(src)) {
          offenders.push(rel(filePath));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("G5d.6c — validation", () => {
  test("valid input passes", () => {
    const result = validateCompatibilityCutoverInput(baseInput());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(() => assertValidCompatibilityCutoverInput(baseInput())).not.toThrow();
  });

  test("missing providerMenuProfileId fails", () => {
    const result = validateCompatibilityCutoverInput({ ...baseInput(), providerMenuProfileId: "" });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/providerMenuProfileId/);
    expect(() => buildCompatibilityCutoverEvaluation({ ...baseInput(), providerMenuProfileId: "" })).toThrow(
      /Invalid compatibility cutover input/,
    );
  });

  test("missing currentNoRuntimeSnapshot fails", () => {
    const result = validateCompatibilityCutoverInput({
      ...baseInput(),
      currentNoRuntimeSnapshot: null,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/currentNoRuntimeSnapshot/);
  });

  test("missing candidateProfileRuntimeSnapshot fails", () => {
    const result = validateCompatibilityCutoverInput({
      ...baseInput(),
      candidateProfileRuntimeSnapshot: undefined,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/candidateProfileRuntimeSnapshot/);
  });

  test("forbidden providerId fails", () => {
    const result = validateCompatibilityCutoverInput({
      ...baseInput(),
      providerId: "leak",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/forbidden field.*providerId/);
  });

  test("forbidden employeePayload fails", () => {
    const result = validateCompatibilityCutoverInput({
      ...baseInput(),
      currentNoRuntimeSnapshot: currentSnapshot({
        metadata: { employeePayload: { hidden: true } },
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/employeePayload/);
  });

  test("forbidden orderPayload fails", () => {
    const result = validateCompatibilityCutoverInput({
      ...baseInput(),
      candidateProfileRuntimeSnapshot: candidateSnapshot({
        metadata: { orderPayload: { x: 1 } },
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/orderPayload/);
  });

  test("forbidden menuDayPayloadMutation fails", () => {
    const result = validateCompatibilityCutoverInput({
      ...baseInput(),
      menuDayPayloadMutation: { mutate: true },
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/menuDayPayloadMutation/);
  });

  test("forbidden price/commercial fields fail", () => {
    for (const field of ["pricePreview", "provider_price_rules", "commission", "vat", "mva"] as const) {
      const result = validateCompatibilityCutoverInput({
        ...baseInput(),
        [field]: { x: 1 },
      });
      expect(result.ok).toBe(false);
      expect(result.errors.join(" ")).toMatch(new RegExp(field));
    }
  });

  test("forbidden publish/activate/apply/commit/enable/productionEnable fail", () => {
    for (const field of ["publish", "activate", "apply", "commit", "enable", "productionEnable"] as const) {
      const result = validateCompatibilityCutoverInput({
        ...baseInput(),
        [field]: true,
      });
      expect(result.ok).toBe(false);
      expect(result.errors.join(" ")).toMatch(new RegExp(field));
    }
  });
});

describe("G5d.6c — deterministic serialization/hash", () => {
  test("object key order does not affect hash", () => {
    const a = currentSnapshot({ metadata: { z: 1, a: { c: 2, b: 3 } } });
    const b = currentSnapshot({ metadata: { a: { b: 3, c: 2 }, z: 1 } });
    expect(stableSerializeCompatibilityValue(a)).toBe(stableSerializeCompatibilityValue(b));
    expect(hashCompatibilitySnapshot(a)).toBe(hashCompatibilitySnapshot(b));
  });

  test("array order does affect hash", () => {
    const a = currentSnapshot({ days: [{ id: 1 }, { id: 2 }] });
    const b = currentSnapshot({ days: [{ id: 2 }, { id: 1 }] });
    expect(hashCompatibilitySnapshot(a)).not.toBe(hashCompatibilitySnapshot(b));
  });

  test("same snapshot produces same hash", () => {
    const snapshot = currentSnapshot();
    expect(hashCompatibilitySnapshot(snapshot)).toBe(hashCompatibilitySnapshot(snapshot));
    expect(hashCompatibilitySnapshot(snapshot).startsWith("sha256:")).toBe(true);
  });

  test("different snapshot produces different hash", () => {
    const a = currentSnapshot({ days: [{ title: "A" }] });
    const b = currentSnapshot({ days: [{ title: "B" }] });
    expect(hashCompatibilitySnapshot(a)).not.toBe(hashCompatibilitySnapshot(b));
  });

  test("undefined/null handling is deterministic", () => {
    const withNull = stableSerializeCompatibilityValue({ a: null, b: undefined });
    expect(withNull).toContain('"a":null');
    expect(withNull).toContain('"b":undefined');
    expect(stableSerializeCompatibilityValue({ a: null, b: undefined })).toBe(withNull);
  });

  test("Date objects serialize deterministically", () => {
    const date = new Date("2026-06-16T08:00:00.000Z");
    expect(stableSerializeCompatibilityValue({ generatedAt: date })).toBe(
      stableSerializeCompatibilityValue({ generatedAt: "2026-06-16T08:00:00.000Z" }),
    );
  });
});

describe("G5d.6c — evaluation equal snapshots", () => {
  test("compatibilityOnly and providerOnly are always true", () => {
    const dto = buildCompatibilityCutoverEvaluation(baseInput());
    expect(dto.compatibilityOnly).toBe(true);
    expect(dto.providerOnly).toBe(true);
  });

  test("currentNoRuntimeUnchanged true and all counters 0", () => {
    const dto = buildCompatibilityCutoverEvaluation(baseInput());
    expect(dto.currentNoRuntimeUnchanged).toBe(true);
    expect(dto.weekResponseChanges).toBe(0);
    expect(dto.employeeVisibleChanges).toBe(0);
    expect(dto.orderChanges).toBe(0);
    expect(dto.publishChanges).toBe(0);
    expect(dto.sanityWrites).toBe(0);
    expect(dto.menuDayPayloadMutations).toBe(0);
    expect(dto.priceVisibleChanges).toBe(0);
    expect(dto.commercialVisibleChanges).toBe(0);
  });

  test("hashesEqual true and manualReviewRequired false for equal snapshots", () => {
    const dto = buildCompatibilityCutoverEvaluation(
      baseInput({
        currentNoRuntimeSnapshot: currentSnapshot({
          days: [{ dateISO: "2026-06-16", title: "A" }],
          metadata: { locked: false },
        }),
        candidateProfileRuntimeSnapshot: candidateSnapshot({
          days: [{ title: "A", dateISO: "2026-06-16" }],
          metadata: { locked: false },
        }),
      }),
    );
    expect(dto.comparison.hashesEqual).toBe(true);
    expect(dto.comparison.manualReviewRequired).toBe(false);
  });

  test("canProceedToPreviewCompare true; runtime hook and production false", () => {
    const dto = buildCompatibilityCutoverEvaluation(baseInput());
    expect(dto.canProceedToPreviewCompare).toBe(true);
    expect(dto.canProceedToRuntimeHook).toBe(false);
    expect(dto.canProceedToProduction).toBe(false);
  });

  test("blockedReasons include no-runtime/no-production/no-source-of-truth/no-auto-rollout guards", () => {
    const dto = buildCompatibilityCutoverEvaluation(baseInput());
    expect(dto.blockedReasons).toContain("compatibility_only_no_runtime_cutover");
    expect(dto.blockedReasons).toContain("compatibility_only_no_production_activation");
    expect(dto.blockedReasons).toContain("compatibility_only_no_source_of_truth_switch");
    expect(dto.blockedReasons).toContain("compatibility_only_no_auto_rollout");
    expect(buildCompatibilityBlockedReasons(baseInput())).toEqual(
      expect.arrayContaining([...COMPATIBILITY_CUTOVER_HELPER_BASE_BLOCKED_REASONS]),
    );
    expect(buildCompatibilityBlockedReasons(baseInput())).toEqual(
      expect.arrayContaining([...COMPATIBILITY_CUTOVER_BASE_BLOCKED_REASONS]),
    );
  });

  test("requiredEvidence includes Golden Path and rollback evidence", () => {
    const dto = buildCompatibilityCutoverEvaluation(baseInput());
    expect(dto.requiredEvidence).toContain("golden_path_must_pass");
    expect(dto.requiredEvidence).toContain("rollback_plan_required");
    expect(buildCompatibilityRequiredEvidence(baseInput())).toEqual(
      expect.arrayContaining([...COMPATIBILITY_CUTOVER_DEFAULT_REQUIRED_EVIDENCE]),
    );
  });

  test("helper output aligns with contract fixture shape for equal snapshots", () => {
    const dto = buildCompatibilityCutoverEvaluation(
      baseInput({
        providerMenuProfileId: G5D6_COMPATIBILITY_CUTOVER_CONTRACT_FIXTURE.providerMenuProfileId,
        sourceDraftId: G5D6_COMPATIBILITY_CUTOVER_CONTRACT_FIXTURE.sourceDraftId,
        sourceMappingVersion: G5D6_COMPATIBILITY_CUTOVER_CONTRACT_FIXTURE.sourceMappingVersion,
        evaluatedAt: G5D6_COMPATIBILITY_CUTOVER_CONTRACT_FIXTURE.evaluatedAt,
        currentNoRuntimeSnapshot: currentSnapshot({ days: [] }),
        candidateProfileRuntimeSnapshot: candidateSnapshot({ days: [] }),
      }),
    );

    expect(dto.compatibilityOnly).toBe(G5D6_COMPATIBILITY_CUTOVER_CONTRACT_FIXTURE.compatibilityOnly);
    expect(dto.providerOnly).toBe(G5D6_COMPATIBILITY_CUTOVER_CONTRACT_FIXTURE.providerOnly);
    expect(dto.currentNoRuntimeUnchanged).toBe(
      G5D6_COMPATIBILITY_CUTOVER_CONTRACT_FIXTURE.currentNoRuntimeUnchanged,
    );
    expect(dto.comparison.hashesEqual).toBe(G5D6_COMPATIBILITY_CUTOVER_CONTRACT_FIXTURE.comparison.hashesEqual);
    expect(dto.blockedReasons).toEqual(
      expect.arrayContaining([...G5D6_COMPATIBILITY_CUTOVER_CONTRACT_FIXTURE.blockedReasons]),
    );
  });
});

describe("G5d.6c — evaluation different snapshots", () => {
  test("hashesEqual false and manualReviewRequired true", () => {
    const dto = buildCompatibilityCutoverEvaluation(
      baseInput({
        candidateProfileRuntimeSnapshot: candidateSnapshot({
          days: [{ dateISO: "2026-06-16", weekdayKey: "mon", title: "Different" }],
        }),
      }),
    );
    expect(dto.comparison.hashesEqual).toBe(false);
    expect(dto.comparison.manualReviewRequired).toBe(true);
    expect(dto.blockedReasons).toContain("compatibility_snapshot_hash_diff_detected");
  });

  test("diffSummary safe high-level only", () => {
    const dto = buildCompatibilityCutoverEvaluation(
      baseInput({
        candidateProfileRuntimeSnapshot: candidateSnapshot({
          days: [{ dateISO: "2026-06-17", title: "Secret menu title" }],
        }),
      }),
    );
    const summary = dto.comparison.diffSummary.join(" ");
    expect(summary.toLowerCase()).toMatch(/evidence-only|manual review/);
    expect(summary).not.toContain("Secret menu title");
    expect(summary).not.toMatch(/employeePayload|orderPayload|pricePreview/i);
  });

  test("all counters still 0 when hash differs", () => {
    const dto = buildCompatibilityCutoverEvaluation(
      baseInput({
        candidateProfileRuntimeSnapshot: candidateSnapshot({
          days: [{ dateISO: "2026-06-17", title: "Changed" }],
        }),
      }),
    );
    expect(dto.weekResponseChanges).toBe(0);
    expect(dto.orderChanges).toBe(0);
    expect(dto.canProceedToRuntimeHook).toBe(false);
    expect(dto.canProceedToProduction).toBe(false);
  });
});

describe("G5d.6c — response/DTO forbidden fields", () => {
  test("evaluation has no forbidden top-level fields", () => {
    const dto = buildCompatibilityCutoverEvaluation(baseInput());
    for (const field of COMPATIBILITY_CUTOVER_FORBIDDEN_FIELD_NAMES) {
      expect(Object.keys(dto)).not.toContain(field);
    }
    assertValidCompatibilityCutoverEvaluation(dto);
  });

  test("evaluation output has no forbidden top-level payload fields", () => {
    const dto = buildCompatibilityCutoverEvaluation(
      baseInput({
        candidateProfileRuntimeSnapshot: candidateSnapshot({
          days: [{ dateISO: "2026-06-16", title: "Changed" }],
        }),
      }),
    );

    for (const field of COMPATIBILITY_CUTOVER_FORBIDDEN_FIELD_NAMES) {
      expect(Object.keys(dto)).not.toContain(field);
    }
    expect(Object.keys(dto.comparison)).toEqual([
      "currentNoRuntimeHash",
      "candidateProfileRuntimeHash",
      "hashesEqual",
      "diffSummary",
      "manualReviewRequired",
    ]);
  });

  test("findForbiddenCompatibilityFields detects nested forbidden keys", () => {
    const offenders = findForbiddenCompatibilityFields({
      currentNoRuntimeSnapshot: currentSnapshot({
        metadata: { publishPayload: { x: 1 } },
      }),
    });
    expect(offenders.join(" ")).toMatch(/publishPayload/);
  });
});

describe("G5d.6c — no source of truth / no rollout", () => {
  test("helper source does not contain source-of-truth switch or auto-rollout behavior", () => {
    const src = fs.readFileSync(path.join(ROOT, COMPATIBILITY_HELPER), "utf8");
    expect(src).not.toMatch(/sourceOfTruth|source_of_truth|autoRollout|runMenuWeekRollout/i);
  });

  test("helper cannot mark canProceedToProduction or canProceedToRuntimeHook true", () => {
    const dto = buildCompatibilityCutoverEvaluation(baseInput());
    expect(dto.canProceedToProduction).toBe(false);
    expect(dto.canProceedToRuntimeHook).toBe(false);

    const diffDto = buildCompatibilityCutoverEvaluation(
      baseInput({
        candidateProfileRuntimeSnapshot: candidateSnapshot({ days: [{ title: "Changed" }] }),
      }),
    );
    expect(diffDto.canProceedToProduction).toBe(false);
    expect(diffDto.canProceedToRuntimeHook).toBe(false);
  });
});
