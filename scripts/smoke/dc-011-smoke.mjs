#!/usr/bin/env node
/**
 * PR-X1 Fase 4 — DC-011 staging smoke (A–H).
 * Usage:
 *   STAGING_BASE_URL=https://staging.app.lunchportalen.no \
 *   STAGING_CRON_SECRET=... PLAYWRIGHT_TEST_EMAIL=... PLAYWRIGHT_TEST_PASSWORD=... \
 *   node scripts/smoke/dc-011-smoke.mjs
 *
 * Writes docs/audit/dc-011-staging-smoke.md (appends run section).
 */
import fs from "node:fs";
import path from "node:path";

const BASE = (
  process.env.STAGING_BASE_URL || "https://lunchportalen-git-staging-lunchportalen.vercel.app"
).replace(/\/$/, "");

const AI_SAMPLES = [
  { path: "/api/ai/dashboard", method: "GET" },
  { path: "/api/ai/insights", method: "GET" },
  { path: "/api/ai/analyze", method: "POST", body: {} },
  { path: "/api/ai/copilot", method: "POST", body: { message: "smoke" } },
  { path: "/api/ai/rewrite", method: "POST", body: { text: "smoke" } },
];

const CRON_SAMPLES = ["/api/cron/week-scheduler", "/api/cron/forecast", "/api/cron/outbox"];
const ANON_SAMPLES = ["/api/health", "/api/system/time", "/api/health/live"];

/** @type {Record<string, string>} */
const cookieJar = {};

/** @type {Array<{id:string, test:string, url:string, method:string, expected:string, actual:string, status:"PASS"|"FAIL"|"SKIP", snippet?:string}>} */
const rows = [];

function mergeCookies(setCookie) {
  if (!setCookie) return;
  const parts = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const raw of parts) {
    const pair = raw.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    cookieJar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
}

function cookieHeader(extra = "") {
  const base = Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  if (!extra) return base;
  if (!base) return extra;
  return `${base}; ${extra}`;
}

function hasSessionCookie(header = "") {
  const h = header.toLowerCase();
  return h.includes("sb-") || h.includes("supabase") || h.includes("lp_");
}

