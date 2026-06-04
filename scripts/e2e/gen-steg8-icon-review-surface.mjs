/**
 * STEG 8 review surface: full week-visual diff matrix + leak guard + height manifest.
 *
 * Prereq actuals: `LP_E2E_EXTERNAL_SERVER=1 npm run e2e:week-visual` (or CI artifact → tmp dir).
 * WEEK_ICON_PROBE.json: set LP_REVIEW_SURFACE_OUT when running week-icon-probe (same outDir).
 *
 * Usage: node scripts/e2e/gen-steg8-icon-review-surface.mjs [actualDir] [outDir]
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const root = process.cwd();
const actualRoot = path.resolve(root, process.argv[2] ?? "tmp-week-visual-snapshots");
const outDir = path.resolve(root, process.argv[3] ?? "_8-review-surface");
const baselineRoot = path.join(root, "e2e/week-visual-regression.e2e.ts-snapshots");

/** Snapshots that MUST stay 0-diff (no state-icon leakage). */
const LEAK_GUARD_SNAPSHOTS = new Set([
  "week-allergen-declared-empty-week-visual-desktop",
  "week-allergen-declared-empty-week-visual-mobile",
  "week-allergen-has-data-week-visual-desktop",
  "week-allergen-has-data-week-visual-mobile",
  "week-day-selected-tue-02-week-visual-desktop",
  "week-day-selected-tue-02-week-visual-mobile",
]);

/** Expected red: ordered-upcoming shows locked + ordered + unavailable calendar markers. */
const EXPECTED_RED_SNAPSHOTS = new Set([
  "week-ordered-upcoming-week-visual-desktop",
  "week-ordered-upcoming-week-visual-mobile",
]);

const pairs = [
  ["week-visual-desktop/week-allergen-declared-empty-week-visual-desktop.png", "desktop"],
  ["week-visual-desktop/week-allergen-has-data-week-visual-desktop.png", "desktop"],
  ["week-visual-desktop/week-day-selected-tue-02-week-visual-desktop.png", "desktop"],
  ["week-visual-desktop/week-ordered-upcoming-week-visual-desktop.png", "desktop"],
  ["week-visual-mobile/week-allergen-declared-empty-week-visual-mobile.png", "mobile"],
  ["week-visual-mobile/week-allergen-has-data-week-visual-mobile.png", "mobile"],
  ["week-visual-mobile/week-day-selected-tue-02-week-visual-mobile.png", "mobile"],
  ["week-visual-mobile/week-ordered-upcoming-week-visual-mobile.png", "mobile"],
];

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

fs.mkdirSync(outDir, { recursive: true });

const report = [];
let leakFailure = false;
let missingExpectedRed = false;

for (const [rel, project] of pairs) {
  const baseName = path.basename(rel, ".png");
  const expectedPath = path.join(baselineRoot, rel);
  const actualPath = path.join(actualRoot, rel);
  if (!fs.existsSync(expectedPath) || !fs.existsSync(actualPath)) {
    console.error("missing:", !fs.existsSync(expectedPath) ? expectedPath : actualPath);
    process.exitCode = 1;
    continue;
  }

  const expected = readPng(expectedPath);
  const actual = readPng(actualPath);
  const width = Math.max(expected.width, actual.width);
  const height = Math.max(expected.height, actual.height);
  const padExpected = new PNG({ width, height });
  const padActual = new PNG({ width, height });
  PNG.bitblt(expected, padExpected, 0, 0, expected.width, expected.height, 0, 0);
  PNG.bitblt(actual, padActual, 0, 0, actual.width, actual.height, 0, 0);

  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(
    padExpected.data,
    padActual.data,
    diff.data,
    width,
    height,
    { threshold: 0.2, includeAA: true },
  );

  const outPath = path.join(outDir, `${baseName}-diff.png`);
  fs.writeFileSync(outPath, PNG.sync.write(diff));

  const row = {
    snapshot: baseName,
    project,
    expectedHeight: expected.height,
    actualHeight: actual.height,
    heightDeltaPx: actual.height - expected.height,
    diffPixels,
    diffRatio: diffPixels / (width * height),
    leakGuard: LEAK_GUARD_SNAPSHOTS.has(baseName),
    expectedRed: EXPECTED_RED_SNAPSHOTS.has(baseName),
  };
  report.push(row);

  if (LEAK_GUARD_SNAPSHOTS.has(baseName) && diffPixels > 0) {
    console.error(`LEAK STOP: ${baseName} diffPixels=${diffPixels} (must be 0)`);
    leakFailure = true;
  }
  if (EXPECTED_RED_SNAPSHOTS.has(baseName) && diffPixels === 0) {
    console.error(`EXPECTED RED missing: ${baseName} diffPixels=0`);
    missingExpectedRed = true;
  }
}

const manifestPath = path.join(outDir, "HEIGHT_MANIFEST.json");
fs.writeFileSync(manifestPath, `${JSON.stringify(report, null, 2)}\n`);

const probePath = path.join(outDir, "WEEK_ICON_PROBE.json");
const probePresent = fs.existsSync(probePath);

console.log("Wrote", manifestPath);
console.log("WEEK_ICON_PROBE.json", probePresent ? "present" : "MISSING (run icon probe with LP_REVIEW_SURFACE_OUT)");
for (const row of report) {
  console.log(
    row.snapshot,
    "diffPixels=",
    row.diffPixels,
    "heightDelta=",
    row.heightDeltaPx,
    row.leakGuard ? "[leak-guard]" : "",
    row.expectedRed ? "[expected-red]" : "",
  );
}

if (leakFailure || missingExpectedRed) {
  process.exitCode = 1;
}
