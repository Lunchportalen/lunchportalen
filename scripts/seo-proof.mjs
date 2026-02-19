import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const FORBIDDEN = new Set(["les mer", "se mer", "klikk her"]);
const PAGE_PATH = "/lunsjordning";

function fail(message) {
  failures.push(message);
}

function isGenericLabel(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return FORBIDDEN.has(normalized) || normalized.startsWith("se ") || normalized.startsWith("les ");
}

function readText(relativePath) {
  const full = path.join(root, relativePath);
  if (!fs.existsSync(full)) {
    fail(`Missing file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(full, "utf8");
}

function readJson(relativePath) {
  const raw = readText(relativePath);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`Invalid JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

const registry = readJson("lib/seo/marketing-registry.json");
const faqData = readJson("lib/seo/faq-data.json");
const pageSource = readText("app/lunsjordning/page.tsx");

if (registry) {
  const entry = registry[PAGE_PATH];

  if (!entry) {
    fail("Registry missing /lunsjordning");
  } else {
    const intentLinks = Array.isArray(entry.intentLinks) ? entry.intentLinks : [];
    if (intentLinks.length < 8) {
      fail(`/lunsjordning intentLinks too few: ${intentLinks.length}`);
    }

    for (const link of intentLinks) {
      const label = String(link?.label ?? "").trim().toLowerCase();
      if (isGenericLabel(label)) {
        fail(`/lunsjordning contains forbidden intent label: ${link.label}`);
      }
    }

    for (const ctaKey of ["primaryCta", "secondaryCta"]) {
      const cta = entry[ctaKey];
      if (cta) {
        const label = String(cta.label ?? "").trim().toLowerCase();
        if (isGenericLabel(label)) {
          fail(`/lunsjordning contains forbidden ${ctaKey} label: ${cta.label}`);
        }
      }
    }

    if (entry?.primaryCta?.href !== "/registrering") {
      fail("SEO_PRIMARY_CTA_NOT_REGISTRERING");
    }

    if (!String(entry.ogImage || "").startsWith("/og/")) {
      fail(`/lunsjordning ogImage must start with /og/: ${entry.ogImage}`);
    }

    if (entry.faqKey) {
      const faqItems = faqData ? faqData[entry.faqKey] : null;
      if (!Array.isArray(faqItems)) {
        fail(`/lunsjordning faqKey missing in faq-data.json: ${entry.faqKey}`);
      } else if (faqItems.length < 6) {
        fail(`/lunsjordning faqKey must have >= 6 items: ${faqItems.length}`);
      }
    }
  }
}

if (pageSource) {
  if (/from\s+["']next\/script["']/.test(pageSource)) {
    fail("/lunsjordning imports next/script");
  }

  if (!/export\s+async\s+function\s+generateMetadata/.test(pageSource)) {
    fail("/lunsjordning missing generateMetadata");
  }

  if (!/type=["']application\/ld\+json["']/.test(pageSource)) {
    fail("/lunsjordning missing JSON-LD script tag");
  }

  const h1Count = (pageSource.match(/<h1\b/g) || []).length;
  if (h1Count !== 1) {
    fail(`/lunsjordning must have exactly one <h1>, found ${h1Count}`);
  }

  const hasPrimaryCtaRendering = /href=\{primaryCta\.href\}|href=["']\/registrering["']/.test(pageSource);
  if (!hasPrimaryCtaRendering) {
    fail("/lunsjordning missing primary CTA rendering");
  }
}

if (failures.length > 0) {
  console.error("SEO-PROOF FAILED");
  for (const item of failures) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("SEO-PROOF OK");
