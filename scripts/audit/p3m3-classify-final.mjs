#!/usr/bin/env node
/**
 * Classify sample migrations from .p3m3-check-results.json + parse.json
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "../..");
const { results } = JSON.parse(readFileSync(join(ROOT, ".p3m3-parse.json"), "utf8"));
let checks = [];
try {
  checks = JSON.parse(readFileSync(join(ROOT, ".p3m3-check-results.json"), "utf8"));
} catch {
  console.error("Missing .p3m3-check-results.json — run prod checks first");
  process.exit(1);
}

const byFile = new Map();
for (const row of checks) {
  if (!byFile.has(row.file)) byFile.set(row.file, []);
  byFile.get(row.file).push(row);
}

function classifyFile(file, meta, rows) {
  if (meta.totalChecks === 0) {
    if (meta.dataOnly) return { classification: "AMBIGUOUS", reason: "data/grant-only SQL; no structural objects parsed" };
    if (!meta.structural) return { classification: "AMBIGUOUS", reason: "no structural DDL detected by parser" };
    return { classification: "AMBIGUOUS", reason: "structural SQL but parser found 0 checkable objects (complex DDL)" };
  }
  const oks = rows.map((r) => r.ok === true || r.ok === "t");
  const yes = oks.filter(Boolean).length;
  const n = oks.length;
  if (yes === n) return { classification: "APPLIED_HISTORISK", reason: `all ${n} objects exist on prod` };
  if (yes === 0) return { classification: "NEVER_APPLIED", reason: `0/${n} objects on prod` };
  const missing = rows.filter((r) => !(r.ok === true || r.ok === "t")).map((r) => `${r.kind}:${r.obj}`);
  const present = rows.filter((r) => r.ok === true || r.ok === "t").map((r) => `${r.kind}:${r.obj}`);
  return {
    classification: "PARTIAL",
    reason: `${yes}/${n} on prod; missing: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}; present: ${present.slice(0, 3).join(", ")}…`,
  };
}

const sample = readFileSync(join(ROOT, ".p3m3-sample.txt"), "utf8")
  .split(/\r?\n/)
  .filter(Boolean);
const out = [];
for (const file of sample) {
  const meta = results.find((r) => r.file === file);
  const rows = byFile.get(file) || [];
  const { classification, reason } = classifyFile(file, meta, rows);
  out.push({ file, classification, reason, checks: rows.length, meta });
}

const counts = {};
for (const o of out) counts[o.classification] = (counts[o.classification] || 0) + 1;
writeFileSync(join(ROOT, ".p3m3-classifications.json"), JSON.stringify({ sample: out, counts }, null, 2));
console.log(JSON.stringify(counts, null, 2));
for (const o of out) console.log(`${o.classification}\t${o.file}\t${o.reason.slice(0, 80)}`);