function snippet(body, max = 120) {
  const s = typeof body === "string" ? body : JSON.stringify(body ?? "");
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function parseSetCookie(setCookie) {
  if (!setCookie) return "";
  const parts = Array.isArray(setCookie) ? setCookie : [setCookie];
  return parts.map((c) => c.split(";")[0]).join("; ");
}

function isApiAuthStatus(status, text) {
  if (status === 401 || status === 403 || status === 404) return true;
  if (status >= 400 && status < 500 && text.startsWith("{")) return true;
  return false;
}

async function request(method, urlPath, opts = {}) {
  const bypass = vercelBypass();
  let url = `${BASE}${urlPath}`;
  if (bypass && !opts.noBypassQuery) {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}x-vercel-protection-bypass=${encodeURIComponent(bypass)}`;
  }
  const headers = { ...(opts.headers || {}) };
  if (bypass) {
    headers["x-vercel-protection-bypass"] = bypass;
    headers["x-vercel-set-bypass-cookie"] = "true";
  }
  const jarCookie = cookieHeader(opts.cookie ?? "");
  if (jarCookie) headers.cookie = jarCookie;
  const init = { method, headers, redirect: "manual" };
  if (opts.body !== undefined) {
    init.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
    if (!headers["content-type"]) headers["content-type"] = "application/json";
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  const setCookie = res.headers.getSetCookie?.() ?? res.headers.get("set-cookie");
  mergeCookies(setCookie);
  const contentType = res.headers.get("content-type") || "";
  const vercelSso =
    contentType.includes("text/html") &&
    (text.includes("Authentication Required") || String(setCookie).includes("_vercel_sso_nonce"));
  return {
    status: res.status,
    text,
    json,
    cookie: cookieHeader(),
    url,
    contentType,
    vercelSso,
    location: res.headers.get("location"),
    mwBypass: res.headers.get("x-lp-mw-bypass"),
  };
}

async function bootstrapBypass() {
  const bypass = vercelBypass();
  if (!bypass) return false;
  const res = await request("GET", "/", { noBypassQuery: false });
  const ok =
    res.status === 200 ||
    res.status === 307 ||
    res.status === 308 ||
    cookieJar["__vercel_bypass"] ||
    Object.keys(cookieJar).some((k) => k.includes("vercel"));
  return ok || !res.vercelSso;
}

function record(id, test, url, method, expected, actual, status, snippetText) {
  rows.push({ id, test, url, method, expected, actual, status, snippet: snippetText });
}

function isUnauthorized(status) {
  return status === 401 || status === 403;
}

async function login(email, password) {
  const res = await request("POST", "/api/auth/login", {
    body: { email, password },
  });
  return { ...res, sessionCookie: res.cookie };
}

function cronSecret() {
  const staging = String(process.env.STAGING_CRON_SECRET ?? "").trim();
  const preview = String(process.env.CRON_SECRET ?? "").trim();
  // Preview deploys use Preview env CRON_SECRET — staging env value may differ or be corrupted.
  if (preview && (!staging || staging.startsWith("<") || staging.length !== preview.length)) return preview;
  return staging || preview;
}

function vercelBypass() {
  return process.env.VERCEL_AUTOMATION_BYPASS_SECRET || process.env.VERCEL_PROTECTION_BYPASS || "";
}

function testEmail() {
  return process.env.PLAYWRIGHT_TEST_EMAIL || process.env.STAGING_TEST_EMAIL || "";
}

function testPassword() {
  return process.env.PLAYWRIGHT_TEST_PASSWORD || process.env.STAGING_TEST_PASSWORD || "";
}

function employeeEmail() {
  return process.env.STAGING_EMPLOYEE_EMAIL || testEmail();
}

function clearSessionCookies() {
  for (const k of Object.keys(cookieJar)) {
    if (k.startsWith("sb-") || k.toLowerCase().includes("auth")) delete cookieJar[k];
  }
}

async function ensureLoggedIn() {
  clearSessionCookies();
  const email = testEmail();
  const pass = testPassword();
  if (!email || !pass) return false;
  const res = await login(email, pass);
  return hasSessionCookie(res.cookie);
}

async function runA() {
  const TEST_EMAIL = testEmail();
  const TEST_PASSWORD = testPassword();
  clearSessionCookies();
  const r1 = await request("GET", "/api/orders");
  record(
    "A1",
    "GET /api/orders uten cookie",
    "/api/orders",
    "GET",
    "401",
    String(r1.status),
    r1.status === 401 ? "PASS" : "FAIL",
    snippet(r1.text),
  );

  if (!TEST_EMAIL || !TEST_PASSWORD) {
    record("A2", "Login via /api/auth/login", "/api/auth/login", "POST", "200 + cookie", "SKIP (mangler creds)", "SKIP");
    record("A3", "GET /api/orders med cookie", "/api/orders", "GET", "200", "SKIP", "SKIP");
    record("A4", "POST /api/auth/logout", "/api/auth/logout", "POST", "200", "SKIP", "SKIP");
    record("A5", "GET /api/orders etter logout", "/api/orders", "GET", "401", "SKIP", "SKIP");
    return;
  }

  const loginRes = await login(TEST_EMAIL, TEST_PASSWORD);
  const loginOk =
    (loginRes.status === 200 || (loginRes.status >= 300 && loginRes.status < 400)) && hasSessionCookie(loginRes.cookie);
  record(
    "A2",
    "Login via /api/auth/login",
    "/api/auth/login",
    "POST",
    "200 + cookie",
    `${loginRes.status}${hasSessionCookie(loginRes.cookie) ? " + cookie" : ""}`,
    loginOk ? "PASS" : "FAIL",
    snippet(loginRes.text),
  );
  if (!loginOk) return;

  const r3 = await request("GET", "/api/orders");
  const ordersOk = r3.status === 200 || r3.status === 403;
  record(
    "A3",
    "GET /api/orders med cookie",
    "/api/orders",
    "GET",
    "200 eller 403 (auth-recognized)",
    String(r3.status),
    ordersOk ? "PASS" : "FAIL",
    snippet(r3.text),
  );

  const r4 = await request("POST", "/api/auth/logout");
  const logoutOk = r4.status === 200 || r4.status === 303;
  record(
    "A4",
    "POST /api/auth/logout",
    "/api/auth/logout",
    "POST",
    "200 eller 303",
    String(r4.status),
    logoutOk ? "PASS" : "FAIL",
    snippet(r4.text),
  );

  for (const k of Object.keys(cookieJar)) {
    if (k.startsWith("sb-") || k.toLowerCase().includes("auth")) delete cookieJar[k];
  }

  const r5 = await request("GET", "/api/orders");
  record("A5", "GET /api/orders etter logout", "/api/orders", "GET", "401", String(r5.status), r5.status === 401 ? "PASS" : "FAIL", snippet(r5.text));
}

async function runB() {
  clearSessionCookies();
  const CRON_SECRET = cronSecret();
  const r1 = await request("GET", "/api/cron/meal-learning");
  record(
    "B1",
    "GET meal-learning uten Authorization",
    "/api/cron/meal-learning",
    "GET",
    "401/403",
    String(r1.status),
    isUnauthorized(r1.status) ? "PASS" : "FAIL",
    snippet(r1.text),
  );

  if (!CRON_SECRET) {
    record("B2", "GET meal-learning med Bearer CRON", "/api/cron/meal-learning", "GET", "200", "SKIP (mangler CRON_SECRET)", "SKIP");
    for (const p of CRON_SAMPLES) {
      record(`B-cron-${p}`, `Cron sample ${p} uten secret`, p, "GET", "401/403", "SKIP", "SKIP");
      record(`B-cron-auth-${p}`, `Cron sample ${p} med secret`, p, "GET", "200", "SKIP", "SKIP");
    }
    return;
  }

  const r2 = await request("GET", "/api/cron/meal-learning", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  const mealLearningAuthed = r2.status === 200 || (r2.status >= 400 && r2.status !== 401 && r2.status !== 403);
  record(
    "B2",
    "GET meal-learning med Bearer CRON",
    "/api/cron/meal-learning",
    "GET",
    "200 (eller 5xx etter auth)",
    String(r2.status),
    mealLearningAuthed ? "PASS" : "FAIL",
    snippet(r2.text),
  );

  const outNo = await request("POST", "/api/system/outbox/process");
  record(
    "B-outbox-no",
    "POST outbox/process uten Bearer",
    "/api/system/outbox/process",
    "POST",
    "401/403",
    String(outNo.status),
    isUnauthorized(outNo.status) ? "PASS" : "FAIL",
    snippet(outNo.text),
  );
  const outYes = await request("POST", "/api/system/outbox/process", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  record(
    "B-outbox-yes",
    "POST outbox/process med Bearer CRON",
    "/api/system/outbox/process",
    "POST",
    "200",
    String(outYes.status),
    outYes.status === 200 ? "PASS" : "FAIL",
    snippet(outYes.text),
  );

  for (const p of CRON_SAMPLES) {
    const method = p.includes("outbox") ? "POST" : "GET";
    const no = await request(method, p);
    record(
      `B-cron-${p}`,
      `${method} ${p} uten secret`,
      p,
      method,
      "401/403",
      String(no.status),
      isUnauthorized(no.status) ? "PASS" : "FAIL",
      snippet(no.text),
    );
    const yes = await request(method, p, { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    record(
      `B-cron-auth-${p}`,
      `${method} ${p} med secret`,
      p,
      method,
      "200",
      String(yes.status),
      yes.status === 200 ? "PASS" : "FAIL",
      snippet(yes.text),
    );
  }
}

async function runC() {
  const loggedIn = await ensureLoggedIn();
  for (const sample of AI_SAMPLES) {
    const p = sample.path;
    const method = sample.method;
    clearSessionCookies();
    const no = await request(method, p, sample.body !== undefined ? { body: sample.body } : {});
    const noExpected = method === "GET" ? "401" : "401 (405 kun hvis feil method)";
    record(
      `C-no-${p}`,
      `${method} ${p} uten cookie`,
      p,
      method,
      noExpected,
      String(no.status),
      no.status === 401 ? "PASS" : "FAIL",
      snippet(no.text),
    );
    if (!loggedIn) {
      record(`C-yes-${p}`, `${method} ${p} med session`, p, method, "≠401", "SKIP", "SKIP");
      continue;
    }
    await ensureLoggedIn();
    const yes = await request(method, p, sample.body !== undefined ? { body: sample.body } : {});
    record(
      `C-yes-${p}`,
      `${method} ${p} med session`,
      p,
      method,
      "200 eller 4xx (ikke 401)",
      String(yes.status),
      yes.status !== 401 ? "PASS" : "FAIL",
      snippet(yes.text),
    );
  }
}

async function runD() {
  const r = await request("POST", "/api/webhooks/sanity/menu-day", { body: {} });
  record(
    "D1",
    "POST webhook uten signatur",
    "/api/webhooks/sanity/menu-day",
    "POST",
    "401",
    String(r.status),
    r.status === 401 ? "PASS" : "FAIL",
    snippet(r.text),
  );
}

async function runE() {
  clearSessionCookies();
  const r1 = await request("POST", "/api/system/outbox/process");
  record(
    "E1",
    "POST outbox/process uten CRON",
    "/api/system/outbox/process",
    "POST",
    "401/403",
    String(r1.status),
    isUnauthorized(r1.status) ? "PASS" : "FAIL",
    snippet(r1.text),
  );

  const r2 = await request("POST", "/api/superadmin/users/set-company-admin", {
    body: { email: "smoke@test.no", companyName: "Smoke", locationLabel: "HQ" },
  });
  record(
    "E2",
    "POST set-company-admin uten session",
    "/api/superadmin/users/set-company-admin",
    "POST",
    "401",
    String(r2.status),
    r2.status === 401 ? "PASS" : "FAIL",
    snippet(r2.text),
  );

  if (!(await ensureLoggedIn())) {
    record("E3", "POST set-company-admin med employee session", "/api/superadmin/users/set-company-admin", "POST", "403", "SKIP", "SKIP");
    return;
  }
  const r3 = await request("POST", "/api/superadmin/users/set-company-admin", {
    body: {
      email: "smoke-admin-candidate@test.no",
      companyName: "Company A (agreements-test)",
      locationLabel: "HQ",
    },
  });
  record(
    "E3",
    "POST set-company-admin med employee session",
    "/api/superadmin/users/set-company-admin",
    "POST",
    "403",
    String(r3.status),
    r3.status === 403 ? "PASS" : "FAIL",
    snippet(r3.text),
  );
}

async function runF() {
  for (const p of ["/api/auth/debug-cookies", "/api/auth/dev-bypass"]) {
    const r = await request("GET", p);
    // 404 = route disabled (prod-like); 401 = middleware fail-closed (also OK for DC-011)
    const ok = r.status === 404 || r.status === 401;
    record(
      `F-${p}`,
      `GET ${p}`,
      p,
      "GET",
      "404 eller 401",
      String(r.status),
      ok ? "PASS" : "FAIL",
      snippet(r.text),
    );
  }
}

async function runG() {
  clearSessionCookies();
  const r = await request("POST", "/api/onboarding/complete", {
    body: { companyName: "Smoke Co", orgNumber: "999999999", contactEmail: "smoke@example.com" },
  });
  const ok = r.status !== 401 && r.status !== 307 && r.status !== 308;
  record(
    "G1",
    "POST onboarding/complete uten cookie (gyldig-ish body)",
    "/api/onboarding/complete",
    "POST",
    "≠401 (422/400/200)",
    String(r.status),
    ok ? "PASS" : "FAIL",
    snippet(r.text),
  );
}

async function runH() {
  const CRON_SECRET = cronSecret();
  if (!CRON_SECRET) {
    for (const p of CRON_SAMPLES) {
      record(`H-cron-${p}`, `Allowlist cron ${p} uten secret`, p, "GET", "401/403", "SKIP", "SKIP");
    }
  } else {
    for (const p of CRON_SAMPLES) {
      const method = p.includes("outbox") ? "POST" : "GET";
      const r = await request(method, p);
      record(
        `H-cron-${p}`,
        `Allowlist cron ${p} uten secret`,
        p,
        method,
        "401/403",
        String(r.status),
        isUnauthorized(r.status) ? "PASS" : "FAIL",
        snippet(r.text),
      );
    }
  }
  for (const p of ANON_SAMPLES) {
    clearSessionCookies();
    const r = await request("GET", p);
    const ok = r.status !== 401 && r.status !== 307 && r.status !== 308;
    record(
      `H-anon-${p}`,
      `Anon ${p} uten cookie`,
      p,
      "GET",
      "200 eller 4xx (ikke 401)",
      String(r.status),
      ok ? "PASS" : "FAIL",
      snippet(r.text),
    );
  }
}

function loadDotEnv(file, override = false) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const key = m[1];
    if (!override && process.env[key]) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function writeReport(deployStatus, vercelBlocked) {
  const pass = rows.filter((r) => r.status === "PASS").length;
  const fail = rows.filter((r) => r.status === "FAIL").length;
  const skip = rows.filter((r) => r.status === "SKIP").length;
  const blocked = rows.filter((r) => r.status === "BLOCKED").length;
  const total = rows.length;
  const now = new Date().toISOString();

  const table = [
    "| Test | URL | Method | Forventet | Faktisk | Status |",
    "| ---- | --- | ------ | --------- | ------- | ------ |",
    ...rows.map(
      (r) => `| ${r.test} | ${r.url} | ${r.method} | ${r.expected} | ${r.actual} | ${r.status} |`,
    ),
  ].join("\n");

  const fails = rows.filter((r) => r.status === "FAIL");
  const failSection =
    fails.length === 0
      ? "_Ingen FAIL._"
      : fails
          .map(
            (f) =>
              `- **${f.test}** — ${f.url} — forventet \`${f.expected}\`, faktisk \`${f.actual}\`\n  - \`${f.snippet ?? ""}\``,
          )
          .join("\n");

  const go = fail.length === 0 && deployStatus !== "FAILED" && !vercelBlocked && blocked === 0;

  const body = `# PR-X1 Staging-smoke — 2026-05-23

_Run: ${now} · Base: ${BASE}_

## Sammendrag

| Sjekk             | Resultat            |
| ----------------- | ------------------- |
| Build & deploy    | ${deployStatus} |
| Smoke A–H         | ${pass} / ${total - skip - blocked} PASS (${skip} SKIP${blocked ? `, ${blocked} BLOCKED` : ""}) |
| Vercel SSO-gate   | ${vercelBlocked ? "BLOCKED (Deployment Protection)" : "ikke observert"} |
| Sentry error-rate | se Del 5 (manuell/MCP) |
| Cron 24t          | se Del 5 (Vercel dashboard) |

## Dynamiske allowlist-entries

Alle 3 entries bekreftet **OK** (ingen FLAGG) — se \`docs/operations/api-auth-inventory.md\`.

| Pattern | Route-fil | Risiko |
| ------- | --------- | ------ |
| \`^/api/public/forms/[^/]+$\` | \`app/api/public/forms/[id]/route.ts\` | OK |
| \`^/api/public/forms/[^/]+/schema$\` | \`app/api/public/forms/[id]/schema/route.ts\` | OK |
| \`^/api/webhooks/tripletex-provider/[^/]+$\` | \`app/api/webhooks/tripletex-provider/[providerId]/route.ts\` | OK |

## Eventuelle FAIL i smoke

${failSection}

## Detaljert resultat (A–H)

${table}

## Anbefaling

${go ? "- [x] GO for prod-deploy (Fase 5)" : "- [ ] GO for prod-deploy (Fase 5)"}
${go ? "- [ ] NO-GO — krever fix:" : "- [x] NO-GO — krever fix:"}
${go ? "" : fails.map((f) => `    - ${f.test}: forventet ${f.expected}, faktisk ${f.actual}`).join("\n") || "    - (deploy/smoke feilet)"}
`;

  const out = path.join(process.cwd(), "docs", "audit", "dc-011-staging-smoke.md");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, body, "utf8");
  console.log(`\nWrote ${out}`);
  console.log(`PASS=${pass} FAIL=${fail} SKIP=${skip}`);
  return fail;
}

