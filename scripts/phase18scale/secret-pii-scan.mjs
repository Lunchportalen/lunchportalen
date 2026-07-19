#!/usr/bin/env node
/** Scan phase18 evidence for secrets/PII before commit. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

const SECRET_RE =
  /(service_role|eyJhbGciOi|sk_live|sk_test|BEGIN (RSA |OPENSSH )?PRIVATE KEY|password\s*[:=]\s*["']?[^"'\s]{12,})/i;
const PII_RE = /\b[A-Z0-9._%+-]+@(?!load\.lunchportalen\.test|staging\.lunchportalen\.test)[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(json|md|txt|ndjson)$/i.test(name) && !/sessions/i.test(name)) acc.push(p);
  }
  return acc;
}

const hits = [];
for (const file of walk(OUT)) {
  const text = fs.readFileSync(file, "utf8");
  if (SECRET_RE.test(text)) hits.push({ file, kind: "SECRET" });
  if (PII_RE.test(text)) hits.push({ file, kind: "PII" });
}

const report = {
  phase: "18SCALE",
  SECRET_EXPOSURES: hits.filter((h) => h.kind === "SECRET").length,
  PII_IN_EVIDENCE: hits.filter((h) => h.kind === "PII").length,
  hits,
};
fs.writeFileSync(path.join(OUT, "secret-pii-scan.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.SECRET_EXPOSURES || report.PII_IN_EVIDENCE) process.exit(2);
