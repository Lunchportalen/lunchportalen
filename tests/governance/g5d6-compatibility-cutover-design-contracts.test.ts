/**
 * G5d.6a — Compatibility cutover design audit document guards (tests only).
 * Locks boundaries before G5d.6b implementation.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = process.cwd();
const G5D6_DESIGN_DOC = "docs/engineering/G5d6-compatibility-cutover-design-audit.md";

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("G5d.6a — compatibility cutover design audit document guards", () => {
  test("G5d6 design audit document exists", () => {
    expect(fs.existsSync(path.join(ROOT, G5D6_DESIGN_DOC))).toBe(true);
  });

  test("design doc locks Production OFF, no runtime cutover, and explicit GO gates", () => {
    const doc = readSource(G5D6_DESIGN_DOC);
    expect(doc).toContain("LP_MENU_PROFILE_COMPATIBILITY_CUTOVER");
    expect(doc).toMatch(/Production.*OFF/i);
    expect(doc).toMatch(/no runtime cutover|not runtime cutover|no runtime cutover/i);
    expect(doc).toMatch(/G5d\.6b.*explicit GO|G5d\.6b requires.*explicit GO/i);
    expect(doc).toMatch(/G5d\.7.*not.*start from this PR/i);
    expect(doc).toMatch(/Production activation requires.*separate|separate final GO/i);
    expect(doc).toMatch(/Never as routine rollback|Do not drop|do not drop/i);
  });

  test("design doc forbids /week runtime change, employee visibility, and order changes", () => {
    const doc = readSource(G5D6_DESIGN_DOC);
    expect(doc).toMatch(/no runtime changes|no API changes|no UI changes|no DB\/RLS changes/i);
    expect(doc).toMatch(/no `\/week` changes|no \/week changes|Alter `GET \/api\/week`|\/week runtime/i);
    expect(doc).toMatch(/employee|employeeVisibleChanges|Employee UI unchanged/i);
    expect(doc).toMatch(/order|orderChanges|order write-path|lp_order_set/i);
    expect(doc).toMatch(/no Sanity write|Sanity writes|Write to Sanity/i);
    expect(doc).toMatch(/menuDayPayload mutation|Mutate `menuDayPayload`/i);
    expect(doc).toMatch(/no source-of-truth switch|source of truth|not source of truth/i);
    expect(doc).toMatch(/no auto-rollout|Auto-rollout|auto-rollout/i);
  });

  test("design doc documents architecture, DTO, phasing, and G5d.7 separation", () => {
    const doc = readSource(G5D6_DESIGN_DOC);
    expect(doc).toMatch(/runtimeCompatibilityCutover\.server\.ts/);
    expect(doc).toMatch(/compatibility-cutover\/route\.ts/);
    expect(doc).toMatch(/CompatibilityCutoverEvaluationDto/);
    expect(doc).toMatch(/G5d\.6b/);
    expect(doc).toMatch(/G5d\.6c/);
    expect(doc).toMatch(/G5d\.6d/);
    expect(doc).toMatch(/G5d\.6e/);
    expect(doc).toMatch(/G5d\.7/);
    expect(doc).toMatch(/G5d\.8/);
    expect(doc).toMatch(/compatibilityOnly: true/);
    expect(doc).toMatch(/canProceedToProduction: false/);
    expect(doc).toMatch(/canProceedToRuntimeHook: false/);
  });

  test("design doc references G5d shadow chain and NO baseline", () => {
    const doc = readSource(G5D6_DESIGN_DOC);
    expect(doc).toMatch(/G5d\.3|G5d\.4|G5d\.5/);
    expect(doc).toMatch(/Golden Path|PROTECTED_GOLDEN_PATH/);
    expect(doc).toMatch(/publish-shadow|week-shadow/);
    expect(doc).toMatch(/Current NO baseline|Norwegian Golden Path/i);
    expect(doc).toMatch(/Rollback plan|Failure modes|Smoke plan/i);
  });
});
