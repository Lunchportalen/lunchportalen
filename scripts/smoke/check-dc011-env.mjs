import fs from "node:fs";

function load(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = { ...load(".env.local"), ...load(".env.staging-check"), ...process.env };
const required = [
  "VERCEL_AUTOMATION_BYPASS_SECRET",
  "PLAYWRIGHT_TEST_EMAIL",
  "PLAYWRIGHT_TEST_PASSWORD",
  "STAGING_CRON_SECRET",
  "STAGING_BASE_URL",
];

const missing = [];
for (const key of required) {
  const v = String(env[key] ?? "").trim();
  if (v) console.log(`${key}: OK (len=${v.length})`);
  else {
    console.log(`${key}: MISSING`);
    missing.push(key);
  }
}
process.exit(missing.length ? 1 : 0);
