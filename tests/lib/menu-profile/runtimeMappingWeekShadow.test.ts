/**
 * G5d.5c — Pure week shadow comparison helper tests (read-only, no I/O).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import {
  assertValidWeekShadowComparisonInput,
  buildRuntimeMappingWeekShadowEvaluation,
  buildWeekShadowBlockedReasons,
  stableHashWeekPayload,
  stableSerializeWeekPayload,
  validateWeekShadowComparisonInput,
} from "@/lib/menu-profile/runtimeMappingWeekShadow.server";
import {
  WEEK_SHADOW_FORBIDDEN_OUTPUT_FIELDS,
  WEEK_SHADOW_HELPER_BASE_BLOCKED_REASONS,
  type WeekShadowComparisonInput,
  type WeekShadowEvaluationDto,
} from "@/lib/menu-profile/runtimeMappingWeekShadowTypes";
import {
  G5D5_WEEK_SHADOW_CONTRACT_FIXTURE,
  WEEK_SHADOW_BASE_BLOCKED_REASONS,
} from "../../fixtures/g5d5-week-shadow-contract.constants";

const ROOT = process.cwd();
const WEEK_SHADOW_HELPER = "lib/menu-profile/runtimeMappingWeekShadow.server.ts";

const FORBIDDEN_OUTPUT_STRINGS = [
  ...WEEK_SHADOW_FORBIDDEN_OUTPUT_FIELDS,
  "publishPayload",
  "lp_order_set",
  "lp_order_advance_status",
] as const;

function baseInput(overrides: Partial<WeekShadowComparisonInput> = {}): WeekShadowComparisonInput {
  return {
    menuProfileId: "norwegian_company_lunch",
    sourceDraftId: "draft-week-shadow-test",
    sourceMappingVersion: "g5d.1",
    currentWeekPayload: {
      days: [{ dateISO: "2026-06-16", weekdayKey: "mon", title: "Laks" }],
    },
    shadowWeekPayload: {
      days: [{ dateISO: "2026-06-16", weekdayKey: "mon", title: "Laks" }],
    },
    evaluatedAt: "2026-06-28T12:00:00.000Z",
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

describe("G5d.5c — validation", () => {
  test("rejects missing menuProfileId", () => {
    const result = validateWeekShadowComparisonInput({
      ...baseInput(),
      menuProfileId: "",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/menuProfileId/);
    expect(() =>
      buildRuntimeMappingWeekShadowEvaluation({ ...baseInput(), menuProfileId: "" }),
    ).toThrow(/Invalid week shadow comparison input/);
  });

  test("rejects missing sourceDraftId", () => {
    expect(validateWeekShadowComparisonInput({ ...baseInput(), sourceDraftId: "  " }).ok).toBe(
      false,
    );
  });

  test("rejects missing sourceMappingVersion", () => {
    expect(
      validateWeekShadowComparisonInput({ ...baseInput(), sourceMappingVersion: "" }).ok,
    ).toBe(false);
  });

  test("rejects missing currentWeekPayload", () => {
    expect(
      validateWeekShadowComparisonInput({ ...baseInput(), currentWeekPayload: null }).ok,
    ).toBe(false);
  });

  test("rejects missing shadowWeekPayload", () => {
    expect(
      validateWeekShadowComparisonInput({ ...baseInput(), shadowWeekPayload: undefined }).ok,
    ).toBe(false);
  });

  test("assertValidWeekShadowComparisonInput passes for valid input", () => {
    const input = baseInput();
    expect(() => assertValidWeekShadowComparisonInput(input)).not.toThrow();
  });
});

describe("G5d.5c — output contract", () => {
  test("shadowOnly and providerOnly are always true", () => {
    const dto = buildRuntimeMappingWeekShadowEvaluation(baseInput());
    expect(dto.shadowOnly).toBe(true);
    expect(dto.providerOnly).toBe(true);
  });

  test("currentWeekUnchanged true when payload hashes equal", () => {
    const dto = buildRuntimeMappingWeekShadowEvaluation(baseInput());
    expect(dto.currentWeekUnchanged).toBe(true);
    expect(dto.comparison.hashesEqual).toBe(true);
  });

  test("all change counters remain zero", () => {
    const dto = buildRuntimeMappingWeekShadowEvaluation(baseInput());
    expect(dto.employeeVisibleChanges).toBe(0);
    expect(dto.orderChanges).toBe(0);
    expect(dto.weekResponseChanges).toBe(0);
    expect(dto.priceVisibleChanges).toBe(0);
    expect(dto.commercialVisibleChanges).toBe(0);
  });

  test("hashesEqual true for same semantic object with different key order", () => {
    const dto = buildRuntimeMappingWeekShadowEvaluation(
      baseInput({
        currentWeekPayload: { days: [{ dateISO: "2026-06-16", title: "A" }], meta: { locked: false } },
        shadowWeekPayload: { meta: { locked: false }, days: [{ title: "A", dateISO: "2026-06-16" }] },
      }),
    );
    expect(dto.comparison.hashesEqual).toBe(true);
    expect(dto.currentWeekUnchanged).toBe(true);
  });

  test("has no forbidden fields on output", () => {
    const dto = buildRuntimeMappingWeekShadowEvaluation(baseInput());
    for (const field of WEEK_SHADOW_FORBIDDEN_OUTPUT_FIELDS) {
      expect(Object.keys(dto)).not.toContain(field);
    }
  });

  test("blockedReasons include hard guardrails", () => {
    const dto = buildRuntimeMappingWeekShadowEvaluation(baseInput());
    for (const reason of WEEK_SHADOW_HELPER_BASE_BLOCKED_REASONS) {
      expect(dto.blockedReasons).toContain(reason);
    }
    expect(buildWeekShadowBlockedReasons(baseInput())).toEqual(
      expect.arrayContaining([...WEEK_SHADOW_BASE_BLOCKED_REASONS]),
    );
  });

  test("helper output aligns with contract fixture shape for equal payloads", () => {
    const dto = buildRuntimeMappingWeekShadowEvaluation(
      baseInput({
        menuProfileId: G5D5_WEEK_SHADOW_CONTRACT_FIXTURE.menuProfileId,
        sourceDraftId: G5D5_WEEK_SHADOW_CONTRACT_FIXTURE.sourceDraftId,
        sourceMappingVersion: G5D5_WEEK_SHADOW_CONTRACT_FIXTURE.sourceMappingVersion,
        evaluatedAt: G5D5_WEEK_SHADOW_CONTRACT_FIXTURE.evaluatedAt,
        currentWeekPayload: { days: [] },
        shadowWeekPayload: { days: [] },
      }),
    );

    expect(dto.shadowOnly).toBe(G5D5_WEEK_SHADOW_CONTRACT_FIXTURE.shadowOnly);
    expect(dto.providerOnly).toBe(G5D5_WEEK_SHADOW_CONTRACT_FIXTURE.providerOnly);
    expect(dto.currentWeekUnchanged).toBe(G5D5_WEEK_SHADOW_CONTRACT_FIXTURE.currentWeekUnchanged);
    expect(dto.employeeVisibleChanges).toBe(G5D5_WEEK_SHADOW_CONTRACT_FIXTURE.employeeVisibleChanges);
    expect(dto.orderChanges).toBe(G5D5_WEEK_SHADOW_CONTRACT_FIXTURE.orderChanges);
    expect(dto.weekResponseChanges).toBe(G5D5_WEEK_SHADOW_CONTRACT_FIXTURE.weekResponseChanges);
    expect(dto.wouldAffectDays).toEqual(G5D5_WEEK_SHADOW_CONTRACT_FIXTURE.wouldAffectDays);
    expect(dto.blockedReasons).toEqual(
      expect.arrayContaining([...G5D5_WEEK_SHADOW_CONTRACT_FIXTURE.blockedReasons]),
    );
    expect(dto.comparison.hashesEqual).toBe(G5D5_WEEK_SHADOW_CONTRACT_FIXTURE.comparison.hashesEqual);
  });
});

describe("G5d.5c — diff evidence", () => {
  test("hashesEqual false for different payloads", () => {
    const dto = buildRuntimeMappingWeekShadowEvaluation(
      baseInput({
        shadowWeekPayload: {
          days: [{ dateISO: "2026-06-16", weekdayKey: "mon", title: "Different" }],
        },
      }),
    );
    expect(dto.comparison.hashesEqual).toBe(false);
    expect(dto.currentWeekUnchanged).toBe(false);
  });

  test("change counters remain zero when hash differs", () => {
    const dto = buildRuntimeMappingWeekShadowEvaluation(
      baseInput({
        shadowWeekPayload: { days: [{ dateISO: "2026-06-17", weekdayKey: "tue", title: "New" }] },
      }),
    );
    expect(dto.employeeVisibleChanges).toBe(0);
    expect(dto.orderChanges).toBe(0);
    expect(dto.weekResponseChanges).toBe(0);
  });

  test("notes say evidence-only / not employee-visible when hash differs", () => {
    const dto = buildRuntimeMappingWeekShadowEvaluation(
      baseInput({
        shadowWeekPayload: { days: [{ dateISO: "2026-06-16", title: "Changed" }] },
      }),
    );
    const notes = [...dto.comparison.notes, ...dto.wouldAffectDays.flatMap((d) => d.notes)].join(
      " ",
    );
    expect(notes.toLowerCase()).toMatch(/evidence-only|not employee-visible/);
    expect(dto.blockedReasons).toContain("week_payload_hash_diff_detected");
  });

  test("wouldAffectDays does not expose full payload", () => {
    const dto = buildRuntimeMappingWeekShadowEvaluation(
      baseInput({
        currentWeekPayload: {
          days: [
            {
              dateISO: "2026-06-16",
              weekdayKey: "mon",
              title: "Secret menu",
              pricePreview: 99,
              employeePayload: { hidden: true },
            },
          ],
        },
        shadowWeekPayload: {
          days: [{ dateISO: "2026-06-16", weekdayKey: "mon", title: "Other menu", pricePreview: 88 }],
        },
      }),
    );

    expect(dto.wouldAffectDays.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(dto.wouldAffectDays);
    expect(serialized).not.toContain("Secret menu");
    expect(serialized).not.toContain("Other menu");
    expect(serialized).not.toContain("pricePreview");
    expect(serialized).not.toContain("employeePayload");
  });
});

describe("G5d.5c — publishShadow safety", () => {
  test("non-zero publish shadow impact adds blocked reason but counters stay zero", () => {
    const dto = buildRuntimeMappingWeekShadowEvaluation(
      baseInput({
        publishShadow: {
          publishImpact: { runtimeWrites: 1, sanityWrites: 0, orderChanges: 0 },
        },
      }),
    );
    expect(dto.blockedReasons).toContain("publish_shadow_impact_not_zero");
    expect(dto.employeeVisibleChanges).toBe(0);
    expect(dto.orderChanges).toBe(0);
    expect(dto.weekResponseChanges).toBe(0);
  });
});

describe("G5d.5c — stable serialization", () => {
  test("deterministic for object key order", () => {
    const a = { z: 1, a: { c: 2, b: 3 } };
    const b = { a: { b: 3, c: 2 }, z: 1 };
    expect(stableSerializeWeekPayload(a)).toBe(stableSerializeWeekPayload(b));
    expect(stableHashWeekPayload(a)).toBe(stableHashWeekPayload(b));
  });

  test("arrays preserve order", () => {
    expect(stableSerializeWeekPayload([1, 2, 3])).not.toBe(stableSerializeWeekPayload([3, 2, 1]));
  });

  test("does not mutate input", () => {
    const payload = {
      days: [{ dateISO: "2026-06-16", items: ["a", "b"] }],
      meta: { locked: false },
    };
    const clone = JSON.parse(JSON.stringify(payload));
    stableSerializeWeekPayload(payload);
    stableHashWeekPayload(payload);
    expect(payload).toEqual(clone);
  });

  test("circular refs rejected safely", () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    expect(() => stableSerializeWeekPayload(circular)).toThrow(/circular references/);
  });
});

describe("G5d.5c — forbidden output", () => {
  test("JSON output does not contain forbidden strings", () => {
    const dto = buildRuntimeMappingWeekShadowEvaluation(
      baseInput({
        currentWeekPayload: {
          days: [
            {
              dateISO: "2026-06-16",
              commission: 10,
              provisjon: 10,
              vat: 25,
              mva: 25,
              pricePreview: 99,
              provider_price_rules: { x: 1 },
            },
          ],
        },
        shadowWeekPayload: {
          days: [{ dateISO: "2026-06-16", title: "Changed" }],
        },
      }),
    );

    const serialized = JSON.stringify(dto).toLowerCase();
    for (const forbidden of FORBIDDEN_OUTPUT_STRINGS) {
      expect(serialized).not.toContain(forbidden.toLowerCase());
    }
    expect(serialized).not.toMatch(/\bapply\b/);
    expect(serialized).not.toMatch(/\bcommit\b/);
    expect(serialized).not.toMatch(/\bactivate\b/);
    expect(serialized).not.toMatch(/\benable\b/);
  });
});

describe("G5d.5c — import/runtime separation", () => {
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
  ];

  test("helper source has no forbidden imports", () => {
    const src = fs.readFileSync(path.join(ROOT, WEEK_SHADOW_HELPER), "utf8");
    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      expect(src, `${WEEK_SHADOW_HELPER} → ${pattern}`).not.toMatch(pattern);
    }
    expect(src).toContain('import "server-only"');
  });

  test("helper is not imported from week runtime", () => {
    const prefixes = ["app/api/week", "app/(app)/week", "lib/week"];
    const offenders: string[] = [];
    for (const prefix of prefixes) {
      for (const filePath of walkFiles(path.join(ROOT, prefix))) {
        const src = fs.readFileSync(filePath, "utf8");
        if (/runtimeMappingWeekShadow/.test(src)) {
          offenders.push(rel(filePath));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test("helper is not imported by order, menuDayPayload, publish, or public pages", () => {
    const scanTargets = [
      "app/api/orders",
      "lib/orders",
      "lib/provider-menu/menuDayPayload.ts",
      "lib/menu-publish",
      "app/(public)",
      "app/(marketing)",
    ];

    const offenders: string[] = [];
    for (const target of scanTargets) {
      const abs = path.join(ROOT, target);
      if (!fs.existsSync(abs)) continue;
      const files = fs.statSync(abs).isDirectory() ? walkFiles(abs) : [abs];
      for (const filePath of files) {
        const src = fs.readFileSync(filePath, "utf8");
        if (/runtimeMappingWeekShadow/.test(src)) {
          offenders.push(rel(filePath));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

function assertWeekShadowDtoShape(dto: WeekShadowEvaluationDto): void {
  expect(typeof dto.evaluatedAt).toBe("string");
  expect(typeof dto.menuProfileId).toBe("string");
  expect(typeof dto.comparison.currentWeekPayloadHash).toBe("string");
  expect(dto.comparison.currentWeekPayloadHash.startsWith("sha256:")).toBe(true);
}

describe("G5d.5c — hash prefix contract", () => {
  test("stableHashWeekPayload uses sha256 prefix", () => {
    const hash = stableHashWeekPayload({ days: [] });
    expect(hash.startsWith("sha256:")).toBe(true);
    assertWeekShadowDtoShape(buildRuntimeMappingWeekShadowEvaluation(baseInput()));
  });
});
