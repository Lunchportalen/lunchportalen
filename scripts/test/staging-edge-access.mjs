#!/usr/bin/env node
/**
 * Tracked staging edge access — Vercel deployment protection only.
 * Does NOT grant app session, role, or cron authorization.
 */
import fs from "node:fs";

export const STAGING_HOSTS = new Set([
  "staging.app.lunchportalen.no",
  "lunchportalen-env-staging-lunchportalen.vercel.app",
]);

export const STAGING_HOST_SUFFIX = "-lunchportalen.vercel.app";

export const PRODUCTION_HOSTS = new Set([
  "app.lunchportalen.no",
  "lunchportalen.no",
  "www.lunchportalen.no",
]);

const cookieJars = new Map();

export function loadEnvFile(file = ".env.local") {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

export function isProductionHost(hostname) {
  const host = String(hostname ?? "").toLowerCase();
  return PRODUCTION_HOSTS.has(host) || host === "lunchportalen.no";
}

export function isAllowedStagingHost(hostname) {
  const host = String(hostname ?? "").toLowerCase();
  if (isProductionHost(host)) return false;
  return (
    STAGING_HOSTS.has(host) ||
    (host.endsWith(STAGING_HOST_SUFFIX) && !host.includes("production"))
  );
}

export function assertStagingTarget(baseUrl) {
  const host = new URL(baseUrl).hostname.toLowerCase();
  if (isProductionHost(host)) {
    throw new Error(`FAIL-CLOSED: production host blocked (${host})`);
  }
  if (!isAllowedStagingHost(host)) {
    throw new Error(`FAIL-CLOSED: host not in staging allowlist (${host})`);
  }
}

export function loadStagingBypassSecret(env = { ...loadEnvFile(), ...process.env }) {
  return String(env.VERCEL_AUTOMATION_BYPASS_SECRET ?? env.VERCEL_PROTECTION_BYPASS ?? "").trim();
}

export function maskSecret(value) {
  const v = String(value ?? "");
  if (!v) return "(missing)";
  if (v.length <= 8) return "***";
  return `${v.slice(0, 4)}...${v.slice(-4)} (len=${v.length})`;
}

export function maskHeaders(headers = {}) {
  const out = { ...headers };
  for (const key of Object.keys(out)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("authorization") ||
      lower.includes("cookie") ||
      lower.includes("bypass") ||
      lower.includes("cron") ||
      lower.includes("secret")
    ) {
      out[key] = maskSecret(out[key]);
    }
  }
  return out;
}

export function resolveStagingUrl(baseUrl, pathOrUrl) {
  if (!baseUrl || typeof baseUrl !== "string") {
    throw new Error("FAIL: baseUrl required for relative staging path");
  }
  assertStagingTarget(baseUrl);
  const raw = String(pathOrUrl ?? "");
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    assertStagingTarget(raw);
    return raw;
  }
  const origin = String(baseUrl).replace(/\/$/, "");
  const pathPart = raw.startsWith("/") ? raw : `/${raw}`;
  return `${origin}${pathPart}`;
}

export function resolveLocation(currentUrl, locationHeader) {
  if (!locationHeader) return null;
  const current = new URL(currentUrl);
  const next = new URL(locationHeader, current);
  assertStagingTarget(next.href);
  if (next.origin !== current.origin) {
    throw new Error(`FAIL-CLOSED: cross-origin redirect blocked (${next.origin})`);
  }
  return next.href;
}

