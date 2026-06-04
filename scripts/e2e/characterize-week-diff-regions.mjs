/**
 * Read-only diff region characterization (#104-style).
 * Usage: node scripts/e2e/characterize-week-diff-regions.mjs <expected.png> <actual.png> [diff.png]
 */
import fs from "node:fs";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const matchPixels = pixelmatch.default ?? pixelmatch;

const expectedPath = process.argv[2];
const actualPath = process.argv[3];
const diffPath = process.argv[4];

if (!expectedPath || !actualPath) {
  console.error("Usage: node characterize-week-diff-regions.mjs <expected> <actual> [diff]");
  process.exit(1);
}

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

const expected = readPng(expectedPath);
const actual = readPng(actualPath);
const width = expected.width;
const height = expected.height;

if (actual.width !== width || actual.height !== height) {
  console.log(
    JSON.stringify({
      dimensionMismatch: true,
      expected: { width, height },
      actual: { width: actual.width, height: actual.height },
    }),
  );
  process.exit(0);
}

const diffOut = new PNG({ width, height });
const diffCount = matchPixels(expected.data, actual.data, diffOut.data, width, height, {
  threshold: 0.2,
  includeAA: true,
  diffColor: [255, 0, 0],
});

/** pixelmatch copies expected on match; only diffColor marks mismatches. */
function isMismatchPixel(x, y) {
  const idx = (width * y + x) << 2;
  return diffOut.data[idx] === 255 && diffOut.data[idx + 1] === 0 && diffOut.data[idx + 2] === 0;
}

let minX = width;
let minY = height;
let maxX = 0;
let maxY = 0;

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (!isMismatchPixel(x, y)) continue;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
}

function regionDiffPixels(y0, y1, label) {
  let regionDiff = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < width; x++) {
      if (isMismatchPixel(x, y)) regionDiff++;
    }
  }
  return { label, y0, y1, diffPixels: regionDiff, identical: regionDiff === 0 };
}

const regions = [
  regionDiffPixels(0, 220, "top_chrome_h1_eyebrow"),
  regionDiffPixels(220, 380, "calendar_band"),
  regionDiffPixels(380, Math.min(900, height), "day_panel_and_collapse"),
  regionDiffPixels(900, height, "kommende_dager_band"),
];

const bbox =
  diffCount > 0
    ? { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 }
    : null;

const globalTopShift = !regions[0].identical || !regions[1].identical;

const verdict =
  diffCount === 0
    ? "no_diff"
    : globalTopShift
      ? "GLOBAL_LAYOUT_SHIFT"
      : regions[0].identical && regions[1].identical && bbox && bbox.minY >= 320
        ? "LOCALIZED_ORDERED_DAY_REGION"
        : "MIXED_REVIEW";

console.log(
  JSON.stringify(
    {
      expected: { width, height },
      actual: { width: actual.width, height: actual.height },
      diffPixels: diffCount,
      diffRatio: diffCount / (width * height),
      boundingBox: bbox,
      regions,
      verdict,
      globalTopShift,
    },
    null,
    2,
  ),
);
