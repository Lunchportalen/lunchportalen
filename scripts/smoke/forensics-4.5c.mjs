#!/usr/bin/env node
/** Del 1 forensic curls — compare staging hosts */
import fs from "node:fs";

function loadEnv() {
  const env = { ...process.env };
  for (const f of [".env.local", ".env.staging-check"]) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (!m || env[m[1]]) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      env[m[1]] = v;
    }
  }
  return env;
}

const env = loadEnv();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET || "";
const cronStaging = env.STAGING_CRON_SECRET || "";
const cronPreview = env.CRON_SECRET || "";

const BASES = [
  "https://staging.app.lunchportalen.no",
  "https://lunchportalen-git-staging-lunchportalen.vercel.app",
  "https://lunchportalen-f90nscnwu-lunchportalen.vercel.app",
];

async function bootstrap(base) {
  const jar = {};
  const merge = (sc) => {
    if (!sc) return;
    for (const raw of (Array.isArray(sc) ? sc : [sc])) {
      const pair = raw.split(";")[0];
      const eq = pair.indexOf("=");
      if (eq <= 0) continue;
      jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
    }
  };
  const url = `${base}/?x-vercel-protection-bypass=${encodeURIComponent(bypass)}`;
  const res = await fetch(url, {
    headers: { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" },
    redirect: "manual",
  });
  merge(res.headers.getSetCookie?.() ?? res.headers.get("set-cookie"));
  return jar;
}

async function hit(base, jar, label, method, path, extraHdr = {}) {
  const url = `${base}${path}${path.includes("?") ? "&" : "?"}x-vercel-protection-bypass=${encodeURIComponent(bypass)}`;
  const headers = {
    "x-vercel-protection-bypass": bypass,
    "x-vercel-set-bypass-cookie": "true",
    ...extraHdr,
  };
  const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
  if (cookie) headers.cookie = cookie;
  const res = await fetch(url, { method, headers, redirect: "manual" });
  const text = await res.text();
  console.log(`\n=== [${new URL(base).host}] ${label}`);
  console.log(`${method} ${path} -> ${res.status}`);
  console.log("x-lp-mw-bypass:", res.headers.get("x-lp-mw-bypass") ?? "-");
  console.log("x-lp-mw-api-auth:", res.headers.get("x-lp-mw-api-auth") ?? "-");
  console.log("body:", text.slice(0, 150));
}

console.log("bypass len", bypass.length, "prefix", bypass.slice(0, 6));
console.log("STAGING_CRON_SECRET", cronStaging ? `len=${cronStaging.length} prefix=${cronStaging.slice(0, 6)}` : "missing");
console.log("CRON_SECRET (preview)", cronPreview ? `len=${cronPreview.length} prefix=${cronPreview.slice(0, 6)}` : "missing");

for (const base of BASES) {
  const jar = await bootstrap(base);
  console.log(`\n--- bootstrap ${new URL(base).host} cookies: ${Object.keys(jar).join(", ") || "(none)"}`);
  await hit(base, jar, "outbox POST no auth", "POST", "/api/system/outbox/process");
  await hit(base, jar, "outbox POST preview cron", "POST", "/api/system/outbox/process", {
    authorization: `Bearer ${cronPreview}`,
  });
  await hit(base, jar, "meal-learning no auth", "GET", "/api/cron/meal-learning");
  await hit(base, jar, "meal-learning preview cron", "GET", "/api/cron/meal-learning", {
    authorization: `Bearer ${cronPreview}`,
  });
  await hit(base, jar, "ai dashboard no session", "GET", "/api/ai/dashboard");
  await hit(base, jar, "orders no session", "GET", "/api/orders");
}
