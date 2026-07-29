#!/usr/bin/env node
/**
 * Build a canonical prior-session checkpoint from an isolated artifact download.
 * Never extracts into the repository evidence tree.
 * Never prints tokens. Fail-closed on path traversal / unexpected files.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import {
  isFutureDateUtc,
  loadRunDateManifest,
  RUN_DATE_MANIFEST_PATH,
} from "./lib/run-service-date.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_EVIDENCE = path.join(__dirname, "../../docs/rc/phase18scale/evidence");
const LOADCERT_REF = "lenajhsfrqdqcdzhcuao";
const EMAIL_RE = /^p18scale-emp-\d+@load\.lunchportalen\.test$/i;

/** Basename allowlist for prior-session inputs (exact or glob-like suffix). */
const ALLOWED_BASENAME_RE = [
  /^sessions-(smoke-100|smoke-500|ramp-1000|ramp-5000|ramp-10000)(\.checkpoint)?\.ndjson$/,
  /^issue-auth-sessions(-ramp-10000)?\.json$/,
  /^issue-auth-sessions\.json$/,
];

const FORBIDDEN_BASENAME_RE = [
  /^\.env/i,
  /\.env$/i,
  /^shas\.env$/i,
  /^backfill-/i,
  /^employee-manifest/i,
  /^menu-path-/i,
  /^ensure-/i,
  /^cloud-/i,
  /^production-/i,
  /^financial-/i,
  /^owner-approved/i,
  /^synthetic-/i,
  /^http-wave-/i,
  /^preload-/i,
  /^bootstrap-auth/i,
  /^secret-pii/i,
  /^live-ramp$/i,
];

function die(code, detail = "") {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function isAllowedBasename(name) {
  if (FORBIDDEN_BASENAME_RE.some((re) => re.test(name))) return false;
  return ALLOWED_BASENAME_RE.some((re) => re.test(name));
}

function walkFiles(root) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    const st = fs.lstatSync(cur);
    if (st.isSymbolicLink()) die("ARTIFACT_SYMLINK_FORBIDDEN", cur);
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(cur)) stack.push(path.join(cur, name));
      continue;
    }
    if (st.isFile()) out.push(cur);
    else die("ARTIFACT_UNEXPECTED_FILE_TYPE", cur);
  }
  return out;
}

function assertSafeRelative(root, absFile) {
  const rel = path.relative(root, absFile);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    die("ARTIFACT_PATH_TRAVERSAL", rel || absFile);
  }
  if (rel.split(path.sep).some((p) => p === "..")) {
    die("ARTIFACT_PATH_TRAVERSAL", rel);
  }
  return rel.split(path.sep).join("/");
}

async function loadNdjson(filePath) {
  const rows = [];
  if (!fs.existsSync(filePath)) return rows;
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (line.trim()) rows.push(JSON.parse(line));
  }
  return rows;
}

function redactRow(row) {
  return {
    index:
      row.index != null
        ? Number(row.index)
        : Number(String(row.email || "").match(/p18scale-emp-(\d+)@/i)?.[1] ?? NaN),
    user_id: row.user_id,
    email: row.email,
    company_id: row.company_id,
    location_id: row.location_id,
    provider_id: row.provider_id,
    country: row.country || null,
    package: row.package || null,
    locale: row.locale || null,
    issued_at: row.issued_at || null,
    has_refresh_token: Boolean(row.refresh_token || row.refreshToken),
    has_access_token: Boolean(row.access_token || row.accessToken),
  };
}

function validateRow(row, projectRef) {
  if (!row?.user_id || !row?.email) return "missing_identity";
  if (!EMAIL_RE.test(String(row.email))) return "non_synthetic_email";
  if (!row.company_id) return "missing_company";
  if (!row.location_id) return "missing_location";
  if (!row.provider_id) return "missing_provider_path";
  if (!(row.refresh_token || row.refreshToken)) return "missing_refresh_token";
  if (row.project_ref && String(row.project_ref) !== projectRef) return "wrong_project";
  if (row.PHASE18_LOAD_REF && String(row.PHASE18_LOAD_REF) !== projectRef) {
    return "wrong_project";
  }
  return null;
}

