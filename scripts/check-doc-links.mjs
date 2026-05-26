#!/usr/bin/env node
/* =========================================================
   DOC LINK CHECK — LUNCHPORTALEN (scaffold, Gr 17 prep)
   Verifies relative .md links under docs/ resolve to files.
   JSON summary on stdout; human errors on stderr.
========================================================= */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs");

const MARKDOWN_LINK_RE = /!?\[[^\]]*\]\(([^)]+)\)/g;
const REF_LINK_DEF_RE = /^\s*\[[^\]]+\]:\s+(\S+)/gm;

function walkMarkdownFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      walkMarkdownFiles(p, out);
    } else if (ent.isFile() && ent.name.endsWith(".md")) {
      out.push(p);
    }
  }
  return out;
}

function decodeHref(raw) {
  let href = raw.trim();
  if (!href) return null;
  if (href.startsWith("<") && href.endsWith(">")) href = href.slice(1, -1).trim();
  if (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("#")
  ) {
    return null;
  }
  return href;
}

function isMarkdownHref(href) {
  const pathPart = href.split("#")[0].split("?")[0].trim();
  if (!pathPart) return false;
  if (pathPart.startsWith("/") && !pathPart.endsWith(".md")) return false;
  return pathPart.toLowerCase().endsWith(".md");
}

function resolveTarget(sourceFile, href) {
  const pathPart = href.split("#")[0].split("?")[0].trim();
  if (pathPart.startsWith("/")) {
    return path.join(ROOT, pathPart.replace(/^\//, ""));
  }
  return path.resolve(path.dirname(sourceFile), pathPart);
}

function collectHrefs(text) {
  const hrefs = [];
  for (const re of [MARKDOWN_LINK_RE, REF_LINK_DEF_RE]) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const decoded = decodeHref(m[1]);
      if (decoded && isMarkdownHref(decoded)) hrefs.push(decoded);
    }
  }
  return hrefs;
}

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join("/");
}

function main() {
  const files = walkMarkdownFiles(DOCS_DIR);
  const broken = [];
  let linksChecked = 0;

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const href of collectHrefs(text)) {
      linksChecked += 1;
      const target = resolveTarget(file, href);
      if (!fs.existsSync(target)) {
        broken.push({
          source: rel(file),
          href,
          resolved: rel(target),
        });
      }
    }
  }

  const result = {
    ok: broken.length === 0,
    scannedFiles: files.length,
    linksChecked,
    brokenCount: broken.length,
    broken,
  };

  if (broken.length) {
    console.error(`\n❌ DOC LINK CHECK FAILED — ${broken.length} broken relative .md link(s):\n`);
    const max = Math.min(broken.length, 20);
    for (let i = 0; i < max; i++) {
      const b = broken[i];
      console.error(`  - ${b.source}\n    href: ${b.href}\n    resolved: ${b.resolved}`);
    }
    if (broken.length > max) {
      console.error(`  … and ${broken.length - max} more (see JSON output)\n`);
    }
  } else {
    console.error(
      `\n✅ DOC LINK CHECK PASSED — ${linksChecked} relative .md link(s) in ${files.length} file(s)\n`
    );
  }

  console.log(JSON.stringify(result, null, 2));
  process.exit(broken.length ? 1 : 0);
}

main();
