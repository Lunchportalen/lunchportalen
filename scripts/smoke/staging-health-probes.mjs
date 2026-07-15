#!/usr/bin/env node
/** 10 health probes over configurable interval — staging only. */
import { stagingFetch, assertStagingTarget } from "../test/staging-edge-access.mjs";

const base = (process.argv[2] || "https://staging.app.lunchportalen.no").replace(/\/$/, "");
const expected = (process.argv[3] || process.env.EXPECTED_RUNTIME_SHA || "").toLowerCase();
const count = Number(process.argv[4] || 10);
const intervalMs = Number(process.argv[5] || 30000);

assertStagingTarget(base);

function parseVersion(text) {
  const json = JSON.parse(text);
  const data = json?.data ?? json;
  return String(data?.version ?? "").toLowerCase();
}

let ok = 0;
for (let i = 1; i <= count; i++) {
  const res = await stagingFetch(base, "/api/health");
  const text = await res.text();
  if (res.status !== 200) {
    console.error(`FAIL probe ${i}/${count} status=${res.status}`);
    process.exit(1);
  }
  const version = parseVersion(text);
  if (expected && version !== expected) {
    console.error(`FAIL probe ${i}/${count} version=${version || "(empty)"} expected=${expected}`);
    process.exit(1);
  }
  ok += 1;
  console.log(`OK probe ${i}/${count} version=${version.slice(0, 8)}…`);
  if (i < count) await new Promise((r) => setTimeout(r, intervalMs));
}
console.log(`PASS ${ok}/${count} health probes`);
