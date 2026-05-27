/**
 * Deterministic JSON write helper — enforces docs/CONVENTIONS.md "Generated JSON artifacts".
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Recursively sort object keys for stable JSON output.
 * @param {unknown} value
 * @returns {unknown}
 */
export function sortKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeys(value[key]);
        return acc;
      }, {});
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {number} [indent=2]
 * @returns {string}
 */
export function stableStringify(value, indent = 2) {
  return `${JSON.stringify(sortKeys(value), null, indent)}\n`;
}

/**
 * @param {string} filePath
 * @param {unknown} value
 * @param {number} [indent=2]
 */
export function writeStableJson(filePath, value, indent = 2) {
  fs.writeFileSync(filePath, stableStringify(value, indent), "utf8");
}

function selfTest() {
  const sample = { z: 1, a: { y: 2, b: 3 }, m: [{ c: 1, a: 2 }] };
  const once = stableStringify(sample);
  const twice = stableStringify(sample);
  if (once !== twice) {
    throw new Error("stableStringify is not deterministic");
  }
  if (!once.endsWith("\n")) {
    throw new Error("stableStringify missing trailing newline");
  }
  const parsed = JSON.parse(once);
  if (Object.keys(parsed).join(",") !== "a,m,z") {
    throw new Error("sortKeys did not sort top-level keys");
  }
}

const invoked = process.argv[1]
  ? path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
  : false;

if (invoked || process.argv.includes("--self-test")) {
  selfTest();
  console.log("stable-json.mjs self-test PASS");
}
