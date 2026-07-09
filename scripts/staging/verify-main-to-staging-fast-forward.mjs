#!/usr/bin/env node
/**
 * Check-only: verify origin/staging can fast-forward to origin/main.
 * Default: dry-run (never pushes). Pass --apply to run promotion (owner GO required).
 */
import { execFileSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const expectedMainArg = [...args].find((a) => a.startsWith("--expected-main="));
const expectedMain = expectedMainArg?.split("=", 2)[1]?.trim() ?? null;

function git(...cmd) {
  return execFileSync("git", cmd, { encoding: "utf8" }).trim();
}
try {
  git("fetch", "origin");
} catch (e) {
  console.error("STOP: git fetch origin failed", e.message);
  process.exit(1);
}

const originMain = git("rev-parse", "origin/main");
const originStaging = git("rev-parse", "origin/staging");
const aheadOnMain = git("log", "--oneline", `${originStaging}..${originMain}`);
const aheadOnStaging = git("log", "--oneline", `${originMain}..${originStaging}`);

console.log("Origin main:", originMain);
console.log("Origin staging:", originStaging);
console.log("Commits on main not on staging:");
console.log(aheadOnMain || "(none — already aligned)");
console.log("Commits on staging not on main:");
console.log(aheadOnStaging || "(none — safe for fast-forward)");

if (expectedMain && originMain !== expectedMain && !originMain.startsWith(expectedMain.slice(0, 7))) {
  console.error(`STOP: origin/main is ${originMain}, expected ${expectedMain}`);
  process.exit(1);
}

if (aheadOnStaging) {
  console.error("STOP: staging is ahead/diverged from main — fast-forward not safe.");
  process.exit(1);
}

if (!aheadOnMain) {
  console.log("OK: origin/staging already matches origin/main.");
  process.exit(0);
}

console.log("OK: fast-forward possible.");

if (!apply) {
  console.log("Dry-run only. To promote staging:");
  console.log(`  git push origin ${originMain}:staging`);
  console.log("Or re-run with --apply (requires owner GO).");
  process.exit(0);
}

console.log("Applying promotion (--apply)...");
execFileSync("git", ["push", "origin", `${originMain}:staging`], { stdio: "inherit" });
console.log("DONE: pushed origin/main SHA to origin/staging.");
