#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const EVIDENCE = path.join(ROOT, "docs/rc/phase17menu2b");

const SECRET_RE = [
  /sk_live_[a-zA-Z0-9]+/,
  /sk_test_[a-zA-Z0-9]{20,}/,
  /eyJhbGciOiJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  /service_role["']?\s*[:=]\s*["'][A-Za-z0-9._-]{20,}/i,
  new RegExp(["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_") + String.raw`\s*=\s*\S+`),
  new RegExp(["VERCEL", "TOKEN"].join("_") + String.raw`\s*=\s*\S+`),
];
const PII_RE = [
  /\b[A-ZÆØÅ][a-zæøå]+ [A-ZÆØÅ][a-zæøå]+@[a-z0-9.-]+\.[a-z]{2,}\b/,
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(json|md|txt|ndjson)$/i.test(ent.name)) acc.push(p);
  }
  return acc;
}

const hits = { secrets: [], pii: [] };
for (const file of walk(EVIDENCE)) {
  const text = fs.readFileSync(file, "utf8");
  for (const re of SECRET_RE) {
    if (re.test(text)) hits.secrets.push({ file: path.relative(ROOT, file), re: String(re) });
  }
  // Allow synthetic staging emails
  const cleaned = text.replace(/@staging\.lunchportalen\.test/g, "").replace(/@test\.lunchportalen\.no/g, "");
  for (const re of PII_RE) {
    if (re.test(cleaned)) hits.pii.push({ file: path.relative(ROOT, file) });
  }
}

const report = {
  SECRET_EXPOSURES: hits.secrets.length,
  PII_IN_EVIDENCE: hits.pii.length,
  hits,
};
fs.mkdirSync(path.join(EVIDENCE, "evidence"), { recursive: true });
fs.writeFileSync(path.join(EVIDENCE, "evidence", "safety-scan.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ SECRET_EXPOSURES: report.SECRET_EXPOSURES, PII_IN_EVIDENCE: report.PII_IN_EVIDENCE }, null, 2));
if (report.SECRET_EXPOSURES || report.PII_IN_EVIDENCE) process.exit(1);
