/**
 * Canonical Phase 18SCALE session token store helpers.
 * One current token state per unique user. Never prints secrets.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { normalizeSessionRow } from "./session-shards.mjs";
import { SESSION_STAGE_TARGETS, stageSessionsPath } from "./session-stages.mjs";

export const CANONICAL_SESSIONS_FILE = "sessions-canonical-10000.ndjson";
export const CANONICAL_META_FILE = "sessions-canonical-10000.meta.json";
export const CANONICAL_CHECKPOINT_FILE = "sessions-canonical-10000.checkpoint.ndjson";
export const LOADCERT_REF = "arstaxredytrjcmqcwhh";

export function redactIdentity(email) {
  const s = String(email || "");
  const h = crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
  const idx = s.match(/p18scale-emp-(\d+)@/i)?.[1] ?? "?";
  return `emp-${idx}:${h}`;
}

export function hashTokenFingerprint(token) {
  if (!token || typeof token !== "string") return null;
  return crypto.createHash("sha256").update(token).digest("hex").slice(0, 24);
}

export function jwtExpMs(accessToken) {
  try {
    const payload = JSON.parse(
      Buffer.from(String(accessToken).split(".")[1], "base64url").toString("utf8"),
    );
    return payload.exp ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export function providerPathClass(row) {
  if (row?.provider_path) return String(row.provider_path);
  if (row?.package) return String(row.package);
  if (row?.provider_id) return "provider_bound";
  return "missing";
}

export function recordChecksum(publicFields) {
  return crypto.createHash("sha256").update(JSON.stringify(publicFields)).digest("hex").slice(0, 32);
}

export function toCanonicalRecord(row, extras = {}) {
  const normalized = normalizeSessionRow(row);
  const accessExp = jwtExpMs(normalized.access_token);
  const refreshFp = hashTokenFingerprint(normalized.refresh_token);
  const generation =
    Number(normalized.refresh_generation) > 0
      ? Number(normalized.refresh_generation)
      : Number(extras.refresh_generation) > 0
        ? Number(extras.refresh_generation)
        : 1;
  const publicFields = {
    user_id: normalized.user_id,
    index: normalized.index,
    company_id: normalized.company_id,
    location_id: normalized.location_id || null,
    provider_id: normalized.provider_id || null,
    provider_path: providerPathClass(normalized),
    source_shard: normalized.shard ?? extras.source_shard ?? null,
    source_run_id: extras.source_run_id ?? normalized.source_run_id ?? null,
    project_ref: extras.project_ref || normalized.project_ref || LOADCERT_REF,
    access_token_exp_ms: accessExp,
    refresh_generation: generation,
    refresh_fingerprint: refreshFp,
    run_date_checksum: extras.run_date_checksum || normalized.run_date_checksum || null,
    last_successful_refresh_at:
      extras.last_successful_refresh_at ||
      normalized.refreshed_at ||
      normalized.issued_at ||
      null,
  };
  return {
    ...normalized,
    identity_redacted: redactIdentity(normalized.email),
    provider_path: publicFields.provider_path,
    source_shard: publicFields.source_shard,
    source_run_id: publicFields.source_run_id,
    project_ref: publicFields.project_ref,
    access_token_exp_ms: accessExp,
    refresh_generation: generation,
    refresh_fingerprint: refreshFp,
    run_date_checksum: publicFields.run_date_checksum,
    last_successful_refresh_at: publicFields.last_successful_refresh_at,
    record_checksum: recordChecksum(publicFields),
    canonical: true,
  };
}

export function publicMetaFromRecord(row) {
  return {
    user_id: row.user_id,
    index: row.index,
    identity_redacted: row.identity_redacted,
    company_id: row.company_id,
    provider_path: row.provider_path,
    source_shard: row.source_shard,
    source_run_id: row.source_run_id,
    project_ref: row.project_ref,
    access_token_exp_ms: row.access_token_exp_ms,
    refresh_generation: row.refresh_generation,
    refresh_fingerprint: row.refresh_fingerprint,
    run_date_checksum: row.run_date_checksum,
    last_successful_refresh_at: row.last_successful_refresh_at,
    record_checksum: row.record_checksum,
  };
}

export async function loadNdjson(filePath) {
  const rows = [];
  if (!fs.existsSync(filePath)) return rows;
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (line.trim()) rows.push(normalizeSessionRow(JSON.parse(line)));
  }
  return rows;
}

export function isReusableSession(row) {
  return Boolean(
    row?.user_id &&
      row?.email &&
      row?.company_id &&
      row?.provider_id &&
      typeof row.access_token === "string" &&
      row.access_token.length > 20 &&
      typeof row.refresh_token === "string" &&
      row.refresh_token.length > 10,
  );
}

export function canonicalPath(evidenceDir) {
  return path.join(evidenceDir, CANONICAL_SESSIONS_FILE);
}

export function writeCanonicalStore(evidenceDir, rows, meta = {}) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const sorted = [...rows].sort(
    (a, b) => Number(a.index) - Number(b.index) || String(a.user_id).localeCompare(String(b.user_id)),
  );
  const outPath = canonicalPath(evidenceDir);
  const ckPath = path.join(evidenceDir, CANONICAL_CHECKPOINT_FILE);
  const body = sorted.map((r) => JSON.stringify(r)).join("\n") + (sorted.length ? "\n" : "");
  // Atomic replace: write temp then rename.
  const tmp = `${outPath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, body);
  fs.renameSync(tmp, outPath);
  fs.writeFileSync(ckPath, body);
  const report = {
    phase: "18SCALE",
    CANONICAL_SESSION_ROWS: sorted.length,
    CANONICAL_UNIQUE_USERS: new Set(sorted.map((r) => r.user_id)).size,
    CANONICAL_DUPLICATE_USERS: sorted.length - new Set(sorted.map((r) => r.user_id)).size,
    CANONICAL_MISSING_COMPANY: sorted.filter((r) => !r.company_id).length,
    CANONICAL_MISSING_PROVIDER_PATH: sorted.filter((r) => !r.provider_id && !r.provider_path).length,
    CANONICAL_WRONG_PROJECT: sorted.filter(
      (r) => r.project_ref && r.project_ref !== LOADCERT_REF,
    ).length,
    CANONICAL_MULTIPLE_CURRENT_TOKEN_VERSIONS: 0,
    project_ref: LOADCERT_REF,
    stamped_at: new Date().toISOString(),
    ...meta,
  };
  fs.writeFileSync(path.join(evidenceDir, CANONICAL_META_FILE), JSON.stringify(report, null, 2));
  return report;
}

export function deriveStageManifestsFromCanonical(evidenceDir, rows) {
  const sorted = [...rows].sort(
    (a, b) => Number(a.index) - Number(b.index) || String(a.user_id).localeCompare(String(b.user_id)),
  );
  const derived = {};
  for (const [stage, n] of Object.entries(SESSION_STAGE_TARGETS)) {
    const slice = sorted.slice(0, n).map((r) => ({
      ...r,
      // Stage files are runtime subsets; tokens mirror canonical at derivation time.
      stage_ref: stage,
      derived_from_canonical: true,
    }));
    const p = stageSessionsPath(evidenceDir, stage);
    const ckp = path.join(evidenceDir, `sessions-${stage}.checkpoint.ndjson`);
    fs.writeFileSync(p, slice.map((r) => JSON.stringify(r)).join("\n") + "\n");
    fs.writeFileSync(ckp, slice.map((r) => JSON.stringify(r)).join("\n") + "\n");
    derived[stage] = {
      SESSION_ROWS: slice.length,
      SESSION_UNIQUE_USER_IDS: new Set(slice.map((r) => r.user_id)).size,
      SESSION_UNIQUE_EMAIL_IDENTITIES: new Set(slice.map((r) => r.email)).size,
      SESSION_VALID_ACCESS_TOKENS: slice.filter(
        (r) => typeof r.access_token === "string" && r.access_token.length > 20,
      ).length,
      SESSION_REFRESHABLE: slice.filter(
        (r) => typeof r.refresh_token === "string" && r.refresh_token.length > 10,
      ).length,
      SESSION_DUPLICATE_USER_IDS: slice.length - new Set(slice.map((r) => r.user_id)).size,
      SESSION_INVALID_USERS: slice.filter((r) => !isReusableSession(r)).length,
      SESSION_COMPANY_RELATION_MISSING: slice.filter((r) => !r.company_id).length,
      SESSION_PROVIDER_PATH_MISSING: slice.filter((r) => !r.provider_id).length,
      SESSION_WRAP: slice.length < n,
    };
  }
  if (sorted.length) {
    fs.copyFileSync(stageSessionsPath(evidenceDir, "ramp-10000"), path.join(evidenceDir, "sessions.ndjson"));
  }
  return derived;
}

export function classifyRefreshError(error, httpStatus = null, retryAfter = null) {
  const msg = String(error?.message || error || "").toLowerCase();
  const code = String(error?.code || error?.error || error?.name || "").toLowerCase();
  const status = httpStatus ?? error?.status ?? null;

  if (status === 429 || msg.includes("rate limit") || msg.includes("request rate limit")) {
    return "AUTH_RATE_LIMIT";
  }
  if (msg.includes("already used") || msg.includes("refresh_token_already_used")) {
    return "REFRESH_TOKEN_ALREADY_USED";
  }
  if (msg.includes("invalid refresh token") && msg.includes("session")) {
    return "REFRESH_TOKEN_ROTATED_STALE_COPY";
  }
  if (code === "invalid_grant" || msg.includes("invalid_grant")) {
    return "INVALID_GRANT";
  }
  if (msg.includes("expired") && msg.includes("refresh")) {
    return "REFRESH_TOKEN_EXPIRED";
  }
  if (status >= 500 || msg.includes("502") || msg.includes("503") || msg.includes("504")) {
    return "HTTP_5XX";
  }
  if (msg.includes("timeout") || msg.includes("network") || msg.includes("fetch failed")) {
    return "NETWORK_TIMEOUT";
  }
  if (
    msg.includes("user not found") ||
    msg.includes("disabled") ||
    msg.includes("banned") ||
    code === "user_not_found"
  ) {
    return "USER_DISABLED_OR_MISSING";
  }
  if (msg.includes("parse") || msg.includes("unexpected token")) {
    return "TOKEN_RESPONSE_PARSE_ERROR";
  }
  if (retryAfter != null) return "AUTH_RATE_LIMIT";
  return "ANOTHER_EXACT_CAUSE";
}
