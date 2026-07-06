#!/usr/bin/env node
/**
 * Phase C provider onboarding factory entrypoint.
 * Delegates to TypeScript planner/CLI via tsx (no secrets, no default live writes).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const tsEntry = path.join(dir, "phase-c-onboard-provider.ts");
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsx", tsEntry, ...process.argv.slice(2)],
  { stdio: "inherit", shell: process.platform === "win32" },
);
process.exit(result.status ?? 1);
