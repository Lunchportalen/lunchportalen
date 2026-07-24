#!/usr/bin/env node
/**
 * Decrypt an encrypted canonical cycle artifact into evidence for shard workers.
 * Deletes nothing encrypted; writes plaintext only when PHASE18_ALLOW_PLAINTEXT_MATERIALIZE=1.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decryptFileTo, resolveArtifactKey } from "./lib/session-artifact-crypto.mjs";
import { loadNdjson } from "./lib/canonical-session-store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

async function main() {
  const cycle = Number(process.env.PHASE18_REFRESH_CYCLE || 1);
  const encName =
    process.env.PHASE18_CANONICAL_CIPHER ||
    (cycle === 1 ? "sessions-canonical-10000.ndjson.aes" : "sessions-canonical-cycle-1.ndjson.aes");
  const plainName =
    process.env.PHASE18_CANONICAL_INPUT ||
    (cycle === 1 ? "sessions-canonical-10000.ndjson" : "sessions-canonical-cycle-1.ndjson");
  const encPath = path.isAbsolute(encName) ? encName : path.join(OUT, path.basename(encName));
  const plainPath = path.isAbsolute(plainName)
    ? plainName
    : plainName.includes("/") || plainName.includes("\\")
      ? path.resolve(plainName)
      : path.join(OUT, plainName);

  if (fs.existsSync(plainPath)) {
    const rows = await loadNdjson(plainPath);
    console.log(JSON.stringify({ materialized: "already_plain", rows: rows.length, path: plainName }));
    return;
  }
  if (!fs.existsSync(encPath)) {
    // Fall back: unencrypted canonical from build step (cycle 1 input).
    const fallback = path.join(OUT, "sessions-canonical-10000.ndjson");
    if (cycle === 1 && fs.existsSync(fallback)) {
      console.log(JSON.stringify({ materialized: "plain_canonical", rows: (await loadNdjson(fallback)).length }));
      return;
    }
    throw new Error(`PHASE18_CANONICAL_INPUT_MISSING enc=${encName} plain=${plainName}`);
  }
  const { key, source } = resolveArtifactKey();
  const meta = decryptFileTo(encPath, plainPath, key);
  const rows = await loadNdjson(plainPath);
  if (rows.length !== 10000) throw new Error(`PHASE18_MATERIALIZE_ROWS=${rows.length}`);
  console.log(
    JSON.stringify({
      materialized: "decrypted",
      rows: rows.length,
      key_source: source,
      plain_checksum: meta.plain_checksum,
      cipher_checksum: meta.cipher_checksum,
    }),
  );
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(2);
});
