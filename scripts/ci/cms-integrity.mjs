#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const home = path.join(ROOT, "app", "(public)", "page.tsx");

if (!fs.existsSync(home)) {
  console.error(`\n❌ CMS INTEGRITY: missing ${home}\n`);
  process.exit(1);
}

const homeText = fs.readFileSync(home, "utf8");

/** `/` on the app domain is an auth-router (FASE 14-UI-2); no CMS block pipeline. */
function isAuthRouterHomepage(src) {
  return (
    /from\s+["']next\/navigation["']/.test(src) &&
    /\bredirect\s*\(/.test(src) &&
    /\bgetAuthContext\b/.test(src) &&
    /\blandingForRole\b/.test(src) &&
    !/\bCmsBlockRenderer\b/.test(src)
  );
}

const homeChecks = [
  [/loadPublicPageWithTrustFallback\s*\(\s*["']home["']/, 'loadPublicPageWithTrustFallback("home")'],
  [/\bCmsBlockRenderer\b/, "CmsBlockRenderer"],
  [/\/\/[^\n]*getContentBySlug\s*\(\s*['"]home['"]/, "getContentBySlug('home') (doc anchor)"],
];

let failed = false;

if (!isAuthRouterHomepage(homeText)) {
  for (const [re, label] of homeChecks) {
    if (!re.test(homeText)) {
      console.error(`\n❌ CMS INTEGRITY: homepage must include ${label}\n   ${home}\n`);
      failed = true;
    }
  }

  if (
    !/!\s*page\s*\|\|\s*page\.blocks\.length\s*===\s*0/.test(homeText) &&
    !/page\.blocks\.length\s*===\s*0/.test(homeText)
  ) {
    console.error(`\n❌ CMS INTEGRITY: expected empty-CMS guard (page.blocks.length === 0)\n   ${home}\n`);
    failed = true;
  }
}

if (failed) {
  console.error("\n⛔ cms-integrity failed.\n");
  process.exit(1);
}

if (isAuthRouterHomepage(homeText)) {
  console.log("\n✅ cms-integrity: app / is auth-router (homepage CMS anchors skipped).\n");
} else {
  console.log("\n✅ cms-integrity: public homepage CMS pipeline OK.\n");
}
