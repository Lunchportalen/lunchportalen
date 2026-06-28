/**
 * G5d.5a — /week shadow read design audit document guards (tests only).
 * Locks boundaries before G5d.5b implementation.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = process.cwd();
const G5D5_DESIGN_DOC = "docs/engineering/G5d5-week-shadow-read-design-audit.md";

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("G5d.5a — week shadow read design audit document guards", () => {
  test("G5d5 design audit document exists", () => {
    expect(fs.existsSync(path.join(ROOT, G5D5_DESIGN_DOC))).toBe(true);
  });

  test("design doc locks Production OFF and explicit GO gates", () => {
    const doc = readSource(G5D5_DESIGN_DOC);
    expect(doc).toContain("LP_MENU_PROFILE_WEEK_SHADOW_READ");
    expect(doc).toMatch(/Production.*OFF/i);
    expect(doc).toMatch(/no Sanity write|Sanity writes|Write to Sanity/i);
    expect(doc).toMatch(/\/week|weekResponseChanges|Change `\/week`|no `\/week`/i);
    expect(doc).toMatch(/order|orderChanges|order write-path/i);
    expect(doc).toMatch(/employee|employeeVisibleChanges|Employee visibility/i);
    expect(doc).toMatch(/G5d\.5b.*explicit GO|G5d\.5b requires.*explicit GO/i);
    expect(doc).toMatch(/G5d\.6 must not start|not authorized here/i);
    expect(doc).toMatch(/Never as routine rollback|Do not drop|do not drop/i);
  });

  test("design doc forbids /week runtime change and employee visibility", () => {
    const doc = readSource(G5D5_DESIGN_DOC);
    expect(doc).toMatch(/no runtime changes|no API changes|no UI changes|no DB\/RLS changes/i);
    expect(doc).toMatch(/no `\/week` changes|no \/week changes|Alter `GET \/api\/week`/i);
    expect(doc).toMatch(/never serve shadow|Never serve shadow|providerOnly: true/i);
    expect(doc).toMatch(/menuDayPayload mutation|Mutate `menuDayPayload`/i);
  });

  test("design doc documents architecture, DTO, phasing, and G5d.6 separation", () => {
    const doc = readSource(G5D5_DESIGN_DOC);
    expect(doc).toMatch(/runtimeMappingWeekShadow\.server\.ts/);
    expect(doc).toMatch(/week-shadow\/route\.ts/);
    expect(doc).toMatch(/WeekShadowEvaluationDto/);
    expect(doc).toMatch(/G5d\.5b/);
    expect(doc).toMatch(/G5d\.5c/);
    expect(doc).toMatch(/G5d\.5d/);
    expect(doc).toMatch(/G5d\.5e/);
    expect(doc).toMatch(/G5d\.6/);
    expect(doc).toMatch(/not runtime cutover|is not runtime cutover/i);
  });

  test("design doc references G5d.4 shadow chain as input only", () => {
    const doc = readSource(G5D5_DESIGN_DOC);
    expect(doc).toMatch(/G5d\.4c|G5d\.4d|publish-shadow/);
    expect(doc).toMatch(/shadowOnly: true/);
    expect(doc).toMatch(/employeeVisibleChanges: 0/);
    expect(doc).toMatch(/not source of truth|never source of truth/i);
  });
});
