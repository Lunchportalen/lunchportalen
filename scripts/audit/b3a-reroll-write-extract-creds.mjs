/**
 * B3a-REROLL — Write Supabase credentials to extract (metadata-only stdout).
 * Usage: node scripts/audit/b3a-reroll-write-extract-creds.mjs <staging_project_ref>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const STAGING_REF = (process.argv[2] ?? "").trim();
const PARENT_REF = "hkpokyapzarefrgqzkos";
const EXTRACT = join(root, "scripts", "audit", "staging-env-actual-2026-05-20.env");

if (!STAGING_REF) {
  console.error("USAGE_FAIL");
  process.exit(1);
}

function parseEnvStdout(stdout) {
  const out = {};
  for (const line of stdout.split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function branchEnv() {
  const r = spawnSync(
    `npx supabase branches get ${STAGING_REF} --project-ref ${PARENT_REF} -o env`,
    { encoding: "utf8", cwd: root, shell: true },
  );
  if (r.status !== 0) {
    console.error("BRANCH_GET_FAIL");
    process.exit(1);
  }
  return parseEnvStdout(r.stdout || "");
}

function meta(label, value, format) {
  const len = value ? String(value).length : 0;
  console.log(`${label}: written to extract (length ${len}, format ${format})`);
}

const env = branchEnv();
const url = `https://${STAGING_REF}.supabase.co`;
const anon = env.SUPABASE_ANON_KEY || env.ANON_KEY || "";
const service = env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY || "";

if (!anon || !service) {
  console.error("MISSING_KEYS");
  process.exit(1);
}

let text = readFileSync(EXTRACT, "utf8");
const replacements = [
  [/^NEXT_PUBLIC_SUPABASE_URL=.*$/m, `NEXT_PUBLIC_SUPABASE_URL=${url}`],
  [/^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*$/m, `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`],
  [/^SUPABASE_SERVICE_ROLE_KEY=.*$/m, `SUPABASE_SERVICE_ROLE_KEY=${service}`],
  [
    /^# SUPABASE_URL=.*$/m,
    `# SUPABASE_URL=${url}`,
  ],
];

for (const [re, rep] of replacements) {
  if (re.test(text)) text = text.replace(re, rep);
  else console.error(`MISSING_LINE_${String(re)}`);
}

writeFileSync(EXTRACT, text, "utf8");

meta("NEXT_PUBLIC_SUPABASE_URL", url, "URL");
meta("NEXT_PUBLIC_SUPABASE_ANON_KEY", anon, "JWT");
meta("SUPABASE_SERVICE_ROLE_KEY", service, "JWT");
