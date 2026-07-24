/**
 * AES-256-GCM helpers for Phase 18SCALE session artifacts.
 * Key never logged. Plaintext never written outside runner temp by callers.
 */
import crypto from "node:crypto";
import fs from "node:fs";

const MAGIC = "P18SCALE1";

export function resolveArtifactKey(env = process.env) {
  const explicit = String(env.PHASE18_SESSION_ARTIFACT_KEY || "").trim();
  if (explicit) {
    const buf = decodeKey(explicit);
    if (buf.length !== 32) throw new Error("PHASE18_SESSION_ARTIFACT_KEY_MUST_BE_32_BYTES");
    return { key: buf, source: "secret" };
  }
  const service = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!service) throw new Error("PHASE18_SESSION_ARTIFACT_KEY_MISSING");
  const ref = String(env.PHASE18_LOAD_REF || "arstaxredytrjcmqcwhh");
  const key = Buffer.from(
    crypto.hkdfSync(
      "sha256",
      Buffer.from(service, "utf8"),
      Buffer.from(ref, "utf8"),
      Buffer.from("phase18-session-artifact-v1"),
      32,
    ),
  );
  return { key, source: "derived_service_role_hkdf" };
}

function decodeKey(raw) {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  try {
    const b = Buffer.from(raw, "base64");
    if (b.length === 32) return b;
  } catch {
    /* fall through */
  }
  return crypto.createHash("sha256").update(raw).digest();
}

export function checksumBuffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function encryptBuffer(plaintext, key) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const plainChecksum = checksumBuffer(plaintext);
  const payload = Buffer.concat([
    Buffer.from(MAGIC, "utf8"),
    nonce,
    tag,
    Buffer.from(plainChecksum, "hex"),
    ciphertext,
  ]);
  return {
    payload,
    nonce_hex: nonce.toString("hex"),
    plain_checksum: plainChecksum,
    cipher_checksum: checksumBuffer(payload),
  };
}

export function decryptBuffer(payload, key) {
  const magicLen = MAGIC.length;
  if (payload.length < magicLen + 12 + 16 + 32) throw new Error("PHASE18_CIPHER_TOO_SHORT");
  const magic = payload.subarray(0, magicLen).toString("utf8");
  if (magic !== MAGIC) throw new Error("PHASE18_CIPHER_MAGIC_MISMATCH");
  let o = magicLen;
  const nonce = payload.subarray(o, o + 12);
  o += 12;
  const tag = payload.subarray(o, o + 16);
  o += 16;
  const expectedPlain = payload.subarray(o, o + 32).toString("hex");
  o += 32;
  const ciphertext = payload.subarray(o);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const actual = checksumBuffer(plaintext);
  if (actual !== expectedPlain) throw new Error("PHASE18_PLAIN_CHECKSUM_MISMATCH");
  return { plaintext, plain_checksum: actual, cipher_checksum: checksumBuffer(payload) };
}

export function encryptFileTo(plaintextPath, outPath, key) {
  const plaintext = fs.readFileSync(plaintextPath);
  const enc = encryptBuffer(plaintext, key);
  fs.writeFileSync(outPath, enc.payload);
  return {
    plain_checksum: enc.plain_checksum,
    cipher_checksum: enc.cipher_checksum,
    nonce_hex: enc.nonce_hex,
    bytes: enc.payload.length,
  };
}

export function decryptFileTo(cipherPath, outPath, key) {
  const payload = fs.readFileSync(cipherPath);
  const dec = decryptBuffer(payload, key);
  fs.writeFileSync(outPath, dec.plaintext);
  return {
    plain_checksum: dec.plain_checksum,
    cipher_checksum: dec.cipher_checksum,
    bytes: dec.plaintext.length,
  };
}
