#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { detectPrMigrationChanges } from "./detect-pr-migration-changes.mjs";

const PR92_BASE = "5cc85667e0afd542221520a5601bc0cf2bad446c";
const PR92_HEAD = "453abae5e038b8839fbde9f9edeccba67e825ef3";

function rev(ref) {
  return execFileSync("git", ["rev-parse", ref], { encoding: "utf8" }).trim();
}

const mainSha = rev("origin/main");

const pos = detectPrMigrationChanges(PR92_BASE, PR92_HEAD, { fetch: false });
assert.equal(pos.changed, true, "PR #92 must detect migration change");
assert.ok(
  pos.active.some((f) => f.includes("20260618120000_lp_company_lifecycle_strict_provider_gate")),
);

assert.equal(detectPrMigrationChanges(mainSha, mainSha, { fetch: false }).changed, false);

const weekHead = rev("e8cf10ba");
const weekBase = rev("e8cf10ba^");
assert.equal(detectPrMigrationChanges(weekBase, weekHead, { fetch: false }).changed, false);

console.log(
  JSON.stringify({ ok: true, pr92_active: pos.active, main: mainSha.slice(0, 8) }, null, 2),
);
