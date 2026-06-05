/**
 * Read-only: classify STEG 8 screenshot red (actual vs committed baseline).
 * On-demand only — NOT run in CI. Requires local: npm install --no-save pngjs pixelmatch
 * Usage: node scripts/e2e/characterize-steg8-screenshot-red.mjs [actualRoot]
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const matchPixels = pixelmatch.default ?? pixelmatch;
const root = process.cwd();
const actualRootArg = process.argv[2];
const actualRoot = actualRootArg
  ? path.resolve(root, actualRootArg)
  : path.resolve(root, "tmp-ci-105-report");

function findActualPng(snapshotBaseName) {
  const direct = path.join(actualRoot, "week-visual-desktop", `${snapshotBaseName}.png`);
  if (fs.existsSync(direct)) return direct;
  const mobile = path.join(actualRoot, "week-visual-mobile", `${snapshotBaseName}.png`);
  if (fs.existsSync(mobile)) return mobile;
  if (!fs.existsSync(actualRoot)) return null;
  const stack = [actualRoot];
  while (stack.length) {
    const dir = stack.pop();
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (ent.name === `${snapshotBaseName}-actual.png`) return p;
    }
  }
  return null;
}
const baselineRoot = path.join(root, "e2e/week-visual-regression.e2e.ts-snapshots");
const outDir = path.join(root, "_8-review-surface");

const SNAPSHOTS = [
  {
    rel: "week-visual-desktop/week-allergen-declared-empty-week-visual-desktop.png",
    leakGuard: true,
    iconBearing: false,
    calendarHasSteg8Marks: true,
  },
  {
    rel: "week-visual-desktop/week-allergen-has-data-week-visual-desktop.png",
    leakGuard: true,
    iconBearing: false,
    calendarHasSteg8Marks: true,
  },
  {
    rel: "week-visual-mobile/week-allergen-declared-empty-week-visual-mobile.png",
    leakGuard: true,
    iconBearing: false,
    calendarHasSteg8Marks: true,
  },
  {
    rel: "week-visual-mobile/week-allergen-has-data-week-visual-mobile.png",
    leakGuard: true,
    iconBearing: false,
    calendarHasSteg8Marks: true,
  },
  {
    rel: "week-visual-desktop/week-day-selected-tue-02-week-visual-desktop.png",
    leakGuard: true,
    iconBearing: false,
    calendarHasSteg8Marks: true,
  },
  {
    rel: "week-visual-desktop/week-ordered-upcoming-week-visual-desktop.png",
    leakGuard: false,
    iconBearing: true,
    calendarHasSteg8Marks: true,
  },
];

function readPng(p) {
  return PNG.sync.read(fs.readFileSync(p));
}

function characterize(expected, actual) {
  const width = Math.max(expected.width, actual.width);
  const height = Math.max(expected.height, actual.height);
  const padExpected = new PNG({ width, height });
  const padActual = new PNG({ width, height });
  PNG.bitblt(expected, padExpected, 0, 0, expected.width, expected.height, 0, 0);
  PNG.bitblt(actual, padActual, 0, 0, actual.width, actual.height, 0, 0);
  const diffOut = new PNG({ width, height });
  const diffPixels = matchPixels(padExpected.data, padActual.data, diffOut.data, width, height, {
    threshold: 0.2,
    includeAA: true,
    diffColor: [255, 0, 0],
  });
  const isMismatch = (x, y) => {
    const idx = (width * y + x) << 2;
    return diffOut.data[idx] === 255;
  };
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isMismatch(x, y)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const region = (y0, y1, label) => {
    let n = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < width; x++) {
        if (isMismatch(x, y)) n++;
      }
    }
    return { label, y0, y1, diffPixels: n, identical: n === 0 };
  };
  const calY1 = width >= 1000 ? 380 : 420;
  const regions = [
    region(0, 220, "top_chrome_h1_eyebrow"),
    region(220, calY1, "calendar_band"),
    region(calY1, Math.min(900, height), "day_panel_and_collapse"),
    region(900, height, "kommende_dager_band"),
  ];
  const markerFree = region(380, 520, "allergen_disclosure_band");
  const globalTopShift = !regions[0].identical;
  const calendarOnly =
    regions[0].identical && regions[1].diffPixels > 0 && markerFree.identical;
  return {
    dimensionMismatch: false,
    heightDeltaPx: actual.height - expected.height,
    diffPixels,
    diffRatio: diffPixels / (width * height),
    bbox:
      diffPixels === 0
        ? null
        : { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 },
    regions,
    markerFreeRegion: markerFree,
    globalTopShift,
    calendarOnlyDelta: calendarOnly,
    shiftOnMarkerFreeFlat: !markerFree.identical,
  };
}

const selectorScope = {
  dsWeekIconInSource: [
    "app/(app)/week/EmployeeWeekClient.tsx: calendar state-mark + locked-collapse only",
    "app/styles/employee-week.css: .ds-week-icon + .ds-week-ordered-collapse__locked-note .ds-week-icon",
  ],
  fontSize12Scoped:
    ".ds-week-calendar-day-pill__state-mark--* { font-size: 12px } in employee-week.css",
  notUsedOn: ["allergen disclosure", "slot week-category-card__state-icon", "5.4 ::after"],
};

const rows = [];
for (const snap of SNAPSHOTS) {
  const expectedPath = path.join(baselineRoot, snap.rel);
  const baseName = path.basename(snap.rel, ".png");
  const actualPath = findActualPng(baseName) ?? path.join(actualRoot, snap.rel);
  if (!fs.existsSync(expectedPath)) {
    rows.push({ snapshot: baseName, error: "missing baseline" });
    continue;
  }
  if (!fs.existsSync(actualPath)) {
    rows.push({
      snapshot: baseName,
      redInCi: "assumed",
      steg8MarkersVisibleInFixture: snap.calendarHasSteg8Marks,
      expectedStaleIconDelta: snap.calendarHasSteg8Marks,
      actualMissing: true,
    });
    continue;
  }
  const expected = readPng(expectedPath);
  const actual = readPng(actualPath);
  const char = characterize(expected, actual);
  rows.push({
    snapshot: baseName,
    leakGuard: snap.leakGuard,
    iconBearing: snap.iconBearing,
    steg8MarkersInCalendarBand: snap.calendarHasSteg8Marks,
    expectedStaleIconDelta: snap.calendarHasSteg8Marks,
    leakIfRedWithoutMarkers: false,
    ...char,
    verdict:
      char.shiftOnMarkerFreeFlat
        ? "STOP_MARKER_FREE_SHIFT"
        : char.calendarOnlyDelta
          ? "EXPECTED_ICON_DELTA"
          : char.globalTopShift
            ? "GLOBAL_TOP_SHIFT"
            : char.diffPixels > 0
              ? "MIXED_DIFF_REVIEW"
              : "NO_DIFF",
  });
}

const report = {
  actualRoot,
  baselineRoot,
  selectorScope,
  snapshots: rows,
  ciReference: "week-visual #105 — declared-empty/has-data red; use Linux actuals when present",
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "SCREENSHOT_RED_CHARACTERIZATION.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
