/**
 * G5d.7 — Compatibility cutover design plan document guards (tests only).
 * Locks boundaries before G5d.7a implementation.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = process.cwd();
const G5D7_DESIGN_DOC = "docs/engineering/G5d7-compatibility-cutover-design-plan.md";

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("G5d.7 — compatibility cutover design plan document guards", () => {
  test("G5d7 design plan document exists", () => {
    expect(fs.existsSync(path.join(ROOT, G5D7_DESIGN_DOC))).toBe(true);
  });

  test("design plan is planning only — no runtime implementation in G5d.7", () => {
    const doc = readSource(G5D7_DESIGN_DOC);
    expect(doc).toMatch(/design\/planning only|Design \/ planning only/i);
    expect(doc).toMatch(/no runtime changes|no API changes|no UI changes|no DB\/RLS changes/i);
    expect(doc).toMatch(/no implementation|not implementation/i);
    expect(doc).toMatch(/G5d\.7a|future implementation phases/i);
    expect(doc).not.toMatch(/G5d\.7 implements runtime hook/i);
  });

  test("design plan locks Production OFF, no /week hook, and explicit GO gates", () => {
    const doc = readSource(G5D7_DESIGN_DOC);
    expect(doc).toMatch(/Production.*OFF/i);
    expect(doc).toMatch(/no Production flags|Production flags OFF/i);
    expect(doc).toMatch(/`\/week` hook|does not implement a runtime hook|not implement a runtime hook/i);
    expect(doc).toMatch(/explicit GO|separate explicit GO/i);
    expect(doc).toMatch(/Production activation requires.*separate|separate final GO/i);
    expect(doc).toMatch(/G5d\.8.*not started|G5d\.8.*not authorized/i);
  });

  test("design plan forbids employee visibility, order changes, and write paths", () => {
    const doc = readSource(G5D7_DESIGN_DOC);
    expect(doc).toMatch(/employee|employeeVisibleChanges|Employee UI unchanged/i);
    expect(doc).toMatch(/order|orderChanges|lp_order_set|order write-path/i);
    expect(doc).toMatch(/no Sanity write|Sanity writes|Write to Sanity/i);
    expect(doc).toMatch(/menuDayPayload mutation|Mutate `menuDayPayload`/i);
    expect(doc).toMatch(/publish|publishChanges/i);
    expect(doc).toMatch(/pricePreview|provider_price_rules|commercial/i);
  });

  test("design plan forbids source-of-truth switch and auto-rollout", () => {
    const doc = readSource(G5D7_DESIGN_DOC);
    expect(doc).toMatch(/no source-of-truth switch|source.of.truth|source of truth/i);
    expect(doc).toMatch(/no auto-rollout|Auto-rollout|auto-rollout/i);
    expect(doc).toMatch(/fail-closed|fail closed/i);
  });

  test("design plan documents future architecture, flags, phases, and invariants", () => {
    const doc = readSource(G5D7_DESIGN_DOC);
    expect(doc).toMatch(/LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK/);
    expect(doc).toMatch(/LP_MENU_PROFILE_EMPLOYEE_PROFILE_RUNTIME/);
    expect(doc).toMatch(/LP_MENU_PROFILE_COMPATIBILITY_CUTOVER/);
    expect(doc).toMatch(/G5d\.7a/);
    expect(doc).toMatch(/G5d\.7b/);
    expect(doc).toMatch(/G5d\.7c/);
    expect(doc).toMatch(/G5d\.7d/);
    expect(doc).toMatch(/G5d\.7e/);
    expect(doc).toMatch(/G5d\.7f/);
    expect(doc).toMatch(/G5d\.8/);
    expect(doc).toMatch(/Invariants|invariants/i);
    expect(doc).toMatch(/Rollback|rollback/i);
    expect(doc).toMatch(/No-go|no-go/i);
    expect(doc).toMatch(/Preconditions|preconditions/i);
    expect(doc).toMatch(/buildEmployeeWeekDayRows|weekRuntimeCompatibilityResolver/);
    expect(doc).toMatch(/compatibility-cutover|G5d\.6d/);
  });

  test("design plan references G5d.6e evidence and Golden Path", () => {
    const doc = readSource(G5D7_DESIGN_DOC);
    expect(doc).toMatch(/G5d\.6e/);
    expect(doc).toMatch(/Golden Path|PROTECTED_GOLDEN_PATH/);
    expect(doc).toMatch(/G5d\.3|G5d\.4|G5d\.5|G5d\.6/);
    expect(doc).toMatch(/Open questions|open questions/i);
    expect(doc).toMatch(/Observability|observability/i);
  });
});

describe("G5d.7 — runtime hook wiring guard (G5d.7c)", () => {
  test("G5d.7c hook flag exists in featureFlag.ts; employee exposure flag still absent", () => {
    const src = readSource("lib/menu-profile/featureFlag.ts");
    expect(src).toContain("LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK");
    expect(src).toContain("isMenuProfileRuntimeCompatibilityHookEnabled");
    expect(src).not.toContain("LP_MENU_PROFILE_EMPLOYEE_PROFILE_RUNTIME");
    expect(src).not.toContain("isMenuProfileEmployeeProfileRuntimeEnabled");
  });

  test("week API wires hook only via explicit G5d.7c boundary helper", () => {
    const src = readSource("app/api/week/route.ts");
    expect(src).toContain("maybeRunWeekRuntimeCompatibilityHook");
    expect(src).toContain("weekRuntimeCompatibilityHook.server");
    expect(src).not.toMatch(/buildWeekRuntimeCompatibilityDecision/);
    expect(src).not.toMatch(/weekRuntimeCompatibilityResolver\.server/);
  });
});
