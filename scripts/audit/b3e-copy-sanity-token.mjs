/**
 * Copy Lunchportalen_Staging_Editor from .env.local → SANITY_WRITE_TOKEN in extract.
 * Never prints full token.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const envPath = join(root, ".env.local");
const extractPath = join(root, "scripts", "audit", "staging-env-actual-2026-05-20.env");

const raw = readFileSync(envPath, "utf8");
let token = "";
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  if (t.startsWith("Lunchportalen_Staging_Editor=")) {
    token = t.slice("Lunchportalen_Staging_Editor=".length).trim();
    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))
    ) {
      token = token.slice(1, -1);
    }
    break;
  }
}

if (!token) {
  console.error("MISSING_KEY");
  process.exit(2);
}
if (token.length < 100) {
  console.error("INVALID_LENGTH", token.length);
  process.exit(3);
}
if (!token.startsWith("sk")) {
  console.error("INVALID_PREFIX", token.slice(0, 3));
  process.exit(4);
}

const lines = readFileSync(extractPath, "utf8").split(/\r?\n/);
let replaced = false;
const out = lines.map((line) => {
  if (line.startsWith("# SANITY_WRITE_TOKEN=") || line.startsWith("SANITY_WRITE_TOKEN=")) {
    replaced = true;
    return `SANITY_WRITE_TOKEN=${token}`;
  }
  return line;
});
if (!replaced) {
  console.error("NO_TARGET_LINE");
  process.exit(5);
}
writeFileSync(extractPath, out.join("\n"), "utf8");
console.log("OK");
console.log("LENGTH", token.length);
console.log("PREFIX", token.slice(0, 3));
