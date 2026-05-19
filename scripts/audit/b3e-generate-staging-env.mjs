/**
 * B3e — Write gitignored staging env extract (never logs secret values).
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const STAGING_REF = "uigxsboqeruxflgzqztl";
const PARENT_REF = "hkpokyapzarefrgqzkos";
const outPath = join(root, "scripts", "audit", "staging-env-actual-2026-05-20.env");

function parseEnv(stdout) {
  const map = {};
  for (const line of stdout.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    map[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return map;
}

const branch = spawnSync(
  `npx supabase branches get ${STAGING_REF} --project-ref ${PARENT_REF} -o env`,
  { encoding: "utf8", cwd: root, shell: true },
);
if (branch.status !== 0) {
  console.error("BRANCH_GET_FAIL");
  process.exit(1);
}
const b = parseEnv(branch.stdout);

const lines = [
  "# B3e staging extract — DO NOT COMMIT. Paste into Vercel → Environments → staging.",
  `# Generated ${new Date().toISOString()}`,
  "",
  "# --- Supabase (branch uigxsboqeruxflgzqztl) ---",
  `NEXT_PUBLIC_SUPABASE_URL=${b.SUPABASE_URL || `https://${STAGING_REF}.supabase.co`}`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${b.SUPABASE_ANON_KEY || ""}`,
  `SUPABASE_SERVICE_ROLE_KEY=${b.SUPABASE_SERVICE_ROLE_KEY || ""}`,
  `SUPABASE_URL=${b.SUPABASE_URL || `https://${STAGING_REF}.supabase.co`}`,
  "",
  "# Optional: local scripts / MCP parity (not always required on Vercel)",
  `# SUPABASE_DB_PASSWORD=<from POSTGRES_URL if needed for psql>`,
  `# DATABASE_URL=${b.POSTGRES_URL || ""}`,
  `# SUPABASE_POSTGRES_URL=${b.POSTGRES_URL || ""}`,
  "",
  "# --- Sanity (project 4udoq5d8, dataset staging) ---",
  "NEXT_PUBLIC_SANITY_PROJECT_ID=4udoq5d8",
  "NEXT_PUBLIC_SANITY_DATASET=staging",
  "NEXT_PUBLIC_SANITY_API_VERSION=2024-01-01",
  "# SANITY_WRITE_TOKEN=<paste staging editor token from Sanity Manage>",
  "# SANITY_WEBHOOK_SECRET=<generate-new-for-staging-webhook>",
  "# SANITY_LIVE_URL=https://staging.app.lunchportalen.no",
  "",
  "# --- App URLs ---",
  "NEXT_PUBLIC_APP_URL=https://staging.app.lunchportalen.no",
  "PUBLIC_APP_URL=https://staging.app.lunchportalen.no",
  "",
  "# --- Cron / motor (generate new; do not reuse prod) ---",
  `CRON_SECRET=${randomUUID()}`,
  `SYSTEM_MOTOR_SECRET=${randomUUID()}`,
  "",
  "# --- Email: disabled on staging (Variant C) ---",
  "LP_RESEND_LIVE_SEND=false",
  "# RESEND_API_KEY=<omit or dummy>",
  "# SMTP_* / LP_SMTP_* / LP_RESEND_FROM=<omit>",
  "",
  "# --- Legacy Umbraco (omit on staging) ---",
  "# UMBRACO_PUBLIC_SITE_URL",
  "# UMBRACO_DELIVERY_BASE_URL",
  "# UMBRACO_CMS_ORIGIN",
  "",
];

writeFileSync(outPath, lines.join("\n"), "utf8");
console.log("WROTE", outPath.replace(root + "\\", "").replace(root + "/", ""));
console.log("LINES", lines.length);
