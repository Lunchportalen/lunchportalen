import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "archive", ".git", "tests", "scripts"]);

const INVOICE_TABLES = new Set(["invoice_runs", "invoice_lines", "invoices"]);
/** Columns removed / renamed — must never appear in invoice-table selects. */
const FORBIDDEN_INVOICE_COLUMNS = new Set([
  "period_from",
  "period_to",
  "billable_qty",
  "amount_ex_vat",
  "company_name",
  "plan_tier",
  "price_ex_vat",
  "cancelled_qty",
  "cancelled_before_0800_qty",
  "flags",
  "note",
  "amount_inc_vat",
  "reference",
  "month",
  "locked",
  "export_status",
  "export_last_error",
  "unit_price",
  "amount",
  "currency",
  "tripletex_vat_code",
  "product_tier",
  "product_name",
]);

/** Legacy monthly invoice routes — K2 schema cleanup scope. */
const SCOPED_FILES = new Set([
  "lib/superadmin/invoiceRunDb.ts",
  "lib/superadmin/invoiceMonthlyDb.ts",
  "lib/superadmin/tripletexExportByRun.ts",
  "app/api/superadmin/invoices/runs/route.ts",
  "app/api/superadmin/invoices/runs/[runId]/route.ts",
  "app/api/superadmin/invoices/runs/[runId]/exports/route.ts",
  "app/api/superadmin/companies/invoices/route.ts",
  "app/api/superadmin/invoices/generate/route.ts",
  "app/api/superadmin/invoices/reconcile/route.ts",
  "app/api/superadmin/invoices/exports/route.ts",
  "app/api/superadmin/invoices/exports/retry/route.ts",
  "app/api/superadmin/invoices/reverse/route.ts",
]);

const KNOWN_COLUMNS: Record<string, Set<string>> = {
  invoice_runs: new Set([
    "id",
    "period_start",
    "period_end",
    "status",
    "created_at",
    "updated_at",
    "rid",
    "created_by",
    "company_id",
    "currency_code",
    "subtotal_cents_ex_vat",
    "adjustments_cents_inc_vat",
    "vat_cents",
    "total_cents_inc_vat",
    "external_invoice_ref",
    "generated_at",
    "finalized_at",
  ]),
  invoice_lines: new Set([
    "id",
    "run_id",
    "company_id",
    "location_id",
    "tier",
    "unit_price_nok",
    "quantity",
    "amount_nok",
    "basis",
    "created_at",
    "invoice_id",
    "order_id",
    "service_on",
    "description",
    "updated_at",
    "invoice_run_id",
    "line_type",
    "billing_adjustment_id",
    "user_id",
    "service_date",
    "unit_price_cents_ex_vat",
    "line_subtotal_cents_ex_vat",
    "line_vat_cents",
    "line_total_cents_inc_vat",
    "companies",
  ]),
  invoices: new Set([
    "id",
    "run_id",
    "company_id",
    "status",
    "currency_code",
    "subtotal_nok",
    "vat_nok",
    "total_nok",
    "external_invoice_id",
    "created_at",
    "updated_at",
  ]),
  tripletex_invoices: new Set([
    "id",
    "run_id",
    "company_id",
    "external_invoice_id",
    "status",
    "last_error",
    "created_at",
    "updated_at",
  ]),
  billing_tax_codes: new Set(["id", "rate", "tripletex_vat_code", "description"]),
  company_billing_accounts: new Set(["company_id", "tripletex_customer_id", "product_name", "vat_code"]),
};

const FROM_RE = /\.from\s*\(\s*["'`]([a-z_]+)["'`]\s*\)/g;
const SELECT_RE = /\.select\s*\(\s*(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (extname(p) === ".ts" || extname(p) === ".tsx") out.push(p);
  }
  return out;
}

function nextSelectAfterFrom(text: string, fromIndex: number): string | null {
  const tail = text.slice(fromIndex);
  const nextFrom = tail.slice(1).search(/\.from\s*\(\s*["'`]/);
  const searchWindow = nextFrom >= 0 ? tail.slice(0, nextFrom + 1) : tail.slice(0, 800);
  SELECT_RE.lastIndex = 0;
  const m = SELECT_RE.exec(searchWindow);
  return m ? m[2] : null;
}

function extractSelectColumns(selectBody: string): string[] {
  const cols: string[] = [];
  let depth = 0;
  let token = "";
  for (const ch of selectBody) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      const parsed = parseSelectToken(token);
      if (parsed) cols.push(parsed);
      token = "";
      continue;
    }
    token += ch;
  }
  const parsed = parseSelectToken(token);
  if (parsed) cols.push(parsed);
  return cols;
}

function parseSelectToken(raw: string): string | null {
  const token = raw.trim().split(/\s+/)[0]?.replace(/^["'`]|["'`]$/g, "") ?? "";
  if (!token) return null;
  if (token.includes("(")) return token.split("(")[0]?.trim() || null;
  return token.replace(/\)$/, "");
}

function collectBrokenColumnRefs(): Array<{ file: string; table: string; column: string }> {
  const hits: Array<{ file: string; table: string; column: string }> = [];
  const files = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "lib"))];

  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    const scoped = SCOPED_FILES.has(rel);
    const text = readFileSync(file, "utf8");

    FROM_RE.lastIndex = 0;
    let fromMatch: RegExpExecArray | null;
    while ((fromMatch = FROM_RE.exec(text)) !== null) {
      const table = fromMatch[1];
      if (!KNOWN_COLUMNS[table] && !FORBIDDEN_INVOICE_COLUMNS.size) continue;

      const selectBody = nextSelectAfterFrom(text, fromMatch.index);
      if (!selectBody) continue;

      for (const col of extractSelectColumns(selectBody)) {
        if (INVOICE_TABLES.has(table) && FORBIDDEN_INVOICE_COLUMNS.has(col)) {
          hits.push({ file: rel, table, column: col });
          continue;
        }
        if (scoped && KNOWN_COLUMNS[table] && !KNOWN_COLUMNS[table].has(col)) {
          hits.push({ file: rel, table, column: col });
        }
      }
    }
  }

  return hits;
}

describe("audit: no broken invoice column references in app/lib", () => {
  it("scoped invoice routes use real DB columns; forbidden drift names never selected", () => {
    const broken = collectBrokenColumnRefs();
    expect(
      broken,
      broken.length
        ? `Invalid invoice column reference(s):\n${broken.map((h) => `  - ${h.file}: ${h.table}.${h.column}`).join("\n")}`
        : undefined,
    ).toEqual([]);
  });

  it("migrations ledger defines invoice_runs and invoice_lines", () => {
    const sqlFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
    const allSql = sqlFiles.map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8")).join("\n");
    expect(allSql.includes("invoice_runs")).toBe(true);
    expect(allSql.includes("invoice_lines")).toBe(true);
  });
});
