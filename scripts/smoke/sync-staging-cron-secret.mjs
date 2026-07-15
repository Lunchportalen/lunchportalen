#!/usr/bin/env node
/**
 * Sync CRON_SECRET from Vercel staging target → GitHub staging environment.
 * Never prints secret values.
 */
import fs from "node:fs";
import { execSync, spawnSync } from "node:child_process";

function readKey(file, key) {
  if (!fs.existsSync(file)) return "";
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(new RegExp(`^${key}=(.*)$`));
    if (!m) continue;
    let v = m[1].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    return v;
  }
  return "";
}

const tmp = ".env.vercel-staging-cron-sync.tmp";
try {
  execSync(`vercel env pull ${tmp} --environment=staging --yes`, { stdio: "pipe" });
} catch (e) {
  console.error("FAIL: vercel env pull staging");
  process.exit(1);
}

const vercelSecret = readKey(tmp, "CRON_SECRET");
fs.unlinkSync(tmp);

if (!vercelSecret) {
  console.error("FAIL: CRON_SECRET missing on Vercel staging target");
  process.exit(1);
}

const gh = spawnSync("gh", ["secret", "set", "CRON_SECRET", "--env", "staging", "--body", vercelSecret], {
  encoding: "utf8",
});
if (gh.status !== 0) {
  console.error("FAIL: gh secret set CRON_SECRET --env staging");
  process.stderr.write(gh.stderr || gh.stdout || "");
  process.exit(1);
}

console.log("OK: CRON_SECRET synced Vercel staging → GitHub staging environment");
