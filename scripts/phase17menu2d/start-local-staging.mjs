import { spawn } from "node:child_process";
import fs from "node:fs";
import { loadStagingEnv } from "./load-staging-env.mjs";

loadStagingEnv();
process.env.LP_PACKAGE_ENTITLEMENTS_RUNTIME = process.env.LP_PACKAGE_ENTITLEMENTS_RUNTIME || "1";
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000";
process.env.PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || "http://127.0.0.1:3000";
process.env.PORT = process.env.PORT || "3000";

const log = fs.openSync("temp/next-start-2d.log", "a");
const child = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", "3000"], {
  cwd: process.cwd(),
  env: process.env,
  detached: true,
  stdio: ["ignore", log, log],
  shell: true,
});
child.unref();
fs.writeFileSync("temp/next-2d.pid", String(child.pid));
console.log(JSON.stringify({ pid: child.pid, port: 3000 }));
