// scripts/check-admin-no-hardcoded-text.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// Juster scope her om ønskelig
const SCAN_DIRS = [
  path.join(ROOT, "app", "admin"),
  path.join(ROOT, "app", "superadmin"),
];

// Filtyper vi sjekker
const EXT = new Set([".ts", ".tsx", ".js", ".jsx"]);

// Ignorerte mapper
const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "out",
  "coverage",
  "scripts",
]);

function exists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue;
      walk(full, out);
    } else {
      const ext = path.extname(e.name).toLowerCase();
      if (EXT.has(ext)) out.push(full);
    }
  }
  return out;
}

/**
 * En pragmatisk “hardcoded text”-detektor:
 * - ser etter tekstnoder i JSX: >Noe tekst<
 * - ser etter string-literals som blir renderet i JSX: {"Noe"}
 *
 * Vi ignorerer:
 * - whitespace
 * - tall-only
 * - {t("...")} og {t.xxx} mønstre
 *
 * NB: Dette er en lint-aktig guard, ikke en full parser.
 */
function findViolations(src) {
  const violations = [];

  // 1) JSX tekstnode: > ... <
  // Vi forsøker å unngå tags, html entities osv. med enkel filtrering.
  const jsxTextRe = />\s*([^<{][^<]*?)\s*</g;

  // 2) JSX expression string: {"..."} eller {'...'}
  const jsxExprStringRe = /\{\s*(['"`])([^'"`]*?)\1\s*\}/g;

  // “Tillatte” patterns (copy-system)
  const allowedExprRe = /\{\s*t\(\s*['"`].+?['"`]\s*\)\s*\}/; // {t("...")}
  const allowedObjRe = /\{\s*t\.[a-zA-Z0-9_.]+\s*\}/; // {t.admin.x}
  const allowedOnlyWhitespaceOrPunct = (s) => {
    const t = s.replace(/\s+/g, " ").trim();
    if (!t) return true;
    // rene tegn/ikoner, enkle separasjoner
    if (/^[\-\–\—•·|/\\:;,.!?()\[\]{}]+$/.test(t)) return true;
    // rene tall
    if (/^\d+([.,]\d+)?$/.test(t)) return true;
    return false;
  };

  // Hjelp: finn linjenummer for pos
  function lineOf(pos) {
    // rask linecount
    return src.slice(0, pos).split("\n").length;
  }

  // JSX text nodes
  let m;
  while ((m = jsxTextRe.exec(src))) {
    const raw = m[1] ?? "";
    const txt = raw.replace(/\s+/g, " ").trim();

    if (allowedOnlyWhitespaceOrPunct(txt)) continue;

    // Ignorer ting som ser ut som JSX uttrykk i tekst (sjeldent)
    if (txt.includes("{") || txt.includes("}")) continue;

    const line = lineOf(m.index);
    violations.push({ line, text: txt.slice(0, 140), kind: "JSX_TEXT" });
  }

  // JSX {"string"}
  while ((m = jsxExprStringRe.exec(src))) {
    const whole = m[0];
    const txt = (m[2] ?? "").replace(/\s+/g, " ").trim();

    if (allowedOnlyWhitespaceOrPunct(txt)) continue;

    // tillat {t("...")} og {t.xxx}
    if (allowedExprRe.test(src)) {
      // NB: denne er global sjekk, men vi sjekker mer spesifikt under:
    }
    // Mer presis: sjekk om string literal er del av t("...")
    const before = src.slice(Math.max(0, m.index - 30), m.index + whole.length + 30);
    if (/t\(\s*(['"`])/.test(before)) continue;

    const line = lineOf(m.index);
    violations.push({ line, text: txt.slice(0, 140), kind: "JSX_EXPR_STRING" });
  }

  return violations;
}

let totalViolations = 0;

for (const dir of SCAN_DIRS) {
  if (!exists(dir)) continue;

  const files = walk(dir);
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const src = fs.readFileSync(file, "utf8");

    // Skip hvis filen åpenbart ikke inneholder JSX
    if (!src.includes("<") || (!file.endsWith(".tsx") && !file.endsWith(".jsx"))) continue;

    // Tillat alt hvis filen eksplisitt opt-out (sjeldent, men greit)
    if (src.includes("/* admin-copy:ignore */")) continue;

    const v = findViolations(src);

    // Filtrer bort falske positives:
    // - hvis filen allerede bruker t.* mye og vi finner små biters UI-labels, kan dere stramme/justere senere
    // - her holder vi det strengt: alt rapporteres
    if (v.length) {
      totalViolations += v.length;
      console.error(`\n[admin-copy] Hardcoded tekst funnet i: ${rel}`);
      for (const x of v.slice(0, 30)) {
        console.error(`  - line ${x.line}: (${x.kind}) "${x.text}"`);
      }
      if (v.length > 30) console.error(`  ... +${v.length - 30} flere`);
    }
  }
}

if (totalViolations > 0) {
  console.error(`\n[admin-copy] FEIL: Fant ${totalViolations} hardkodede tekstbiter i admin/superadmin.`);
  console.error("[admin-copy] Flytt tekst til copy-system (t(...)/t.xxx) eller marker fil med /* admin-copy:ignore */ hvis bevisst.");
  process.exit(1);
}

console.log("[admin-copy] OK: Ingen hardkodet admin/superadmin-tekst funnet.");
process.exit(0);
