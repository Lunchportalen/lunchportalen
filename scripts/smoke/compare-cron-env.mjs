#!/usr/bin/env node
/** Compare CRON_SECRET metadata across env files (no full secret exposure) */
import fs from "node:fs";
import { execSync } from "node:child_process";

function readKey(file, key) {
  if (!fs.existsSync(file)) return null;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(new RegExp(`^${key}=(.*)$`));
    if (!m) continue;
    let v = m[1].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    return v;
  }
  return null;
}

function meta(v) {
  if (!v) return "missing";
  return `len=${v.length} prefix=${v.slice(0, 6)}`;
}

for (const env of ["preview", "staging", "production"]) {
  const out = `.env.cron-compare-${env}.tmp`;
  try {
    execSync(`vercel env pull ${out} --environment=${env} --yes`, { stdio: "pipe" });
    const v = readKey(out, "CRON_SECRET");
    console.log(`${env}: ${meta(v)}`);
    fs.unlinkSync(out);
  } catch (e) {
    console.log(`${env}: pull failed`);
  }
}

console.log(".env.local STAGING_CRON_SECRET:", meta(readKey(".env.local", "STAGING_CRON_SECRET")));
console.log(".env.local CRON_SECRET:", meta(readKey(".env.local", "CRON_SECRET")));
