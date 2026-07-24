#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { decryptBuffer, encryptBuffer, encryptFileTo, decryptFileTo, resolveArtifactKey } from "./session-artifact-crypto.mjs";

const { key, source } = resolveArtifactKey({
  PHASE18_SESSION_ARTIFACT_KEY: "a".repeat(64),
});
assert.equal(source, "secret");
assert.equal(key.length, 32);

const plain = Buffer.from("user_id,token\n1,abc\n", "utf8");
const enc = encryptBuffer(plain, key);
const dec = decryptBuffer(enc.payload, key);
assert.equal(dec.plaintext.toString("utf8"), plain.toString("utf8"));
assert.equal(dec.plain_checksum, enc.plain_checksum);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "p18-crypto-"));
const inPath = path.join(tmp, "in.ndjson");
const outPath = path.join(tmp, "out.bin");
const backPath = path.join(tmp, "back.ndjson");
fs.writeFileSync(inPath, plain);
const meta = encryptFileTo(inPath, outPath, key);
decryptFileTo(outPath, backPath, key);
assert.equal(fs.readFileSync(backPath, "utf8"), plain.toString("utf8"));
assert.equal(meta.plain_checksum.length, 64);
fs.rmSync(tmp, { recursive: true, force: true });

console.log(JSON.stringify({ session_artifact_crypto_tests: "PASS" }));
