#!/usr/bin/env node
/** Extract CRON_SECRET from vercel env pull (Preview = staging-branch deploy env). */
import fs from "node:fs";
import { mergeEnvLocal } from "./merge-env-local.mjs";

const src = process.argv[2] ?? ".env.preview-cron.tmp";
if (!fs.existsSync(src)) {
  console.error("missing", src, "— run: vercel env pull", src, "--environment=preview --yes");
  process.exit(1);
}

const want = new Map();
for (const line of fs.readFileSync(src, "utf8").split(/\r?\n/)) {
  const m = line.match(/^(VERCEL_AUTOMATION_BYPASS_SECRET|CRON_SECRET)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  want.set(m[1], v);
}

const updates = {};
if (want.has("CRON_SECRET")) updates.STAGING_CRON_SECRET = want.get("CRON_SECRET");
if (want.has("VERCEL_AUTOMATION_BYPASS_SECRET")) {
  updates.VERCEL_AUTOMATION_BYPASS_SECRET = want.get("VERCEL_AUTOMATION_BYPASS_SECRET");
}
// Staging branch deploys as Preview — use git-staging URL until staging.app alias is repointed.
updates.STAGING_BASE_URL = "https://lunchportalen-git-staging-lunchportalen.vercel.app";

mergeEnvLocal(updates);

console.log("merged keys:", Object.keys(updates).join(", ") || "(none)");
if (!updates.STAGING_CRON_SECRET) {
  console.error("missing CRON_SECRET from pull");
  process.exit(1);
}
