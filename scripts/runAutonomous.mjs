/**
 * Node entrypoint for CI / automation: runs `tsx scripts/runAutonomous.ts`.
 * Usage: node scripts/runAutonomous.mjs
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const r = spawnSync("npx", ["tsx", "scripts/runAutonomous.ts"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
process.exit(r.status ?? 1);
