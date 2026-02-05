// lib/copy/admin.ts
import adminCopy from "./admin.copy.nb.json";

/**
 * Vars til templating: {{key}}
 */
export type Vars = Record<string, string | number | boolean | null | undefined>;

const DEV = process.env.NODE_ENV !== "production";

function warnMissing(path: string) {
  if (!DEV) return;
  // Fail-fast i dev: synlig i console, men ikke krasj
  // (UI returnerer path som fallback)
  console.warn(`[copy:admin] Mangler nøkkel → ${path}`);
}

function warnType(path: string, expected: string, got: any) {
  if (!DEV) return;
  const t = Array.isArray(got) ? "array" : typeof got;
  console.warn(`[copy:admin] Feil type for → ${path} (forventet ${expected}, fikk ${t})`);
}

function isRecord(v: any): v is Record<string, any> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Støtter:
 * - dot paths: "employeesSection.table.empty.line1"
 * - array index: "insightAI.alerts.items.0"
 */
function getPath(obj: any, path: string): any {
  const parts = String(path ?? "")
    .split(".")
    .map((p) => p.trim())
    .filter(Boolean);

  let cur: any = obj;

  for (const p of parts) {
    if (Array.isArray(cur)) {
      // array index
      const idx = Number(p);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) return undefined;
      cur = cur[idx];
      continue;
    }

    if (!isRecord(cur) || !(p in cur)) return undefined;
    cur = cur[p];
  }

  return cur;
}

function template(str: string, vars?: Vars) {
  if (!vars) return str;

  return str.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    if (v === null || v === undefined) return "";
    return String(v);
  });
}

/**
 * Hent råverdi (string | object | array | number ...)
 * Returnerer undefined hvis mangler.
 */
export function get(path: string) {
  return getPath(adminCopy, path);
}

/**
 * Hent string fra copy-pack.
 * Fallback: returnerer path hvis nøkkel mangler eller ikke er string.
 */
export function t(path: string, vars?: Vars) {
  const v = getPath(adminCopy, path);

  if (typeof v === "string") return template(v, vars);

  // Om noen bruker t() på en array av strings: join med linjeskift
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
    return v.map((s) => template(s, vars)).join("\n");
  }

  if (v === undefined) warnMissing(path);
  else warnType(path, "string", v);

  return path;
}

/**
 * Hent string[] fra copy-pack.
 * Fallback: [] hvis mangler eller feil type.
 */
export function tArray(path: string, vars?: Vars): string[] {
  const v = getPath(adminCopy, path);

  if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
    return v.map((s) => template(s, vars));
  }

  if (v === undefined) warnMissing(path);
  else warnType(path, "string[]", v);

  return [];
}

/**
 * Eksporter hele copy-objektet (nyttig for avansert bruk / inspeksjon).
 */
export const ADMIN_COPY = adminCopy as unknown as Readonly<typeof adminCopy>;
