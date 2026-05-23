#!/usr/bin/env node
/** DC-026 staging/prod smoke — Flow 1 gated, Flow 2 normal */
import { readFileSync } from "node:fs";

const BASE =
  process.env.SMOKE_BASE_URL ||
  "https://lunchportalen-git-staging-lunchportalen.vercel.app";

function loadEnvFile(key) {
  try {
    const raw = readFileSync(".env.preview-cron.tmp", "utf8");
    const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
    if (m) return m[1].trim().replace(/^"|"$/g, "");
  } catch {
    /* ignore */
  }
  try {
    const raw = readFileSync(".env.local", "utf8");
    const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
    if (m) return m[1].trim().replace(/^"|"$/g, "");
  } catch {
    /* ignore */
  }
  return "";
}

function loadCronSecret() {
  return (
    process.env.CRON_SECRET ||
    process.env.STAGING_CRON_SECRET ||
    loadEnvFile("CRON_SECRET") ||
    loadEnvFile("STAGING_CRON_SECRET") ||
    ""
  ).trim();
}

function loadBypass() {
  return (
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET ||
    process.env.VERCEL_PROTECTION_BYPASS ||
    loadEnvFile("VERCEL_AUTOMATION_BYPASS_SECRET") ||
    ""
  ).trim();
}

async function req(method, path, opts = {}) {
  const bypass = loadBypass();
  let url = `${BASE.replace(/\/+$/, "")}${path}`;
  if (bypass && !opts.noBypassQuery) {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}x-vercel-protection-bypass=${encodeURIComponent(bypass)}`;
  }
  const res = await fetch(url, {
    method,
    headers: {
      accept: "application/json",
      ...(bypass
        ? {
            "x-vercel-protection-bypass": bypass,
            "x-vercel-set-bypass-cookie": "true",
          }
        : {}),
      ...(opts.headers || {}),
    },
    redirect: "manual",
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

const cron = loadCronSecret();
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`);
}

async function main() {
  console.log(`BASE=${BASE}`);
  console.log(`CRON_SECRET=${cron ? `set(len=${cron.length})` : "MISSING"}`);

  if (!cron) {
    console.error("CRON_SECRET required");
    process.exit(1);
  }

  // Wait for deploy if needed
  for (let i = 0; i < 4; i++) {
    const ping = await req("GET", "/api/health/summary");
    if (ping.status === 200 || ping.status === 503) break;
    console.log(`waiting deploy... (${i + 1}/4)`);
    await new Promise((r) => setTimeout(r, 10000));
  }

  const saas = await req("POST", "/api/cron/tripletex-saas-monthly", {
    headers: { authorization: `Bearer ${cron}` },
  });
  record(
    "Flow1 cron saas-monthly",
    saas.status === 200 && saas.body?.data?.skipped === "FLOW1_DISABLED",
    `status=${saas.status} skipped=${saas.body?.data?.skipped ?? saas.body?.skipped ?? "?"}`,
  );

  const outbox = await req("POST", "/api/cron/tripletex-outbox", {
    headers: { authorization: `Bearer ${cron}` },
  });
  const flow1Skipped =
    outbox.body?.data?.invoiceReady?.skipped === "FLOW1_DISABLED" ||
    outbox.body?.data?.saasInvoiceCreateLp?.skipped === "FLOW1_DISABLED";
  record(
    "Flow1 cron tripletex-outbox (mixed)",
    outbox.status === 200 && flow1Skipped,
    `status=${outbox.status} invoiceReady.skipped=${outbox.body?.data?.invoiceReady?.skipped ?? "?"}`,
  );

  const health = await req("GET", "/api/cron/tripletex-connection-health-daily", {
    headers: { authorization: `Bearer ${cron}` },
  });
  const flow2Ok =
    health.status === 200 &&
    health.body?.ok === true &&
    health.body?.data?.skipped !== "FLOW1_DISABLED";
  record(
    "Flow2 cron connection-health",
    flow2Ok,
    `status=${health.status} ok=${health.body?.ok} skipped=${health.body?.data?.skipped ?? health.body?.skipped ?? "none"}`,
  );

  const api = await req("GET", "/api/tripletex/prod-verify");
  record(
    "Flow1 API prod-verify (unauth)",
    api.status === 401 || api.status === 503,
    `status=${api.status} error=${api.body?.error ?? api.body?.code ?? "?"}`,
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
