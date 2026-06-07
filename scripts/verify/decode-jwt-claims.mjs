#!/usr/bin/env node
/**
 * Operator-local JWT spine claim verifier (FASE 2 / FASE 3).
 *
 * Usage (never pass token on argv — env only):
 *   LP_VERIFY_JWT=<access_token> node scripts/verify/decode-jwt-claims.mjs
 *
 * - No network, no third-party libs, no token logging.
 * - Base64url-decode JWT payload only (signature not verified here).
 * - NOT wired into CI (no real tokens in pipelines).
 */

const APP_ROLES = new Set([
  "provider_admin",
  "kitchen",
  "driver",
  "company_admin",
  "orderer",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const checks = [];

function record(name, pass, detail = "") {
  checks.push({ name, pass, detail });
}

function decodeJwtPayload(token) {
  const trimmed = String(token ?? "").trim();
  if (!trimmed) {
    throw new Error("LP_VERIFY_JWT is empty");
  }

  const parts = trimmed.split(".");
  if (parts.length !== 3) {
    throw new Error("JWT must have exactly 3 dot-separated segments");
  }

  const segment = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const pad = segment.length % 4 === 0 ? "" : "=".repeat(4 - (segment.length % 4));
  const json = Buffer.from(segment + pad, "base64").toString("utf8");
  return JSON.parse(json);
}

function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

function assertStandardClaims(payload) {
  for (const key of ["sub", "aud", "exp", "role", "email"]) {
    const present = payload[key] !== undefined && payload[key] !== null && payload[key] !== "";
    record(`standard.${key} present`, present, present ? "ok" : "missing or empty");
  }

  if (payload.exp !== undefined && payload.exp !== null) {
    const expOk = typeof payload.exp === "number" && Number.isFinite(payload.exp);
    record("standard.exp numeric", expOk, expOk ? String(payload.exp) : typeof payload.exp);
  }
}

function assertSpineClaims(payload) {
  const hasOrg = Object.prototype.hasOwnProperty.call(payload, "active_org_id");
  if (!hasOrg) {
    record("spine.active_org_id", true, "absent (allowed)");
  } else if (payload.active_org_id === null || payload.active_org_id === "") {
    record("spine.active_org_id", true, "null/empty (allowed)");
  } else {
    record(
      "spine.active_org_id uuid",
      isUuid(payload.active_org_id),
      String(payload.active_org_id),
    );
  }

  const hasRole = Object.prototype.hasOwnProperty.call(payload, "active_role");
  if (!hasRole) {
    record("spine.active_role", true, "absent (allowed)");
  } else if (payload.active_role === null || payload.active_role === "") {
    record("spine.active_role", true, "null/empty (allowed)");
  } else {
    record(
      "spine.active_role enum",
      APP_ROLES.has(payload.active_role),
      String(payload.active_role),
    );
  }

  const hasLoc = Object.prototype.hasOwnProperty.call(payload, "active_location_id");
  if (!hasLoc) {
    record("spine.active_location_id", true, "absent (allowed)");
  } else if (payload.active_location_id === null || payload.active_location_id === "") {
    record("spine.active_location_id", true, "null (allowed)");
  } else {
    record(
      "spine.active_location_id uuid",
      isUuid(payload.active_location_id),
      String(payload.active_location_id),
    );
  }

  const hasAdmin = Object.prototype.hasOwnProperty.call(payload, "is_platform_admin");
  if (!hasAdmin) {
    record("spine.is_platform_admin", false, "missing (required boolean when hook enabled)");
  } else {
    record(
      "spine.is_platform_admin boolean",
      typeof payload.is_platform_admin === "boolean",
      typeof payload.is_platform_admin,
    );
  }

  const hasMemberships = Object.prototype.hasOwnProperty.call(payload, "memberships");
  if (!hasMemberships) {
    record("spine.memberships", false, "missing (expected array from hook)");
  } else {
    const arrOk = Array.isArray(payload.memberships);
    record("spine.memberships array", arrOk, arrOk ? `length=${payload.memberships.length}` : typeof payload.memberships);
    if (arrOk) {
      payload.memberships.forEach((item, i) => {
        const orgOk = item && isUuid(item.org_id);
        const roleOk = item && APP_ROLES.has(item.role);
        record(`spine.memberships[${i}].org_id`, orgOk, item?.org_id ?? "missing");
        record(`spine.memberships[${i}].role`, roleOk, item?.role ?? "missing");
      });
    }
  }
}

function printTable() {
  const pad = Math.max(...checks.map((c) => c.name.length), 5);
  console.log("");
  console.log(`${"CHECK".padEnd(pad)}  STATUS  DETAIL`);
  console.log(`${"-".repeat(pad)}  ------  ------`);
  for (const c of checks) {
    console.log(`${c.name.padEnd(pad)}  ${c.pass ? "PASS" : "FUNN"}  ${c.detail}`);
  }
}

function main() {
  const token = process.env.LP_VERIFY_JWT;
  if (!token || !String(token).trim()) {
    console.error("FAIL: Set LP_VERIFY_JWT to a Supabase access token (env only, never argv).");
    process.exit(1);
  }

  let payload;
  try {
    payload = decodeJwtPayload(token);
  } catch (err) {
    console.error(`FAIL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  assertStandardClaims(payload);
  assertSpineClaims(payload);
  printTable();

  const failed = checks.filter((c) => !c.pass);
  if (failed.length) {
    console.error(`\nFUNN: ${failed.length} check(s) failed.`);
    process.exit(1);
  }

  console.log("\nPASS: JWT spine + standard claims verified.");
}

main();
