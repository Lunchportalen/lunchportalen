#!/usr/bin/env node
/**
 * Manuell runtime-verifikasjon av public marketing mot produksjon (eller annen base-URL).
 * Kjører IKKE i CI som standard — brukes når deploy er aktiv og du skal bevise live-umbraco vs seed.
 *
 * Bruk:
 *   node scripts/verify-production-public-cms.mjs
 *   PUBLIC_VERIFY_BASE_URL=https://www.lunchportalen.no node scripts/verify-production-public-cms.mjs
 *
 * Miljø:
 *   PUBLIC_VERIFY_BASE_URL — default https://www.lunchportalen.no
 *   VERIFY_STRICT_LIVE_UMBRACO=1 — avslutt med exit 1 hvis noen side ikke har data-lp-public-cms-origin=live-umbraco (krever gyldig Delivery + publiserte noder)
 */

const DEFAULT_BASE = "https://www.lunchportalen.no";
const PATHS = [
  "/",
  "/om-oss",
  "/kontakt",
  "/personvern",
  "/vilkar",
  "/faq",
  "/registrering",
  "/pitch",
  "/investor",
  "/ai-motor-demo",
];

const UA =
  "Mozilla/5.0 (compatible; Lunchportalen-public-cms-verify/1.0; +https://www.lunchportalen.no)";

function originFromHtml(html) {
  const m = String(html).match(/data-lp-public-cms-origin="([^"]*)"/);
  return m ? m[1] : null;
}

function slugFromHtml(html) {
  const m = String(html).match(/data-lp-public-cms-slug="([^"]*)"/);
  return m ? m[1] : null;
}

function hasJsonLd(html) {
  return /<script[^>]+type="application\/ld\+json"/i.test(String(html));
}

async function main() {
  const base = String(process.env.PUBLIC_VERIFY_BASE_URL ?? DEFAULT_BASE).replace(/\/+$/, "");
  const strictLive = process.env.VERIFY_STRICT_LIVE_UMBRACO === "1";

  console.log(`Base: ${base}`);
  console.log(`Strict live-umbraco: ${strictLive ? "yes" : "no"}\n`);

  let failed = false;

  for (const path of PATHS) {
    const url = `${base}${path}`;
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": UA, Accept: "text/html" },
      });
      const vercelErr = res.headers.get("x-vercel-error");
      const text = res.ok ? await res.text() : "";

      if (!res.ok) {
        const server = res.headers.get("server");
        const cache = res.headers.get("cache-control");
        const extra = [
          vercelErr ? `X-Vercel-Error: ${vercelErr}` : null,
          server ? `Server: ${server}` : null,
          cache ? `Cache-Control: ${cache}` : null,
        ]
          .filter(Boolean)
          .join("  ");
        console.log(`${path}  HTTP ${res.status}${extra ? `  ${extra}` : ""}`);
        if (vercelErr === "DEPLOYMENT_DISABLED") {
          console.log(
            `       → Klassifisering: deploy-blocked (Vercel leverer ikke app-HTML; løses i Vercel Dashboard / domene, ikke i repo-kode).`,
          );
        }
        failed = true;
        continue;
      }

      const origin = originFromHtml(text);
      const slug = slugFromHtml(text);
      const jsonLd = hasJsonLd(text);

      console.log(
        `${path}  HTTP ${res.status}  origin=${origin ?? "MISSING"}  slug=${slug ?? "MISSING"}  json-ld=${jsonLd ? "yes" : "no"}`,
      );

      if (strictLive && origin !== "live-umbraco") {
        console.error(`  STRICT FAIL: expected live-umbraco, got ${origin}`);
        failed = true;
      }
    } catch (e) {
      console.log(`${path}  ERROR  ${e instanceof Error ? e.message : String(e)}`);
      failed = true;
    }
  }

  if (failed) {
    console.error("\nVerify finished with failures. Se docs/umbraco/EDITORIAL_UMBRACO_LOCK.md §7c ved DEPLOYMENT_DISABLED eller manglende Delivery.");
    process.exit(1);
  }
  console.log("\nOK — alle forespørsler returnerte HTTP 200 og DOM ble parsert.");
}

main();
