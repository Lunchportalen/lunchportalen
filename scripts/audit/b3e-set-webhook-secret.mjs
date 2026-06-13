/**
 * Set SANITY_WEBHOOK_SECRET in staging extract (hex, no stdout of secret).
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const extractPath = join(__dirname, "staging-env-actual-2026-05-20.env");

const secret = randomBytes(32).toString("hex");
const lines = readFileSync(extractPath, "utf8").split(/\r?\n/);
let replaced = false;
const out = lines.map((line) => {
  if (line.startsWith("# SANITY_WEBHOOK_SECRET=") || line.startsWith("SANITY_WEBHOOK_SECRET=")) {
    replaced = true;
    return `SANITY_WEBHOOK_SECRET=${secret}`;
  }
  return line;
});
if (!replaced) {
  console.error("NO_TARGET_LINE");
  process.exit(1);
}
writeFileSync(extractPath, out.join("\n"), "utf8");
console.log("OK");
console.log("LENGTH", secret.length);
console.log("FORMAT", "hex");
