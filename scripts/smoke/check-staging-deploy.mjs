#!/usr/bin/env node
/** Check which deployment staging.app resolves to */
import fs from "node:fs";

function loadEnv() {
  const env = { ...process.env };
  if (fs.existsSync(".env.local")) {
    for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = line.match(/^VERCEL_AUTOMATION_BYPASS_SECRET=(.*)$/);
      if (m && !env.VERCEL_AUTOMATION_BYPASS_SECRET) {
        let v = m[1].trim().replace(/^"|"$/g, "");
        env.VERCEL_AUTOMATION_BYPASS_SECRET = v;
      }
    }
  }
  return env;
}

const env = loadEnv();
const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET || "";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const url = `https://staging.app.lunchportalen.no/api/health?x-vercel-protection-bypass=${encodeURIComponent(bypass)}`;
const res = await fetch(url, {
  headers: { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" },
});
console.log("status", res.status);
for (const h of ["x-vercel-id", "x-vercel-cache", "server", "x-matched-path", "x-nextjs-cache"]) {
  console.log(h + ":", res.headers.get(h) ?? "-");
}
