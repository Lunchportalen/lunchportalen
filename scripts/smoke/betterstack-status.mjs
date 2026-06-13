#!/usr/bin/env node
/** Better Stack uptime monitor smoke — read-only API check. */
import fs from "node:fs";

function loadEnvLocalKey() {
  if (process.env.BETTERSTACK_API_KEY) return;
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^BETTERSTACK_API_KEY=(.*)$/);
    if (!m) continue;
    let v = m[1].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env.BETTERSTACK_API_KEY = v;
    break;
  }
}

loadEnvLocalKey();

const token = process.env.BETTERSTACK_API_KEY;
if (!token) {
  console.error("BETTERSTACK_API_KEY is not set");
  process.exit(2);
}

const URL = "https://uptime.betterstack.com/api/v2/monitors";
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10_000);

let res;
try {
  res = await fetch(URL, {
    headers: { Authorization: `Bearer ${token}` },
    signal: controller.signal,
  });
} catch (err) {
  clearTimeout(timeout);
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
}
clearTimeout(timeout);

if (!res.ok) {
  console.error(`Better Stack API error: HTTP ${res.status}`);
  process.exit(2);
}

let body;
try {
  body = await res.json();
} catch {
  console.error("Better Stack API error: invalid JSON");
  process.exit(2);
}

const monitors = body?.data;
if (!Array.isArray(monitors)) {
  console.error("Better Stack API error: missing data[]");
  process.exit(2);
}

const notUp = [];

for (const item of monitors) {
  const name = item?.attributes?.pronounceable_name ?? "(unknown)";
  const status = item?.attributes?.status ?? "(unknown)";
  console.log(`${name}: ${status}`);
  if (status !== "up") {
    notUp.push({ name, status });
  }
}

if (notUp.length > 0) {
  for (const { name, status } of notUp) {
    console.error(`FAIL: ${name} is ${status}`);
  }
  process.exit(1);
}

process.exit(0);
