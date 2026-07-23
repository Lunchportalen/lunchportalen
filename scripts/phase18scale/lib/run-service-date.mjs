/**
 * Canonical Phase 18SCALE run-date contract.
 * No silent date invention. Fail closed when the run manifest is missing/disagreeing.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const RUN_DATE_MANIFEST_PATH = path.join(
  __dirname,
  "../../../docs/rc/phase18scale/evidence/phase18-run-date-manifest.json",
);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value) {
  return DATE_RE.test(String(value || ""));
}

export function nextWeekdayUtc(from = new Date(), offsetDays = 1) {
  const d = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() + offsetDays);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function previousWeekdayUtc(isoDate) {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function isFutureDateUtc(isoDate, now = new Date()) {
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);
  return String(isoDate) > today;
}

export function loadRunDateManifest(filePath = RUN_DATE_MANIFEST_PATH) {
  if (!fs.existsSync(filePath)) {
    throw new Error("PHASE18_RUN_DATE_MANIFEST_MISSING");
  }
  const manifest = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const primary =
    manifest.PHASE18_PRIMARY_SERVICE_DATE ||
    manifest.PHASE18_RUN_SERVICE_DATE ||
    null;
  const secondary = manifest.PHASE18_SECONDARY_SERVICE_DATE || null;
  if (!isIsoDate(primary)) throw new Error("PHASE18_RUN_DATE_MANIFEST_INVALID_PRIMARY");
  if (secondary && !isIsoDate(secondary)) {
    throw new Error("PHASE18_RUN_DATE_MANIFEST_INVALID_SECONDARY");
  }
  return {
    ...manifest,
    PHASE18_RUN_SERVICE_DATE: primary,
    PHASE18_PRIMARY_SERVICE_DATE: primary,
    PHASE18_SECONDARY_SERVICE_DATE: secondary,
    service_dates: secondary ? [primary, secondary] : [primary],
  };
}

/**
 * Resolve the single primary service date for order/HTTP/recon paths.
 * Env overrides must match the run manifest when both are present.
 */
export function requirePrimaryServiceDate(env = process.env, filePath = RUN_DATE_MANIFEST_PATH) {
  const fromEnv =
    env.PHASE18_PRIMARY_SERVICE_DATE ||
    env.PHASE18_RUN_SERVICE_DATE ||
    env.PHASE18_SERVICE_DATE ||
    null;
  let fromManifest = null;
  try {
    fromManifest = loadRunDateManifest(filePath).PHASE18_PRIMARY_SERVICE_DATE;
  } catch (e) {
    if (!fromEnv) throw e;
  }
  if (fromEnv && fromManifest && String(fromEnv) !== String(fromManifest)) {
    throw new Error(
      `PHASE18_SERVICE_DATE_CONTRACT_MISMATCH env=${fromEnv} manifest=${fromManifest}`,
    );
  }
  const primary = fromEnv || fromManifest;
  if (!isIsoDate(primary)) throw new Error("PHASE18_PRIMARY_SERVICE_DATE_REQUIRED");
  return String(primary);
}

export function requireServiceDates(env = process.env, filePath = RUN_DATE_MANIFEST_PATH) {
  const primary = requirePrimaryServiceDate(env, filePath);
  const secondaryEnv = env.PHASE18_SECONDARY_SERVICE_DATE || null;
  let secondaryManifest = null;
  try {
    secondaryManifest = loadRunDateManifest(filePath).PHASE18_SECONDARY_SERVICE_DATE;
  } catch {
    /* optional when env-only primary is accepted during bootstrap write */
  }
  if (secondaryEnv && secondaryManifest && String(secondaryEnv) !== String(secondaryManifest)) {
    throw new Error(
      `PHASE18_SECONDARY_DATE_CONTRACT_MISMATCH env=${secondaryEnv} manifest=${secondaryManifest}`,
    );
  }
  const secondary = secondaryEnv || secondaryManifest || null;
  return secondary ? [primary, secondary] : [primary];
}

export function writeRunDateManifest(opts, filePath = RUN_DATE_MANIFEST_PATH) {
  const primary = opts.primary;
  const secondary = opts.secondary || null;
  if (!isIsoDate(primary)) throw new Error("PHASE18_PRIMARY_SERVICE_DATE_REQUIRED");
  if (secondary && !isIsoDate(secondary)) throw new Error("PHASE18_SECONDARY_INVALID");
  if (!isFutureDateUtc(primary)) throw new Error(`PHASE18_RUN_DATE_NOT_FUTURE:${primary}`);
  const body = {
    phase: "18SCALE",
    PHASE18_RUN_SERVICE_DATE: primary,
    PHASE18_PRIMARY_SERVICE_DATE: primary,
    PHASE18_SECONDARY_SERVICE_DATE: secondary,
    service_dates: secondary ? [primary, secondary] : [primary],
    generated_at: new Date().toISOString(),
    source: opts.source || "write-run-date-manifest",
    workflow_run_id: opts.workflow_run_id || process.env.GITHUB_RUN_ID || null,
    engine_sha: opts.engine_sha || process.env.APP_SHA || process.env.GITHUB_SHA || null,
    project_ref: opts.project_ref || process.env.PHASE18_LOAD_REF || null,
    note: "Canonical run-date contract — no script may invent a different service date",
  };
  body.checksum = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        primary,
        secondary,
        workflow_run_id: body.workflow_run_id,
        engine_sha: body.engine_sha,
        project_ref: body.project_ref,
      }),
    )
    .digest("hex");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(body, null, 2));
  return body;
}
