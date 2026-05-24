/**
 * Rotate SANITY_WEBHOOK_SECRET; cleanup .env.local (choice A). No secret output.
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const extractPath = join(root, "scripts", "audit", "staging-env-actual-2026-05-20.env");
const envPath = join(root, ".env.local");
function rotateWebhook() {
  const secret = randomBytes(32).toString("hex");
  const lines = readFileSync(extractPath, "utf8").split(/\r?\n/);
  let ok = false;
  const out = lines.map((line) => {
    if (line.startsWith("SANITY_WEBHOOK_SECRET=")) {
      ok = true;
      return `SANITY_WEBHOOK_SECRET=${secret}`;
    }
    return line;
  });
  if (!ok) {
    console.error("WEBHOOK_LINE_MISSING");
    process.exit(1);
  }
  writeFileSync(extractPath, out.join("\n"), "utf8");
  return { length: secret.length, format: "hex" };
}

function cleanupEnvLocal() {
  const before = readFileSync(envPath, "utf8");
  let writeTokenLen = 0;
  const out = [];
  let removedOld = false;
  for (const line of before.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith("Lunchportalen_Staging_Editor=")) {
      removedOld = true;
      continue;
    }
    if (t.startsWith("SANITY_WRITE_TOKEN=")) {
      let v = t.slice("SANITY_WRITE_TOKEN=".length).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      writeTokenLen = v.length;
    }
    out.push(line);
  }
  if (!removedOld) {
    console.error("OLD_LINE_NOT_FOUND");
    process.exit(2);
  }
  const hasWrite = out.some((l) => l.trim().startsWith("SANITY_WRITE_TOKEN="));
  if (!hasWrite) {
    console.error("SANITY_WRITE_TOKEN_MISSING");
    process.exit(3);
  }
  const hasOld = out.some((l) => l.trim().startsWith("Lunchportalen_Staging_Editor="));
  if (hasOld) {
    console.error("OLD_LINE_STILL_PRESENT");
    process.exit(4);
  }
  writeFileSync(envPath, out.join("\n"), "utf8");
  return { writeTokenLen };
}

const webhook = rotateWebhook();
const env = cleanupEnvLocal();

console.log("WEBHOOK_LENGTH", webhook.length);
console.log("WEBHOOK_FORMAT", webhook.format);
console.log("REMOVED_OLD_EDITOR", "yes");
console.log("WRITE_TOKEN_LENGTH", env.writeTokenLen);
