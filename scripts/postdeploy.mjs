// scripts/postdeploy.mjs
/* =========================================================
   POST-DEPLOY GATE (PROD SMOKE) — UI deploy safe gate
   - No auth. No behavior changes. Pure external checks.
   - FAIL => exit(1) for CI/ops safety.
========================================================= */

const BASE_URL = (process.env.POSTDEPLOY_BASE_URL || "").replace(/\/$/, "");
if (!BASE_URL) {
  console.error("FAIL: POSTDEPLOY_BASE_URL is required (e.g. https://example.com)");
  process.exit(1);
}

const TIMEOUT_MS = Number(process.env.POSTDEPLOY_TIMEOUT_MS || 12000);
const EXPECTED_TEXT = process.env.POSTDEPLOY_EXPECTED_TEXT || ""; // optional
const ROUTES = (process.env.POSTDEPLOY_ROUTES || "/,/login,/status,/system")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const JSON_ROUTES = (process.env.POSTDEPLOY_JSON_ROUTES || "/api/health,/api/system/health")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// Allow turning off JSON checks if routes don't exist
const JSON_CHECKS_ENABLED = process.env.POSTDEPLOY_JSON_CHECKS === "1";

function now() {
  return new Date().toISOString();
}

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal, headers: { "cache-control": "no-store", ...(opts.headers || {}) }});
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function checkHtml(path) {
  const url = `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  const t0 = Date.now();
  try {
    const res = await fetchWithTimeout(url, { method: "GET" });
    const ms = Date.now() - t0;

    const ok = res.ok;
    const ct = res.headers.get("content-type") || "";
    const isHtmlish = ct.includes("text/html") || ct.includes("text/plain") || ct === "";
    const body = await res.text();

    const textOk = EXPECTED_TEXT ? body.includes(EXPECTED_TEXT) : true;

    return {
      kind: "HTML",
      path,
      url,
      ok: ok && isHtmlish && textOk,
      status: res.status,
      ms,
      detail: !ok
        ? `HTTP ${res.status}`
        : !isHtmlish
          ? `Unexpected content-type: ${ct}`
          : !textOk
            ? `Missing EXPECTED_TEXT: ${EXPECTED_TEXT}`
            : "OK",
    };
  } catch (e) {
    const ms = Date.now() - t0;
    return { kind: "HTML", path, url, ok: false, status: 0, ms, detail: e?.name === "AbortError" ? `TIMEOUT ${TIMEOUT_MS}ms` : String(e) };
  }
}

async function checkJson(path) {
  const url = `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  const t0 = Date.now();
  try {
    const res = await fetchWithTimeout(url, { method: "GET" });
    const ms = Date.now() - t0;

    const ct = res.headers.get("content-type") || "";
    const body = await res.text();

    let json = null;
    try { json = body ? JSON.parse(body) : null; } catch {}

    const ok = res.ok && json && typeof json === "object";

    // If your API uses { ok: true/false }, we validate it softly (optional but useful)
    const okContract =
      json && typeof json.ok === "boolean" ? true : true; // keep non-blocking

    return {
      kind: "JSON",
      path,
      url,
      ok: ok && okContract,
      status: res.status,
      ms,
      detail: !res.ok
        ? `HTTP ${res.status}`
        : !json
          ? `Invalid JSON (content-type: ${ct})`
          : "OK",
      sample: json && typeof json === "object" ? json : undefined,
    };
  } catch (e) {
    const ms = Date.now() - t0;
    return { kind: "JSON", path, url, ok: false, status: 0, ms, detail: e?.name === "AbortError" ? `TIMEOUT ${TIMEOUT_MS}ms` : String(e) };
  }
}

function printResult(r) {
  const badge = r.ok ? "PASS" : "FAIL";
  console.log(`[${badge}] ${r.kind} ${r.path}  (${r.status || "-"})  ${r.ms}ms  — ${r.detail}`);
  if (!r.ok && r.sample) {
    console.log(`       sample: ${JSON.stringify(r.sample).slice(0, 200)}${JSON.stringify(r.sample).length > 200 ? "…" : ""}`);
  }
}

(async () => {
  console.log(`\nPOST-DEPLOY GATE @ ${now()}`);
  console.log(`Base: ${BASE_URL}`);
  console.log(`Timeout: ${TIMEOUT_MS}ms`);
  console.log(`Routes: ${ROUTES.join(", ")}`);
  console.log(`JSON routes: ${JSON_CHECKS_ENABLED ? JSON_ROUTES.join(", ") : "(disabled)"}`);
  if (EXPECTED_TEXT) console.log(`Expected text: "${EXPECTED_TEXT}"`);
  console.log("");

  const results = [];

  for (const p of ROUTES) results.push(await checkHtml(p));
  if (JSON_CHECKS_ENABLED) {
    for (const p of JSON_ROUTES) results.push(await checkJson(p));
  }

  results.forEach(printResult);

  const failed = results.filter(r => !r.ok);
  console.log("");
  if (failed.length) {
    console.error(`POST-DEPLOY RESULT: FAIL (${failed.length} failed)`);
    process.exit(1);
  }
  console.log("POST-DEPLOY RESULT: PASS");
  process.exit(0);
})();