export function appendBypassQuery(url, bypass) {
  if (!bypass) return url;
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=${encodeURIComponent(bypass)}`;
}

export function stagingEdgeHeaders(extra = {}, env, jarCookie = "") {
  const bypass = loadStagingBypassSecret(env);
  if (!bypass) {
    throw new Error("FAIL: VERCEL_AUTOMATION_BYPASS_SECRET missing for staging edge access");
  }
  const { cookie: extraCookie, ...rest } = extra;
  const mergedCookie = [jarCookie, extraCookie].filter(Boolean).join("; ");
  return {
    accept: "application/json",
    "x-vercel-protection-bypass": bypass,
    "x-vercel-set-bypass-cookie": "true",
    ...(mergedCookie ? { cookie: mergedCookie } : {}),
    ...rest,
  };
}

function cookieHeaderFor(origin) {
  const host = new URL(origin).hostname;
  return cookieJars.get(host) || "";
}

function absorbCookies(origin, res) {
  const host = new URL(origin).hostname;
  const setCookies = res.headers.getSetCookie?.() ?? [];
  if (!setCookies.length) return;
  const parts = cookieHeaderFor(origin) ? cookieHeaderFor(origin).split("; ").filter(Boolean) : [];
  for (const c of setCookies) {
    const kv = c.split(";")[0];
    const name = kv.split("=")[0];
    const idx = parts.findIndex((p) => p.startsWith(`${name}=`));
    if (idx >= 0) parts[idx] = kv;
    else parts.push(kv);
  }
  cookieJars.set(host, parts.join("; "));
}

export function resetCookieJars() {
  cookieJars.clear();
}

export async function stagingFetch(
  baseUrl,
  path,
  init = {},
  env = { ...loadEnvFile(), ...process.env },
  depth = 0,
) {
  if (depth > 8) throw new Error("FAIL: redirect count exceeded");
  const bypass = loadStagingBypassSecret(env);
  const url = appendBypassQuery(resolveStagingUrl(baseUrl, path), bypass);
  const origin = new URL(url).origin;
  const cookie = cookieHeaderFor(origin);
  const res = await fetch(url, {
    redirect: "manual",
    ...init,
    headers: stagingEdgeHeaders(init.headers ?? {}, env, cookie),
  });
  absorbCookies(origin, res);
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    if (loc) {
      const nextUrl = resolveLocation(url, loc);
      const u = new URL(nextUrl);
      return stagingFetch(`${u.protocol}//${u.host}`, `${u.pathname}${u.search}`, init, env, depth + 1);
    }
  }
  return res;
}

export async function stagingHealthOnce(baseUrl, env = { ...loadEnvFile(), ...process.env }) {
  const res = await stagingFetch(baseUrl, "/api/health", {}, env);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`health not JSON status=${res.status} body=${text.slice(0, 120)}`);
  }
  const data = json?.data ?? json;
  const version = String(data?.version ?? data?.release?.git_sha ?? "").toLowerCase();
  return { status: res.status, version, ok: json?.ok === true && data?.ok !== false, body: json };
}

export async function runStagingHealthPreflight(baseUrl, expectedSha, env = { ...loadEnvFile(), ...process.env }) {
  const expected = String(expectedSha ?? "").toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(expected)) {
    throw new Error("FAIL: expectedSha must be 40-char git SHA");
  }
  assertStagingTarget(baseUrl);
  let lastVersion = "";
  for (let i = 1; i <= 3; i += 1) {
    const h = await stagingHealthOnce(baseUrl, env);
    lastVersion = h.version;
    if (h.status !== 200 || !h.ok) {
      throw new Error(`health probe ${i}/3 status=${h.status} ok=${h.ok}`);
    }
    if (h.version !== expected) {
      throw new Error(`health probe ${i}/3 version=${h.version || "(empty)"} expected=${expected}`);
    }
  }
  return { baseUrl, version: lastVersion };
}

export async function waitForStagingHealthSha(
  baseUrl,
  expectedSha,
  env = { ...loadEnvFile(), ...process.env },
  options = {},
) {
  const expected = String(expectedSha ?? "").toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(expected)) {
    throw new Error("FAIL: expectedSha must be 40-char git SHA");
  }
  assertStagingTarget(baseUrl);
  const maxWaitMs = Number(options.maxWaitMs ?? 20 * 60 * 1000);
  const intervalMs = Number(options.intervalMs ?? 15_000);
  const start = Date.now();
  let attempt = 0;
  let last = { status: 0, version: "", ok: false };

  while (Date.now() - start <= maxWaitMs) {
    attempt += 1;
    last = await stagingHealthOnce(baseUrl, env);
    if (last.status === 200 && last.ok && last.version === expected) {
      return {
        baseUrl,
        version: last.version,
        attempts: attempt,
        waitedMs: Date.now() - start,
      };
    }
    console.log(
      `WAIT health attempt ${attempt} status=${last.status} version=${last.version || "(empty)"} expected=${expected.slice(0, 8)}`,
    );
    if (Date.now() - start + intervalMs > maxWaitMs) break;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `FAIL: timeout waiting for health SHA after ${attempt} attempts (last status=${last.status} version=${last.version || "(empty)"})`,
  );
}
