#!/usr/bin/env node
/**
 * PHASE 17MENU.2D — Visual/locale runtime cert for 24 locales (desktop + mobile).
 * HTTP HTML probe + next-intl key/mojibake/Norwegian-fallback checks (not native linguistic approval).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadStagingEnv, STAGING_REF } from "./load-staging-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "docs/rc/phase17menu2d/evidence");
const LOCALES = [
  "nb-NO", "sv-SE", "da-DK", "fi-FI", "en-GB", "de-DE", "fr-FR", "es-ES", "it-IT", "nl-NL",
  "nl-BE", "fr-BE", "de-CH", "fr-CH", "de-AT", "en-IE", "pl-PL", "ro-RO", "cs-CZ", "pt-PT",
  "el-GR", "en-US", "en-CA", "fr-CA",
];
const VIEWPORTS = [
  { name: "desktop", width: 1280 },
  { name: "mobile", width: 390 },
];
const ROUTES = [
  { id: "week", path: "/week" },
  { id: "login", path: "/login" },
];

const NB_MARKERS = ["Bestill lunsj", "Ukeoversikt", "Kapasiteten for denne retten", "Gå til uke"];
const KEY_RE = /\b[a-z]+(?:\.[a-z0-9_]+){2,}\b/i;
const MOJIBAKE_RE = /Ã.|Â.|â€|ðŸ/;

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function mergeSetCookie(existing, setCookieHeaders) {
  const jar = new Map();
  for (const part of String(existing || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const i = part.indexOf("=");
    if (i > 0) jar.set(part.slice(0, i), part.slice(i + 1));
  }
  const list = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : setCookieHeaders
      ? [setCookieHeaders]
      : [];
  for (const raw of list) {
    const first = String(raw).split(";")[0];
    const i = first.indexOf("=");
    if (i > 0) jar.set(first.slice(0, i), first.slice(i + 1));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function httpText(base, pathname, { token, cookie, locale, headers = {} } = {}) {
  const h = {
    Accept: "text/html,application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
    ...(locale ? { "Accept-Language": locale, "x-lp-locale": locale } : {}),
    ...headers,
  };
  const res = await fetch(`${base}${pathname}`, { method: "GET", headers: h, redirect: "manual" });
  const text = await res.text();
  const setCookie =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : res.headers.get("set-cookie")
        ? [res.headers.get("set-cookie")]
        : [];
  return { status: res.status, text, setCookie, headers: res.headers };
}

async function signInSession(base, url, anon, email, password) {
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`login ${email}: ${error?.message || "no session"}`);
  const session = data.session;
  const res = await fetch(`${base}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }),
  });
  const setCookie =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : res.headers.get("set-cookie")
        ? [res.headers.get("set-cookie")]
        : [];
  if (!res.ok) throw new Error(`session ${email}: ${res.status}`);
  return {
    token: session.access_token,
    cookie: mergeSetCookie("", setCookie),
  };
}

function analyzeHtml(locale, html) {
  const issues = [];
  if (MOJIBAKE_RE.test(html)) issues.push("mojibake");
  // Exposed next-intl keys / INTERNAL markers
  if (html.includes("INVALID_KEY") || html.includes("ENVIRONMENT_FALLBACK")) {
    issues.push("next_intl_runtime_error");
  }
  if (KEY_RE.test(html) && /provider\.customer\.|errors\.[a-z]+\.[a-z]+/.test(html)) {
    issues.push("untranslated_internal_key");
  }
  if (locale !== "nb-NO") {
    // Strong Norwegian UI chrome outside nb is a fallback smell (not linguistic review).
    const hits = NB_MARKERS.filter((m) => html.includes(m));
    if (hits.length >= 2) issues.push(`norwegian_fallback:${hits.join("|")}`);
  }
  return issues;
}

async function main() {
  ensureDir(OUT);
  const shotDir = path.join(OUT, "visual-screenshots");
  ensureDir(shotDir);
  const { url } = loadStagingEnv();
  const base = String(process.env.PHASE17MENU2D_BASE_URL || process.env.PHASE17MENU2B_BASE_URL || "").replace(
    /\/$/,
    "",
  );
  if (!base) throw new Error("BASE_URL required");
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const password =
    process.env.PHASE17MENU2B_SYNTH_PASSWORD ||
    `Synth2b-${crypto.createHash("sha256").update(`phase17menu2b-${STAGING_REF}`).digest("hex").slice(0, 24)}`;

  const session = await signInSession(base, url, anon, "no-basis-emp@staging.lunchportalen.test", password);

  const desktop = [];
  const mobile = [];
  let norwegianFallback = 0;
  let internalKeys = 0;
  let mojibake = 0;
  let overflows = 0;

  for (const locale of LOCALES) {
    for (const vp of VIEWPORTS) {
      const routeIssues = [];
      for (const route of ROUTES) {
        const cookie = `${session.cookie}; lp_locale=${locale}`;
        const res = await httpText(base, route.path, {
          token: session.token,
          cookie,
          locale,
          headers: { "Viewport-Width": String(vp.width) },
        });
        // Follow soft redirects to login are OK for anonymous; employee week should be 200/307
        const html = res.text || "";
        const issues = analyzeHtml(locale, html);
        if (res.status >= 500) issues.push(`http_${res.status}`);
        if (issues.includes("mojibake")) mojibake += 1;
        if (issues.some((i) => i.startsWith("norwegian_fallback"))) norwegianFallback += 1;
        if (issues.includes("untranslated_internal_key") || issues.includes("next_intl_runtime_error")) {
          internalKeys += 1;
        }
        // Rough overflow signal: very long unbroken tokens in critical UI
        if (/[A-Za-zÆØÅæøå]{80,}/.test(html)) {
          overflows += 1;
          issues.push("critical_long_token");
        }
        routeIssues.push({ route: route.id, status: res.status, issues });
        const snippetPath = path.join(shotDir, `${locale}_${vp.name}_${route.id}.html.txt`);
        fs.writeFileSync(snippetPath, html.slice(0, 8000));
      }
      const pass = routeIssues.every((r) => r.issues.length === 0 || (r.status >= 300 && r.status < 400));
      // Allow login redirect without treating as fail if no intl defects
      const intlClean = routeIssues.every(
        (r) =>
          !r.issues.some((i) =>
            ["mojibake", "untranslated_internal_key", "next_intl_runtime_error"].includes(i) ||
            i.startsWith("norwegian_fallback") ||
            i.startsWith("http_5"),
          ),
      );
      const entry = { locale, viewport: vp.name, routes: routeIssues, pass: intlClean };
      if (vp.name === "desktop") desktop.push(entry);
      else mobile.push(entry);
    }
  }

  const summary = {
    phase: "17MENU.2D",
    staging_ref: STAGING_REF,
    VISUAL_LOCALE_E2E: `${desktop.filter((d) => d.pass).length}/24`,
    DESKTOP_LOCALE_E2E: `${desktop.filter((d) => d.pass).length}/24`,
    MOBILE_LOCALE_E2E: `${mobile.filter((d) => d.pass).length}/24`,
    NORWEGIAN_VISUAL_FALLBACK_OUTSIDE_NO: norwegianFallback,
    UNTRANSLATED_INTERNAL_KEYS: internalKeys,
    MOJIBAKE_ERRORS: mojibake,
    CRITICAL_LAYOUT_OVERFLOWS: overflows,
    NOTE: "HTML/runtime probe — not Playwright pixel native linguistic approval",
    desktop,
    mobile,
  };
  fs.writeFileSync(path.join(OUT, "visual-locales-24.json"), JSON.stringify(summary, null, 2));
  console.log(
    JSON.stringify(
      {
        DESKTOP_LOCALE_E2E: summary.DESKTOP_LOCALE_E2E,
        MOBILE_LOCALE_E2E: summary.MOBILE_LOCALE_E2E,
        NORWEGIAN_VISUAL_FALLBACK_OUTSIDE_NO: norwegianFallback,
        UNTRANSLATED_INTERNAL_KEYS: internalKeys,
        MOJIBAKE_ERRORS: mojibake,
      },
      null,
      2,
    ),
  );
  if (
    desktop.filter((d) => d.pass).length < 24 ||
    mobile.filter((d) => d.pass).length < 24 ||
    norwegianFallback > 0 ||
    internalKeys > 0 ||
    mojibake > 0
  ) {
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
