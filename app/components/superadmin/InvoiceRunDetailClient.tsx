"use client";

import { useMemo, useState } from "react";

type Run = {
  id: string;
  period_from: string;
  period_to: string;
  status: string;
  created_at: string;
  note?: string | null;
};

type Row = {
  id: string;
  company_id: string;
  company_name: string | null;
  plan_tier: string | null;
  price_ex_vat: number | null;
  billable_qty: number;
  cancelled_qty: number;
  cancelled_before_0800_qty: number;
  amount_ex_vat: number | null;
  flags: string | null;

  tripletex_customer_id: string | null;
  product_name: string | null;
  vat_code: string | null;

  export_status: string; // OK | MISSING_CUSTOMER_ID | MISSING_PRICE | ...
};

type Totals = {
  companies: number;
  billable: number;
  amount: number;
  missingCustomer: number;
  missingPrice: number;
};

type ExportLogRow = {
  id: string;
  exported_at: string;
  exported_by: string | null;
  status: "success" | "blocked" | "failed" | string;
  file_name: string | null;
  rows_count: number;
  amount_ex_vat: number | null;
  detail: string | null;
};

function chip(status: string) {
  const s = String(status ?? "").toUpperCase();
  const base = "inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1";
  if (s === "OK") return `${base} bg-white/60 text-[rgb(var(--lp-text))] ring-[rgb(var(--lp-border))]`;
  if (s === "MISSING_CUSTOMER_ID") return `${base} bg-black text-white ring-black`;
  if (s.includes("MISSING_PRICE")) return `${base} bg-white/60 text-[rgb(var(--lp-text))] ring-[rgb(var(--lp-border))]`;
  return `${base} bg-white/60 text-[rgb(var(--lp-muted))] ring-[rgb(var(--lp-border))]`;
}

function chipExport(status: string) {
  const s = String(status ?? "").toLowerCase();
  const base = "inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1";
  if (s === "success") return `${base} bg-black text-white ring-black`;
  if (s === "blocked") return `${base} bg-white/60 text-[rgb(var(--lp-text))] ring-[rgb(var(--lp-border))]`;
  if (s === "failed") return `${base} bg-white/60 text-[rgb(var(--lp-muted))] ring-[rgb(var(--lp-border))]`;
  return `${base} bg-white/60 text-[rgb(var(--lp-muted))] ring-[rgb(var(--lp-border))]`;
}

function fmtInt(n: any) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x)) return "0";
  return new Intl.NumberFormat("nb-NO").format(Math.round(x));
}

function fmtMoney(n: any) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x)) return "0";
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(Math.round(x));
}

