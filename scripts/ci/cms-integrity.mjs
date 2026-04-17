#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const home = path.join(ROOT, "app", "(public)", "page.tsx");
const loader = path.join(ROOT, "lib", "cms", "public", "loadPublicPageWithTrustFallback.ts");

if (!fs.existsSync(home)) {
  console.error(`\n❌ CMS INTEGRITY: missing ${home}\n`);
  process.exit(1);
}

if (!fs.existsSync(loader)) {
  console.error(`\n❌ CMS INTEGRITY: missing ${loader}\n`);
  process.exit(1);
}

const homeText = fs.readFileSync(home, "utf8");
const loaderText = fs.readFileSync(loader, "utf8");

const homeChecks = [
  [/loadPublicPageWithTrustFallback\s*\(\s*["']home["']/, 'loadPublicPageWithTrustFallback("home")'],
  [/\bCmsBlockRenderer\b/, "CmsBlockRenderer"],
  [/\/\/[^\n]*getContentBySlug\s*\(\s*['"]home['"]/, "getContentBySlug('home') (doc anchor)"],
];

const loaderChecks = [
  [/normalized\s*===\s*["']home["']/, 'home slug branch in loadPublicPageWithTrustFallback'],
  [/\bparseBody\s*\(/, "parseBody (CMS body → blocks)"],
];

let failed = false;
for (const [re, label] of homeChecks) {
  if (!re.test(homeText)) {
    console.error(`\n❌ CMS INTEGRITY: homepage must include ${label}\n   ${home}\n`);
    failed = true;
  }
}
for (const [re, label] of loaderChecks) {
  if (!re.test(loaderText)) {
    console.error(`\n❌ CMS INTEGRITY: public loader must include ${label}\n   ${loader}\n`);
    failed = true;
  }
}

if (!/!\s*page\s*\|\|\s*page\.blocks\.length\s*===\s*0/.test(homeText) && !/page\.blocks\.length\s*===\s*0/.test(homeText)) {
  console.error(`\n❌ CMS INTEGRITY: expected empty-CMS guard (page.blocks.length === 0)\n   ${home}\n`);
  failed = true;
}

if (failed) {
  console.error("\n⛔ cms-integrity failed.\n");
  process.exit(1);
}

console.log("\n✅ cms-integrity: public homepage CMS pipeline OK.\n");