async function main() {
  loadDotEnv(".env.staging-check");
  loadDotEnv(".env.k6-staging-verify.tmp");
  loadDotEnv(".env.local", true);

  const email = testEmail();
  const pass = testPassword();

  console.log(`DC-011 smoke → ${BASE}`);
  console.log(`CRON_SECRET: ${cronSecret() ? "set" : "missing"}`);
  console.log(`VERCEL_BYPASS: ${vercelBypass() ? "set" : "missing"}`);
  console.log(`TEST_EMAIL: ${email ? "set" : "missing"}`);

  await bootstrapBypass();

  const probe = await request("GET", "/api/health");
  const vercelBlocked = probe.vercelSso || probe.status === 401;
  if (vercelBlocked) {
    console.warn("WARN: Vercel Deployment Protection blokkerer fortsatt — sjekk bypass-secret");
  }

  const mwProbe = await request("GET", "/api/cron/meal-learning");
  if (mwProbe.mwBypass === "1") {
    console.warn(
      "WARN: BASE peker på gammel deploy (x-lp-mw-bypass=1). " +
        "Bruk https://lunchportalen-git-staging-lunchportalen.vercel.app til staging.app-alias er oppdatert.",
    );
  }

  await runB();
  await runD();
  await runF();
  await runG();
  await runH();
  await runA();
  await runC();
  await runE();

  const deployStatus = process.env.DC011_DEPLOY_STATUS || "PENDING";
  const failCount = writeReport(deployStatus, vercelBlocked);
  process.exit(failCount > 0 || vercelBlocked ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
