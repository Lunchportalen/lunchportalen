import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const KEY_LANDING_PAGES = [
    "/lunsjordning",
    "/hva-er-lunsjordning",
    "/definitiv-guide-firmalunsj",
    "/system-for-lunsjbestilling",
    "/lunch-levering-bergen",
];

function fail(message) {
    failures.push(message);
}

function routeToFile(routePath) {
    if (routePath === "/") return "app/page.tsx";
    return `app/${routePath.replace(/^\//, "")}/page.tsx`;
}

function readJson(relativePath) {
    const full = path.join(root, relativePath);
    if (!fs.existsSync(full)) {
        fail(`Missing file: ${relativePath}`);
        return null;
    }

    try {
        return JSON.parse(fs.readFileSync(full, "utf8"));
    } catch (error) {
        fail(`Invalid JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}

const registry = readJson("lib/seo/marketing-registry.json");

if (registry) {
    for (const routePath of KEY_LANDING_PAGES) {
        const entry = registry[routePath];
        if (!entry) {
            fail(`[${routePath}] missing in registry`);
            continue;
        }

        const relFile = routeToFile(routePath);
        const fullFile = path.join(root, relFile);
        if (!fs.existsSync(fullFile)) {
            fail(`[${routePath}] missing page file ${relFile}`);
            continue;
        }

        const source = fs.readFileSync(fullFile, "utf8");

        const h1Count = (source.match(/<h1\b/g) || []).length;
        if (h1Count !== 1) {
            fail(`[${routePath}] must have exactly one <h1>, found ${h1Count}`);
        }

        const hasRegistreringCta = /href=["']\/registrering["']|href=\{primaryCta\.href\}/.test(source);
        if (!hasRegistreringCta) {
            fail(`[${routePath}] must include CTA to /registrering`);
        }

        if (!/type=["']application\/ld\+json["']/.test(source)) {
            fail(`[${routePath}] missing JSON-LD script tag`);
        }

        if (entry.faqKey) {
            const hasFaqDom = /faqItems\.map|<details\b/.test(source);
            if (!hasFaqDom) {
                fail(`[${routePath}] faqKey exists but FAQ DOM not detected`);
            }
        }

        const hrefs = source.match(/href=["']\/[^"']+["']/g) || [];
        if (hrefs.length < 5) {
            fail(`[${routePath}] too few internal links in page source: ${hrefs.length}`);
        }

        const pairSet = new Set();
        for (const link of entry.intentLinks || []) {
            const href = String(link?.href || "").trim();
            const label = String(link?.label || "").trim().toLowerCase();
            const key = `${href}::${label}`;
            if (pairSet.has(key)) {
                fail(`[${routePath}] duplicate registry anchor pair: ${key}`);
            }
            pairSet.add(key);
        }
    }
}

if (failures.length) {
    console.error("SEO-CONTENT-LINT FAILED");
    for (const item of failures) {
        console.error(`- ${item}`);
    }
    process.exit(1);
}

console.log("SEO-CONTENT-LINT OK");
