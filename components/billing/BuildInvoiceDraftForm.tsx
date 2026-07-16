"use client";

// FASE 8 — bygg fakturautkast fra leverte ordre for valgt firma + periode.
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BuildInvoiceDraftForm({ companies }: { companies: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function build() {
    if (busy) return;
    setError(null);
    if (!companyId || !periodStart || !periodEnd) {
      setError("Velg firma og periode.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/provider/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId, period_start: periodStart, period_end: periodEnd }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok !== true) {
        setError(String(json?.message ?? "Kunne ikke bygge fakturautkast."));
        return;
      }
      const invoiceId = String(json?.data?.invoice_id ?? "");
      if (invoiceId) router.push(`/leverandor/fakturaer/${invoiceId}`);
      else router.refresh();
    } catch {
      setError("Uventet feil.");
    } finally {
      setBusy(false);
    }
  }

  const field = "min-h-[44px] rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm";

  return (
    <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4" data-lp-build-draft>
      <p className="text-sm font-semibold text-neutral-900">Nytt fakturautkast (leverte ordre)</p>
      {error ? <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-900">{error}</p> : null}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium">
          Firma
          <select className={`${field} block`} name="draft_company" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          Fra dato
          <input className={`${field} block`} type="date" name="draft_from" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </label>
        <label className="text-xs font-medium">
          Til dato
          <input className={`${field} block`} type="date" name="draft_to" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </label>
        <button
          type="button"
          name="build-invoice-draft"
          onClick={() => void build()}
          disabled={busy}
          className="min-h-[44px] rounded-full bg-neutral-950 px-5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? "Bygger …" : "Bygg utkast"}
        </button>
      </div>
    </section>
  );
}
