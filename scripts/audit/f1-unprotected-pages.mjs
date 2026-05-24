#!/usr/bin/env node
import { globSync } from "glob";

const protectedPrefixes = [
  "/saas",
  "/week",
  "/superadmin",
  "/admin",
  "/backoffice",
  "/orders",
  "/driver",
  "/kitchen",
  "/leverandor",
];

function urlFromPage(p) {
  let r = p.replace(/^app\//, "").replace(/\/page\.tsx$/, "");
  r = r.replace(/\([^)]+\)\//g, "").replace(/\[[^\]]+\]/g, "[param]");
  if (!r || r === "page.tsx") return "/";
  return "/" + r.replace(/\\/g, "/");
}

const pages = globSync("app/**/page.tsx", { windowsPathsNoEscape: true });
const unprotected = [];
for (const p of pages) {
  const norm = p.replace(/\\/g, "/");
  const url = urlFromPage(norm);
  if (protectedPrefixes.some((pr) => url === pr || url.startsWith(pr + "/"))) continue;
  unprotected.push({ file: norm, url });
}
unprotected.sort((a, b) => a.url.localeCompare(b.url));
console.log(
  JSON.stringify(
    {
      total_pages: pages.length,
      unprotected_count: unprotected.length,
      employee_app_unprotected: unprotected.filter((x) => x.file.includes("(app)/")),
      all: unprotected,
    },
    null,
    2,
  ),
);
