import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "supabase", "migrations");
if (!fs.existsSync(dir)) {
  console.error("FAIL: supabase/migrations not found");
  process.exit(1);
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

if (files.length === 0) {
  console.error("FAIL: no migration files found");
  process.exit(1);
}

// Enforce: filename starts with numeric prefix (timestamp/date), underscore, then a safe name, ends with .sql
const bad = files.filter((f) => !/^\d{8,}_[A-Za-z0-9._-]+\.sql$/.test(f));
if (bad.length) {
  console.error("FAIL: migrations must match: <numericPrefix>_<name>.sql (e.g. 20260218_...)");
  console.error(bad.join("\n"));
  process.exit(1);
}

// Parse numeric prefixes
const prefixes = files.map((f) => {
  const raw = f.split("_")[0];
  const n = Number(raw);
  return { file: f, raw, n };
});

const nonNumeric = prefixes.filter((p) => !Number.isFinite(p.n));
if (nonNumeric.length) {
  console.error("FAIL: migration prefix must be numeric");
  console.error(nonNumeric.map((p) => p.file).join("\n"));
  process.exit(1);
}

// Enforce: deterministic order (files already sorted by name; Supabase applies in this order)
// Same-day / same-prefix migrations allowed; application order is lexicographic filename order.
console.log("OK: migration filenames are deterministic (numeric prefix + sorted by filename)");
console.log(`count=${files.length}`);
console.log(files.join("\n"));