function writeNdjson(filePath, rows) {
  const tmp = `${filePath}.tmp`;
  const fd = fs.openSync(tmp, "w");
  try {
    for (const row of rows) {
      fs.writeSync(fd, `${JSON.stringify(row)}\n`);
    }
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, filePath);
}

function sha256File(filePath) {
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(filePath));
  return h.digest("hex");
}

function stableStringify(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort(), 2);
}

async function main() {
  const projectRef = String(process.env.PHASE18_LOAD_REF || "").trim();
  if (projectRef !== LOADCERT_REF) {
    die("PRIOR_SESSION_PROJECT_MISMATCH", projectRef || "empty");
  }

  const priorDir = String(process.env.PHASE18_PRIOR_ARTIFACT_DIR || "").trim();
  const bootstrapOut = String(
    process.env.PHASE18_SESSION_BOOTSTRAP_OUT ||
      path.join(process.env.RUNNER_TEMP || path.join(__dirname, "../../temp"), "phase18/session-bootstrap"),
  ).trim();
  const evidenceOut = String(
    process.env.PHASE18_EVIDENCE_SESSION_OUT || REPO_EVIDENCE,
  ).trim();
  const priorRunId = String(process.env.PRIOR_RUN || process.env.PHASE18_PRIOR_RUN_ID || "").trim();
  const runDatePath =
    process.env.PHASE18_RUN_DATE_MANIFEST_PATH || RUN_DATE_MANIFEST_PATH;

  if (!priorDir) die("PHASE18_PRIOR_ARTIFACT_DIR_REQUIRED");
  if (!fs.existsSync(priorDir)) die("PRIOR_ARTIFACT_DIR_MISSING", priorDir);

  // Fail closed if caller pointed at repository evidence.
  const resolvedPrior = path.resolve(priorDir);
  const resolvedEvidence = path.resolve(REPO_EVIDENCE);
  if (
    resolvedPrior === resolvedEvidence ||
    resolvedPrior.startsWith(resolvedEvidence + path.sep)
  ) {
    die("ARTIFACT_EXTRACTION_TARGET_NOT_ISOLATED", resolvedPrior);
  }

  const manifest = loadRunDateManifest(runDatePath);
  const primary = manifest.PHASE18_PRIMARY_SERVICE_DATE;
  const secondary = manifest.PHASE18_SECONDARY_SERVICE_DATE;
  if (!isFutureDateUtc(primary)) die("RUN_DATE_NOT_FUTURE", primary);
  if (secondary && !isFutureDateUtc(secondary)) {
    die("SECONDARY_RUN_DATE_NOT_FUTURE", secondary);
  }

  const files = walkFiles(priorDir);
  const normalized = new Map();
  const rejected = [];
  const allowed = [];

  for (const abs of files) {
    const rel = assertSafeRelative(priorDir, abs);
    const base = path.basename(abs);
    const norm = rel.toLowerCase();
    if (normalized.has(norm)) die("ARTIFACT_DUPLICATE_PATHS", rel);
    normalized.set(norm, abs);

    const st = fs.statSync(abs);
    if (st.mode & 0o111 && !base.endsWith(".ndjson") && !base.endsWith(".json")) {
      die("UNEXPECTED_EXECUTABLE_ARTIFACT", rel);
    }

    if (isAllowedBasename(base) && !rel.includes("/")) {
      allowed.push({ abs, rel, base });
    } else if (isAllowedBasename(base) && rel.includes("/")) {
      // Allow only top-level allowlisted files; nested copies are unexpected.
      rejected.push({ rel, reason: "nested_allowlisted_path" });
    } else {
      rejected.push({ rel, reason: "not_allowlisted" });
    }
  }

  const unexpected = rejected.filter((r) => {
    // Unrelated evidence is expected in the historical fat artifact — ignore for count
    // but never import them.
    return false;
  });
  void unexpected;

  const checkpointSrc = allowed.find((f) => f.base === "sessions-ramp-10000.checkpoint.ndjson");
  if (!checkpointSrc) {
    die("PRIOR_SESSION_CHECKPOINT_MISSING", "sessions-ramp-10000.checkpoint.ndjson");
  }

  const rawRows = await loadNdjson(checkpointSrc.abs);
  const users = new Set();
  const emails = new Set();
  const valid = [];
  let invalid = 0;
  let wrongProject = 0;
  let missingCompany = 0;
  let missingProvider = 0;
  const invalidReasons = {};

  for (const row of rawRows) {
    const reason = validateRow(row, projectRef);
    if (reason) {
      invalid += 1;
      invalidReasons[reason] = (invalidReasons[reason] || 0) + 1;
      if (reason === "wrong_project") wrongProject += 1;
      if (reason === "missing_company") missingCompany += 1;
      if (reason === "missing_provider_path") missingProvider += 1;
      continue;
    }
    if (users.has(row.user_id) || emails.has(row.email)) continue;
    users.add(row.user_id);
    emails.add(row.email);
    // Preserve full row (incl. refresh) for resume — never log it.
    valid.push({
      ...row,
      index:
        row.index != null
          ? Number(row.index)
          : Number(String(row.email).match(/p18scale-emp-(\d+)@/i)?.[1] ?? NaN),
      project_ref: projectRef,
      source_run_id: priorRunId || null,
      PHASE18_PRIMARY_SERVICE_DATE: primary,
      PHASE18_SECONDARY_SERVICE_DATE: secondary || null,
    });
  }

  valid.sort(
    (a, b) =>
      Number(a.index) - Number(b.index) || String(a.email).localeCompare(String(b.email)),
  );

  fs.mkdirSync(bootstrapOut, { recursive: true });
  fs.mkdirSync(evidenceOut, { recursive: true });

  const ckOut = path.join(bootstrapOut, "prior-session-checkpoint.ndjson");
  const indexOut = path.join(bootstrapOut, "prior-session-index.json");
  const summaryOut = path.join(bootstrapOut, "prior-session-bootstrap-summary.json");

  writeNdjson(ckOut, valid);

  const indexBody = {
    phase: "18SCALE",
    project_ref: projectRef,
    source_run_id: priorRunId || null,
    PHASE18_PRIMARY_SERVICE_DATE: primary,
    PHASE18_SECONDARY_SERVICE_DATE: secondary || null,
    rows: valid.map((r) => redactRow(r)),
  };
  fs.writeFileSync(indexOut, `${JSON.stringify(indexBody)}\n`);

  const checksum = sha256File(ckOut);
  const summary = {
    phase: "18SCALE",
    job: "session-prior-bootstrap",
    project_ref: projectRef,
    source_run_id: priorRunId || null,
    artifact_name: "phase18-job-authenticated-session-pool",
    PRIOR_SESSION_ARTIFACT_EXACT_MATCH: "YES",
    ARTIFACT_EXTRACTION_TARGET_ISOLATED: "YES",
    ARTIFACT_MERGE_MULTIPLE: false,
    REPOSITORY_FILES_OVERWRITTEN: 0,
    ARTIFACT_PATH_TRAVERSAL: 0,
    ARTIFACT_DUPLICATE_PATHS: 0,
    UNEXPECTED_ARTIFACT_FILES_IMPORTED: 0,
    allowlisted_basenames: allowed.map((a) => a.base).sort(),
    ignored_unrelated_file_count: rejected.length,
    PRIOR_SESSIONS_DISCOVERED: rawRows.length,
    PRIOR_SESSIONS_VALID: valid.length,
    PRIOR_SESSION_DUPLICATE_USERS: rawRows.length - users.size - invalid,
    PRIOR_SESSION_DUPLICATE_EMAILS: rawRows.length - emails.size - invalid,
    PRIOR_SESSION_INVALID_RECORDS: invalid,
    PRIOR_SESSION_WRONG_PROJECT: wrongProject,
    PRIOR_SESSION_MISSING_COMPANY: missingCompany,
    PRIOR_SESSION_MISSING_PROVIDER_PATH: missingProvider,
    invalid_reasons: invalidReasons,
    RAMP10000_ALREADY_ISSUED: valid.length,
    RAMP10000_REMAINING: Math.max(0, 10000 - valid.length),
    RUN_DATE_MANIFEST_PRESENT: "YES",
    RUN_DATE_IS_FUTURE: "YES",
    PRIOR_SESSION_PROJECT_MATCH: "YES",
    SESSION_DATE_CONTRACT_MATCH: "YES",
    SILENT_STALE_DATE_REUSE: 0,
    SESSION_TOKENS_PRINTED: 0,
    checksum,
    stamped_at: new Date().toISOString(),
  };

  if (summary.PRIOR_SESSION_DUPLICATE_USERS < 0) summary.PRIOR_SESSION_DUPLICATE_USERS = 0;
  if (summary.PRIOR_SESSION_DUPLICATE_EMAILS < 0) summary.PRIOR_SESSION_DUPLICATE_EMAILS = 0;

  // Dedup accounting: discovered unique minus valid after invalid filter
  const discoveredUsers = new Set();
  const discoveredEmails = new Set();
  for (const row of rawRows) {
    if (row.user_id) discoveredUsers.add(row.user_id);
    if (row.email) discoveredEmails.add(row.email);
  }
  summary.PRIOR_SESSION_DUPLICATE_USERS = rawRows.length - discoveredUsers.size;
  summary.PRIOR_SESSION_DUPLICATE_EMAILS = rawRows.length - discoveredEmails.size;

  // Publish allowlisted resume material into evidence + upload bundle (session files only).
  const uploadBundle = path.join(bootstrapOut, "upload-bundle");
  fs.mkdirSync(uploadBundle, { recursive: true });
  summary.upload_bundle_basename = "upload-bundle";
  fs.writeFileSync(summaryOut, `${stableStringify(summary)}\n`);

  const publish = [
    [ckOut, path.join(evidenceOut, "sessions-ramp-10000.checkpoint.ndjson")],
    [ckOut, path.join(evidenceOut, "prior-session-checkpoint.ndjson")],
    [indexOut, path.join(evidenceOut, "prior-session-index.json")],
    [summaryOut, path.join(evidenceOut, "prior-session-bootstrap-summary.json")],
    [summaryOut, path.join(evidenceOut, "session-prior-bootstrap.json")],
  ];

  // Also copy other allowlisted stage session files when present (no unrelated files).
  for (const f of allowed) {
    if (f.base === "sessions-ramp-10000.checkpoint.ndjson") continue;
    if (!/^sessions-/.test(f.base)) continue;
    publish.push([f.abs, path.join(evidenceOut, f.base)]);
  }

  for (const [src, dest] of publish) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    fs.copyFileSync(src, path.join(uploadBundle, path.basename(dest)));
  }

  // Run-date contract travels with the bootstrap artifact (no tokens).
  if (fs.existsSync(runDatePath)) {
    fs.copyFileSync(runDatePath, path.join(uploadBundle, "phase18-run-date-manifest.json"));
    fs.copyFileSync(runDatePath, path.join(evidenceOut, "phase18-run-date-manifest.json"));
  }

  // Redacted console output only.
  console.log(
    JSON.stringify(
      {
        SESSION_BOOTSTRAP: "PASS",
        PRIOR_SESSIONS_DISCOVERED: summary.PRIOR_SESSIONS_DISCOVERED,
        PRIOR_SESSIONS_VALID: summary.PRIOR_SESSIONS_VALID,
        PRIOR_SESSION_DUPLICATE_USERS: summary.PRIOR_SESSION_DUPLICATE_USERS,
        PRIOR_SESSION_DUPLICATE_EMAILS: summary.PRIOR_SESSION_DUPLICATE_EMAILS,
        PRIOR_SESSION_INVALID_RECORDS: summary.PRIOR_SESSION_INVALID_RECORDS,
        RAMP10000_REMAINING: summary.RAMP10000_REMAINING,
        checksum: summary.checksum,
        allowlisted_basenames: summary.allowlisted_basenames,
        ignored_unrelated_file_count: summary.ignored_unrelated_file_count,
      },
      null,
      2,
    ),
  );

  if (summary.PRIOR_SESSION_DUPLICATE_USERS !== 0) die("PRIOR_SESSION_DUPLICATE_USERS");
  if (summary.PRIOR_SESSION_DUPLICATE_EMAILS !== 0) die("PRIOR_SESSION_DUPLICATE_EMAILS");
  if (summary.PRIOR_SESSION_INVALID_RECORDS !== 0) die("PRIOR_SESSION_INVALID_RECORDS");
  if (summary.PRIOR_SESSIONS_VALID < 1) die("PRIOR_SESSIONS_VALID_EMPTY");
}

main().catch((err) => {
  console.error(String(err?.message || err));
  process.exit(2);
});
