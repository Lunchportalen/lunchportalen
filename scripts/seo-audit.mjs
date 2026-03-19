import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const warnings = [];

const FORBIDDEN = new Set(["les mer", "se mer", "klikk her"]);
const ALLOWED_CHANGEFREQ = new Set(["daily", "weekly", "monthly"]);
const KEY_LANDING = new Set([
    "/lunsjordning",
    "/hva-er-lunsjordning",
    "/definitiv-guide-firmalunsj",
    "/system-for-lunsjbestilling",
    "/lunch-levering-bergen",
]);

function fail(message) {
    failures.push(message);
}

function warn(message) {
    warnings.push(message);
}

function isGenericLabel(value) {
    const normalized = String(value ?? "").trim().toLowerCase();
    return FORBIDDEN.has(normalized) || normalized.startsWith("se ") || normalized.startsWith("les ");
}

function readJson(relativePath) {
    const full = path.join(root, relativePath);
    if (!fs.existsSync(full)) {
        fail(`Missing file: ${relativePath}`);
        return null;
    }

    try {
        const raw = fs.readFileSync(full, "utf8");
        return JSON.parse(raw);
    } catch (error) {
        fail(`Invalid JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}

function resolvePageFile(routePath) {
    const segment = routePath === "/" ? "" : routePath.replace(/^\//, "");
    const candidates = segment
        ? [`app/(public)/${segment}/page.tsx`, `app/${segment}/page.tsx`]
        : ["app/(public)/page.tsx", "app/page.tsx"];
    for (const p of candidates) {
        if (fs.existsSync(path.join(root, p))) return p;
    }
    return segment ? `app/${segment}/page.tsx` : "app/page.tsx";
}

const registry = readJson("lib/seo/marketing-registry.json");
const faqData = readJson("lib/seo/faq-data.json");

if (registry) {
    for (const [key, entry] of Object.entries(registry)) {
        if (String(entry.path || "").trim() !== key) {
            fail(`[${key}] path mismatch: ${entry.path}`);
        }

        if (!String(entry.title || "").trim()) {
            fail(`[${key}] missing title`);
        }

        if (!String(entry.description || "").trim()) {
            fail(`[${key}] missing description`);
        }

        if (!String(entry.ogImage || "").startsWith("/og/")) {
            fail(`[${key}] ogImage must start with /og/`);
        }

        if (typeof entry.priority !== "number" || entry.priority < 0.1 || entry.priority > 1) {
            fail(`[${key}] priority must be in range 0.1..1.0`);
        }

        if (!ALLOWED_CHANGEFREQ.has(entry.changefreq)) {
            fail(`[${key}] invalid changefreq: ${entry.changefreq}`);
        }

        if (entry.lastmod && entry.lastmod !== "auto") {
            const lastmod = new Date(entry.lastmod);
            if (Number.isNaN(lastmod.valueOf())) {
                fail(`[${key}] invalid lastmod: ${entry.lastmod}`);
            }
        }

        if (!Array.isArray(entry.breadcrumbs) || entry.breadcrumbs.length === 0) {
            fail(`[${key}] breadcrumbs missing`);
        } else {
            for (const crumb of entry.breadcrumbs) {
                if (!String(crumb?.name || "").trim()) {
                    fail(`[${key}] breadcrumb name missing`);
                }
                if (!String(crumb?.item || "").startsWith("/")) {
                    fail(`[${key}] breadcrumb item must start with /`);
                }
            }
        }

        if (!Array.isArray(entry.intentLinks)) {
            fail(`[${key}] intentLinks must be array`);
        } else {
            if (KEY_LANDING.has(key) && entry.intentLinks.length < 8) {
                fail(`[${key}] key landing page must have at least 8 intent links`);
            }

            const seenPairs = new Set();
            for (const link of entry.intentLinks) {
                const href = String(link?.href || "").trim();
                const label = String(link?.label || "").trim();
                const labelLower = label.toLowerCase();

                if (!href.startsWith("/")) {
                    fail(`[${key}] intent href must start with /: ${href}`);
                }
                if (href === key) {
                    fail(`[${key}] intent link must not self-link`);
                }
                if (!label) {
                    fail(`[${key}] intent label missing`);
                }
                if (isGenericLabel(label)) {
                    fail(`[${key}] forbidden intent label: ${label}`);
                }

                const pairKey = `${href}::${labelLower}`;
                if (seenPairs.has(pairKey)) {
                    fail(`[${key}] duplicate intent link pair: ${pairKey}`);
                }
                seenPairs.add(pairKey);
            }
        }

        if (entry.faqKey) {
            if (entry.faqKey !== key) {
                fail(`[${key}] faqKey must match path key`);
            }
            const faqItems = faqData ? faqData[entry.faqKey] : null;
            if (!Array.isArray(faqItems)) {
                fail(`[${key}] faqKey not found in faq-data.json`);
            }
        }

        if (KEY_LANDING.has(key)) {
            if (!entry.primaryCta || !entry.secondaryCta) {
                fail(`[${key}] key landing page must have primaryCta and secondaryCta`);
            } else {
                if (entry.primaryCta.href !== "/registrering") {
                    fail(`[${key}] SEO_PRIMARY_CTA_NOT_REGISTRERING`);
                }
                for (const cta of [entry.primaryCta, entry.secondaryCta]) {
                    const label = String(cta.label || "").trim().toLowerCase();
                    if (!String(cta.href || "").startsWith("/")) {
                        fail(`[${key}] CTA href must start with /`);
                    }
                    if (isGenericLabel(cta.label)) {
                        fail(`[${key}] forbidden CTA label: ${cta.label}`);
                    }
                }
            }
        }

        const pageFile = resolvePageFile(key);
        const fullPagePath = path.join(root, pageFile);
        if (!fs.existsSync(fullPagePath)) {
            fail(`[${key}] missing page file: ${pageFile}`);
        } else {
            const source = fs.readFileSync(fullPagePath, "utf8");
            if (/from\s+["']next\/script["']/.test(source)) {
                fail(`[${key}] page imports next/script`);
            }
            if (!/generateMetadata|export\s+const\s+metadata/.test(source)) {
                warn(`[${key}] page has no metadata export`);
            }
        }
    }
}

console.log("SEO AUDIT REPORT");
console.log(`Checked ${registry ? Object.keys(registry).length : 0} registry entries`);

if (warnings.length) {
    console.log("Warnings:");
    for (const message of warnings) {
        console.log(`- ${message}`);
    }
}

if (failures.length) {
    console.error("Critical failures:");
    for (const message of failures) {
        console.error(`- ${message}`);
    }
    process.exit(1);
}

console.log("SEO-AUDIT OK");
