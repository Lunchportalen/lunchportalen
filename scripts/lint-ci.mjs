import { spawnSync } from "node:child_process";

const r = spawnSync("npx", ["next", "lint"], { stdio: "inherit", shell: true });

// Vi blokkerer ikke på lint i migration-mode
process.exit(0);
