#!/usr/bin/env node
/**
 * Launcher for Fase A dry-run (tsx + TypeScript core).
 *   node scripts/menu-publish/dryrun-week-generation.mjs [--target-week YYYY-MM-DD]
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const tsEntry = path.join(dir, "dryrun-week-generation.ts");

const child = spawnSync("npx", ["tsx", tsEntry, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(child.status ?? 1);