function safeJsonParse(s: string | null) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export default function InvoiceRunDetailClient({
  initialRun,
  initialRows,
  initialTotals,
}: {
  initialRun: Run;
  initialRows: Row[];
  initialTotals: Totals;
}) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [totals, setTotals] = useState<Totals>(initialTotals);

  const [showMissingOnly, setShowMissingOnly] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // bulk
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState<{
    upserted: number;
    failed: number;
    errors: Array<{ index: number; company_id?: string; reason: string }>;
  } | null>(null);

  // export log
  const [exportsOpen, setExportsOpen] = useState(true);
  const [exportLog, setExportLog] = useState<ExportLogRow[]>([]);
  const [exportLogLoading, setExportLogLoading] = useState(false);

  const viewRows = useMemo(() => {
    return showMissingOnly ? rows.filter((r) => r.export_status === "MISSING_CUSTOMER_ID") : rows;
  }, [rows, showMissingOnly]);

  async function loadExportLog() {
    setExportLogLoading(true);
    const res = await fetch(`/api/superadmin/invoices/runs/${initialRun.id}/exports`, { cache: "no-store" }).catch(
      () => null
    );

    if (!res || !res.ok) {
      setExportLogLoading(false);
      return;
    }

    const data = await res.json().catch(() => ({}));
    setExportLog(Array.isArray(data?.exports) ? data.exports : []);
    setExportLogLoading(false);
  }

  async function refresh() {
    setErr(null);

    const res = await fetch(`/api/superadmin/invoices/runs/${initialRun.id}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setErr(data?.message ?? "Kunne ikke oppdatere");
      return;
    }
    setRows(data.rows ?? []);
    setTotals(data.totals ?? initialTotals);

    await loadExportLog();
  }

  async function saveMapping(company_id: string, tripletex_customer_id: string) {
    const val = String(tripletex_customer_id ?? "").trim();
    if (!val.length) return;

    setSavingId(company_id);
    setErr(null);

    const res = await fetch("/api/superadmin/invoices/mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_id, tripletex_customer_id: val }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setSavingId(null);
      setErr(data?.message ?? "Kunne ikke lagre mapping");
      return;
    }

    // Oppdater lokalt raskt, så refresh for totals og reell status
    setRows((prev) =>
      prev.map((r) =>
        r.company_id === company_id
          ? { ...r, tripletex_customer_id: val, export_status: r.flags ? String(r.flags) : "OK" }
          : r
      )
    );

    setSavingId(null);
    await refresh();
  }

  async function downloadCsv() {
    setErr(null);

    const url = `/api/superadmin/invoices/export?runId=${encodeURIComponent(initialRun.id)}`;
    const res = await fetch(url, { method: "GET" });

    // Hard-stop: server returnerer JSON (409) med detail
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = data?.message ?? "Eksport stoppet.";

      const mc = data?.detail?.missingCustomerCount ?? data?.detail?.missingCustomer?.length ?? 0;
      const mp = data?.detail?.missingPriceCount ?? data?.detail?.missingPrice?.length ?? 0;

      let extra = "";
      if (mc || mp) extra = ` (mangler kunde-id: ${mc}, mangler pris: ${mp})`;

      setErr(`${msg}${extra}`);
      await loadExportLog();
      return;
    }

    // OK: server returnerer CSV (text/csv)
    const blob = await res.blob();

    // prøv å hente filnavn fra header
    const disp = res.headers.get("content-disposition") ?? "";
    const match = /filename="([^"]+)"/i.exec(disp);
    const filename = match?.[1] ?? `tripletex-export-${initialRun.id}.csv`;

    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);

    await loadExportLog();
  }

  function parseBulk(text: string) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const items: Array<{ company_id: string; tripletex_customer_id: string }> = [];
    const bad: Array<{ line: number; raw: string; reason: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];

      const parts = raw.includes(";")
        ? raw.split(";")
        : raw.includes("\t")
        ? raw.split("\t")
        : raw.includes(",")
        ? raw.split(",")
        : [];

      const company_id = String(parts[0] ?? "").trim();
      const tripletex_customer_id = String(parts[1] ?? "").trim();

      if (!company_id || !tripletex_customer_id) {
        bad.push({ line: i + 1, raw, reason: "Mangler company_id eller customer_id" });
        continue;
      }

      items.push({ company_id, tripletex_customer_id });
    }

    return { items, bad };
  }

  async function runBulkSave() {
    setErr(null);
    setBulkResult(null);

    const { items, bad } = parseBulk(bulkText);
    if (!items.length) {
      setErr("Ingen gyldige linjer funnet. Format: company_id;tripletex_customer_id");
      return;
    }

    const res = await fetch("/api/superadmin/invoices/mapping/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setErr(data?.message ?? "Bulk-lagring feilet");
      return;
    }

    setBulkResult({
      upserted: Number(data.upserted ?? 0),
      failed: Number(data.failed ?? 0),
      errors: Array.isArray(data.errors) ? data.errors : [],
    });

    await refresh();

    if (bad.length) {
      setErr(`Noen linjer var ufullstendige lokalt (${bad.length}). Resten ble forsøkt lagret.`);
    }
  }

  async function toggleExports() {
    const next = !exportsOpen;
    setExportsOpen(next);
    if (next && exportLog.length === 0) await loadExportLog();
  }

  const isExported = String(initialRun.status ?? "").toLowerCase() === "exported";

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-medium text-[rgb(var(--lp-text))]">
              Status: <span className="font-semibold">{initialRun.status}</span>
              {isExported ? <span className="ml-2 text-xs text-[rgb(var(--lp-muted))]">(låst)</span> : null}
            </div>

            <div className="text-xs text-[rgb(var(--lp-muted))]">
              Firma: {fmtInt(totals.companies)} • Porsjoner: {fmtInt(totals.billable)} • Sum eks mva:{" "}
              {fmtMoney(totals.amount)}
            </div>

            <div className="text-xs text-[rgb(var(--lp-muted))]">
              Mangler Tripletex-kunde-ID: <span className="font-semibold">{fmtInt(totals.missingCustomer)}</span>
              {totals.missingPrice ? (
                <>
                  {" "}
                  • Mangler pris: <span className="font-semibold">{fmtInt(totals.missingPrice)}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowMissingOnly((v) => !v)}
              className="rounded-xl bg-white/60 px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white"
            >
              {showMissingOnly ? "Vis alle" : "Vis kun mangler"}
            </button>

            <button
              onClick={() => setBulkOpen((v) => !v)}
              className="rounded-xl bg-white/60 px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white"
            >
              Bulk-paste
            </button>

            <button
              onClick={downloadCsv}
              className="rounded-xl bg-black px-4 py-2 text-sm text-white ring-1 ring-black hover:opacity-90"
            >
              Last ned CSV
            </button>

            <button
              onClick={refresh}
              className="rounded-xl bg-white/60 px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white"
            >
              Oppdater
            </button>
          </div>
        </div>

        {err ? <div className="mt-3 text-sm text-red-600">{err}</div> : null}
      </div>

      {/* Export log */}
      <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-[rgb(var(--lp-text))]">Eksportlogg</div>
            <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
              Viser eksportforsøk (success/blocked) for denne kjøringen.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleExports}
              className="rounded-xl bg-white/60 px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white"
            >
              {exportsOpen ? "Skjul" : "Vis"}
            </button>
            <button
              onClick={loadExportLog}
              className="rounded-xl bg-white/60 px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white"
            >
              Oppdater logg
            </button>
          </div>
        </div>

        {exportsOpen ? (
          <div className="mt-3 overflow-x-auto">
            {exportLogLoading ? (
              <div className="py-4 text-sm text-[rgb(var(--lp-muted))]">Laster logg…</div>
            ) : exportLog.length === 0 ? (
              <div className="py-4 text-sm text-[rgb(var(--lp-muted))]">Ingen eksportlogg ennå.</div>
            ) : (
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="text-xs text-[rgb(var(--lp-muted))]">
                  <tr className="[&>th]:pb-2">
                    <th>Tidspunkt</th>
                    <th>Status</th>
                    <th>Fil</th>
                    <th>Rader</th>
                    <th>Sum eks mva</th>
                    <th>Detalj</th>
                  </tr>
                </thead>
                <tbody className="text-[rgb(var(--lp-text))]">
                  {exportLog.map((e) => {
                    const d = safeJsonParse(e.detail);
                    const detailText =
                      String(e.status).toLowerCase() === "blocked" && d
                        ? `mangler kunde-id: ${d.missingCustomerCount ?? 0}, mangler pris: ${d.missingPriceCount ?? 0}`
                        : e.detail
                        ? String(e.detail).slice(0, 120)
                        : "";

                    return (
                      <tr key={e.id} className="border-t border-[rgb(var(--lp-border))]">
                        <td className="py-3 text-xs text-[rgb(var(--lp-muted))]">
                          {new Date(e.exported_at).toISOString()}
                        </td>
                        <td className="py-3">
                          <span className={chipExport(e.status)}>{e.status}</span>
                        </td>
                        <td className="py-3 text-xs text-[rgb(var(--lp-muted))]">{e.file_name ?? ""}</td>
                        <td className="py-3">{fmtInt(e.rows_count ?? 0)}</td>
                        <td className="py-3">{fmtMoney(e.amount_ex_vat ?? 0)}</td>
                        <td className="py-3 text-xs text-[rgb(var(--lp-muted))]">{detailText}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : null}
      </div>

      {/* Bulk panel */}
      {bulkOpen ? (
        <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-[rgb(var(--lp-text))]">Bulk-paste Tripletex kunde-id</div>
              <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                Format per linje: <span className="font-mono">company_id;tripletex_customer_id</span> (støtter også
                komma eller TAB)
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={runBulkSave}
                className="rounded-xl bg-black px-4 py-2 text-sm text-white ring-1 ring-black hover:opacity-90"
              >
                Lagre alle
              </button>
              <button
                onClick={() => {
                  setBulkText("");
                  setBulkResult(null);
                  setErr(null);
                }}
                className="rounded-xl bg-white/60 px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white"
              >
                Tøm
              </button>
            </div>
          </div>

          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`9fa14ac8-1010-4f4e-95b8-a37c1aaeb02f;12345\n881ec4a5-02ad-4571-a325-3f2ac4c2c8d9;67890`}
            className="mt-3 h-44 w-full rounded-2xl bg-white/60 p-3 text-sm ring-1 ring-[rgb(var(--lp-border))] outline-none focus:bg-white"
          />

          {bulkResult ? (
            <div className="mt-3 text-sm text-[rgb(var(--lp-text))]">
              Lagret: <span className="font-semibold">{fmtInt(bulkResult.upserted)}</span> • Feil:{" "}
              <span className="font-semibold">{fmtInt(bulkResult.failed)}</span>
              {bulkResult.errors?.length ? (
                <div className="mt-2 rounded-xl bg-white/60 p-3 text-xs ring-1 ring-[rgb(var(--lp-border))]">
                  <div className="font-medium">Feildetaljer (første 50)</div>
                  <ul className="mt-2 space-y-1">
                    {bulkResult.errors.slice(0, 50).map((e, idx) => (
                      <li key={`${idx}-${e.index}-${e.company_id ?? ""}`} className="font-mono">
                        #{Number(e.index ?? idx) + 1} {e.company_id ?? ""} → {e.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl bg-[rgb(var(--lp-surface))] ring-1 ring-[rgb(var(--lp-border))]">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="text-xs text-[rgb(var(--lp-muted))]">
            <tr className="[&>th]:px-4 [&>th]:py-3">
              <th>Firma</th>
              <th>Status</th>
              <th className="w-[260px]">Tripletex kunde-id</th>
              <th>Plan</th>
              <th>Pris</th>
              <th>Porsjoner</th>
              <th>Sum</th>
            </tr>
          </thead>

          <tbody className="text-[rgb(var(--lp-text))]">
            {viewRows.map((r) => (
              <tr key={r.id} className="border-t border-[rgb(var(--lp-border))]">
                <td className="px-4 py-3">
                  <div className="font-medium">{r.company_name ?? "Ukjent firma"}</div>
                  <div className="text-xs text-[rgb(var(--lp-muted))]">{r.company_id}</div>
                </td>

                <td className="px-4 py-3">
                  <span className={chip(r.export_status)}>{r.export_status}</span>
                </td>

                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      defaultValue={r.tripletex_customer_id ?? ""}
                      placeholder="f.eks. 12345"
                      className="w-full rounded-xl bg-white/60 px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] outline-none focus:bg-white"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = (e.currentTarget as HTMLInputElement).value;
                          saveMapping(r.company_id, val);
                        }
                      }}
                    />

                    <button
                      onClick={(e) => {
                        const input = e.currentTarget.parentElement?.querySelector("input") as HTMLInputElement | null;
                        saveMapping(r.company_id, input?.value ?? "");
                      }}
                      disabled={savingId === r.company_id}
                      className="rounded-xl bg-black px-3 py-2 text-xs text-white ring-1 ring-black hover:opacity-90 disabled:opacity-50"
                    >
                      {savingId === r.company_id ? "Lagrer…" : "Lagre"}
                    </button>
                  </div>

                  <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Trykk Enter for å lagre.</div>
                </td>

                <td className="px-4 py-3 text-xs text-[rgb(var(--lp-muted))]">{r.plan_tier ?? ""}</td>
                <td className="px-4 py-3">{r.price_ex_vat ?? ""}</td>
                <td className="px-4 py-3">{fmtInt(r.billable_qty ?? 0)}</td>
                <td className="px-4 py-3">{fmtMoney(r.amount_ex_vat ?? 0)}</td>
              </tr>
            ))}

            {!viewRows.length && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[rgb(var(--lp-muted))]">
                  Ingen rader i dette filteret.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
