#!/usr/bin/env node
/** Pre-flight: verify Production env vars (metadata only) */
import fs from "node:fs";

const file = process.argv[2] ?? ".env.prod.tmp";
if (!fs.existsSync(file)) {
  console.error("missing", file);
  process.exit(1);
}

const map = new Map();
for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  map.set(m[1], v);
}

function meta(key) {
  const v = map.get(key);
  if (!v) return { present: false };
  return { present: true, len: v.length, prefix: v.slice(0, 6) };
}

const critical = [
  "CRON_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SYSTEM_MOTOR_SECRET",
];

const supabaseUrl = map.get("NEXT_PUBLIC_SUPABASE_URL") ?? "";
const prodProject = supabaseUrl.includes("hkpokyapzarefrgqzkos");

console.log("=== Production env pre-flight ===\n");
let missing = 0;
for (const k of critical) {
  const m = meta(k);
  if (!m.present) {
    console.log(`${k}: MISSING`);
    missing++;
  } else {
    console.log(`${k}: OK len=${m.len} prefix=${m.prefix}`);
  }
}

console.log(`\nSupabase prod project (hkpokyapzarefrgqzkos): ${prodProject ? "OK" : "MISMATCH — " + supabaseUrl.slice(0, 40)}`);
if (!prodProject) missing++;

console.log(`\nTotal keys in pull: ${map.size}`);
console.log(missing === 0 ? "\nPRE-FLIGHT: PASS" : `\nPRE-FLIGHT: FAIL (${missing} issues)`);
process.exit(missing > 0 ? 1 : 0);
