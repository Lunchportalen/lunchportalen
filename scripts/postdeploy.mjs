// scripts/postdeploy.mjs
/* =========================================================
   POST-DEPLOY GATE (UMBRACO PROD SMOKE)
   - No auth. No behavior changes. Pure external checks.
   - Default checks only "/" for Umbraco public site.
   - Cold-start tolerant for Azure App Service / Umbraco.
   - FAIL => exit(1) for CI/ops safety.
========================================================= */

import {
  DEFAULT_RETRIES,
  DEFAULT_RETRY_DELAY_MS,
  DEFAULT_TIMEOUT_MS,
  isTransient,
} from "./postdeploy-lib.mjs";

const BASE_URL = (process.env.POSTDEPLOY_BASE_URL || "").replace(/\/$/, "");

if (!BASE_URL) {
  console.error("FAIL: POSTDEPLOY_BASE_URL is required, e.g. https://www.lunchportalen.no");
  process.exit(1);
}

const TIMEOUT_MS = Number(process.env.POSTDEPLOY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
const RETRIES = Number(process.env.POSTDEPLOY_RETRIES || DEFAULT_RETRIES);
const RETRY_DELAY_MS = Number(process.env.POSTDEPLOY_RETRY_DELAY_MS || DEFAULT_RETRY_DELAY_MS);
const EXPECTED_TEXT = process.env.POSTDEPLOY_EXPECTED_TEXT || "";

const ROUTES = (process.env.POSTDEPLOY_ROUTES || "/")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const JSON_CHECKS_ENABLED = process.env.POSTDEPLOY_JSON_CHECKS === "1";

const JSON_ROUTES = (process.env.POSTDEPLOY_JSON_ROUTES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function now() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUrl(path) {
  return `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...opts,
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "cache-control": "no-store",
        "user-agent": "lunchportalen-postdeploy-gate/1.1",
        ...(opts.headers || {}),
      },
    });
  } finally {
    clearTimeout(id);
  }
}

async function withRetries(fn) {
  let last = null;

  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    const result = await fn(attempt);
    last = result;

    if (result.ok) {
      return result;
    }

    if (attempt < RETRIES && isTransient(result)) {
      console.log(
        `[RETRY] ${result.kind} ${result.path} attempt ${attempt}/${RETRIES} failed: ${result.detail}. Waiting ${RETRY_DELAY_MS}ms...`,
      );
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    return result;
  }

  return last;
}

async function checkHtml(path, attempt = 1) {
  const url = buildUrl(path);
  const t0 = Date.now();

  try {
    const res = await fetchWithTimeout(url, { method: "GET" });
    const ms = Date.now() - t0;
    const contentType = res.headers.get("content-type") || "";
    const body = await res.text();

    const statusOk = res.status >= 200 && res.status < 400;
    const contentOk =
      contentType.includes("text/html") ||
      contentType.includes("text/plain") ||
      contentType === "";

    const textOk = EXPECTED_TEXT ? body.includes(EXPECTED_TEXT) : true;

    return {
      kind: "HTML",
      path,
      url,
      ok: statusOk && contentOk && textOk,
      status: res.status,
      ms,
      attempt,
      detail: !statusOk
        ? `HTTP ${res.status}`
        : !contentOk
          ? `Unexpected content-type: ${contentType}`
          : !textOk
            ? `Missing EXPECTED_TEXT: ${EXPECTED_TEXT}`
            : "OK",
    };
  } catch (error) {
    const ms = Date.now() - t0;

    return {
      kind: "HTML",
      path,
      url,
      ok: false,
      status: 0,
      ms,
      attempt,
      detail:
        error?.name === "AbortError"
          ? `TIMEOUT ${TIMEOUT_MS}ms`
          : String(error?.message || error),
    };
  }
}

async function checkJson(path, attempt = 1) {
  const url = buildUrl(path);
  const t0 = Date.now();

  try {
    const res = await fetchWithTimeout(url, { method: "GET" });
    const ms = Date.now() - t0;
    const contentType = res.headers.get("content-type") || "";
    const body = await res.text();

    let json = null;

    try {
      json = body ? JSON.parse(body) : null;
    } catch {
      json = null;
    }

    const statusOk = res.status >= 200 && res.status < 400;
    const jsonOk = json !== null && typeof json === "object";

    return {
      kind: "JSON",
      path,
      url,
      ok: statusOk && jsonOk,
      status: res.status,
      ms,
      attempt,
      detail: !statusOk
        ? `HTTP ${res.status}`
        : !jsonOk
          ? `Invalid JSON (content-type: ${contentType})`
          : "OK",
      sample: jsonOk ? json : undefined,
    };
  } catch (error) {
    const ms = Date.now() - t0;

    return {
      kind: "JSON",
      path,
      url,
      ok: false,
      status: 0,
      ms,
      attempt,
      detail:
        error?.name === "AbortError"
          ? `TIMEOUT ${TIMEOUT_MS}ms`
          : String(error?.message || error),
    };
  }
}

function printResult(result) {
  const badge = result.ok ? "PASS" : "FAIL";

  console.log(
    `[${badge}] ${result.kind} ${result.path} (${result.status || "-"}) ${result.ms}ms attempt ${result.attempt}/${RETRIES} — ${result.detail}`,
  );

  if (!result.ok && result.sample) {
    const sample = JSON.stringify(result.sample);
    console.log(`       sample: ${sample.slice(0, 200)}${sample.length > 200 ? "…" : ""}`);
  }
}

async function main() {
  const maxWaitMs = (RETRIES - 1) * RETRY_DELAY_MS;
  console.log(`\nPOST-DEPLOY GATE @ ${now()}`);
  console.log(`Base: ${BASE_URL}`);
  console.log(`Timeout: ${TIMEOUT_MS}ms`);
  console.log(`Retries: ${RETRIES}`);
  console.log(`Retry delay: ${RETRY_DELAY_MS}ms (max inter-attempt wait ≈ ${maxWaitMs}ms)`);
  console.log(`HTML routes: ${ROUTES.join(", ")}`);
  console.log(`JSON routes: ${JSON_CHECKS_ENABLED ? JSON_ROUTES.join(", ") || "(none)" : "(disabled)"}`);

  if (EXPECTED_TEXT) {
    console.log(`Expected text: "${EXPECTED_TEXT}"`);
  }

  console.log("");

  const results = [];

  for (const route of ROUTES) {
    results.push(await withRetries((attempt) => checkHtml(route, attempt)));
  }

  if (JSON_CHECKS_ENABLED) {
    for (const route of JSON_ROUTES) {
      results.push(await withRetries((attempt) => checkJson(route, attempt)));
    }
  }

  console.log("");
  results.forEach(printResult);

  const failed = results.filter((result) => !result.ok);

  console.log("");

  if (failed.length > 0) {
    console.error(`POST-DEPLOY RESULT: FAIL (${failed.length} failed)`);
    process.exit(1);
  }

  console.log("POST-DEPLOY RESULT: PASS");
  process.exit(0);
}

main().catch((error) => {
  console.error("POST-DEPLOY RESULT: FAIL");
  console.error(error);
  process.exit(1);
});
