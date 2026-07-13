"use client";

// Fase 5: fakturaprofil for company_admin — leser og lagrer via
// /api/admin/company/billing (scoped server-side til eget firma).
import { useEffect, useState } from "react";

type Billing = {
  billing_email: string;
  billing_address: string;
  billing_postcode: string;
  billing_city: string;
  invoice_reference: string;
  cost_center: string;
  employee_count: string;
};

const EMPTY: Billing = {
  billing_email: "",
  billing_address: "",
  billing_postcode: "",
  billing_city: "",
  invoice_reference: "",
  cost_center: "",
  employee_count: "",
};

const fieldClass =
  "mt-1 w-full min-h-[44px] rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm text-[rgb(var(--lp-text))]";

export default function BillingProfileForm() {
  const [values, setValues] = useState<Billing>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/company/billing", { headers: { "cache-control": "no-store" } });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok === true && json?.data?.billing) {
          const b = json.data.billing;
          setValues({
            billing_email: String(b.billing_email ?? ""),
            billing_address: String(b.billing_address ?? ""),
            billing_postcode: String(b.billing_postcode ?? ""),
            billing_city: String(b.billing_city ?? ""),
            invoice_reference: String(b.invoice_reference ?? ""),
            cost_center: String(b.cost_center ?? ""),
            employee_count: b.employee_count != null ? String(b.employee_count) : "",
          });
        } else {
          setError(String(json?.message ?? "Kunne ikke hente fakturaprofil."));
        }
      } catch {
        setError("Kunne ikke hente fakturaprofil.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/company/billing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billing_email: values.billing_email,
          billing_address: values.billing_address,
          billing_postcode: values.billing_postcode,
          billing_city: values.billing_city,
          invoice_reference: values.invoice_reference,
          cost_center: values.cost_center,
          ...(values.employee_count ? { employee_count: Number(values.employee_count) } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok !== true) {
        setError(String(json?.message ?? "Kunne ikke lagre fakturaprofil."));
        return;
      }
      setSaved(true);
    } catch {
      setError("Uventet feil ved lagring.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="rounded-3xl border border-[rgb(var(--lp-border))] bg-white p-6 text-sm text-[rgb(var(--lp-muted))]">Henter fakturaprofil …</div>;
  }

  return (
    <form onSubmit={save} className="rounded-3xl border border-[rgb(var(--lp-border))] bg-white p-6">
      {error ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {saved ? (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Fakturaprofilen er lagret.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium">
          Fakturamottaker (e-post)
          <input className={fieldClass} name="billing_email" type="email" value={values.billing_email} onChange={(e) => setValues((p) => ({ ...p, billing_email: e.target.value }))} placeholder="faktura@firma.no" />
        </label>
        <label className="text-sm font-medium">
          Fakturareferanse / PO
          <input className={fieldClass} name="invoice_reference" value={values.invoice_reference} onChange={(e) => setValues((p) => ({ ...p, invoice_reference: e.target.value }))} placeholder="Valgfritt" />
        </label>
        <label className="text-sm font-medium">
          Kostnadssted
          <input className={fieldClass} name="cost_center" value={values.cost_center} onChange={(e) => setValues((p) => ({ ...p, cost_center: e.target.value }))} placeholder="Valgfritt" />
        </label>
        <label className="text-sm font-medium">
          Antall ansatte
          <input className={fieldClass} name="employee_count" inputMode="numeric" value={values.employee_count} onChange={(e) => setValues((p) => ({ ...p, employee_count: e.target.value.replace(/\D/g, "") }))} />
        </label>
        <label className="text-sm font-medium md:col-span-2">
          Fakturaadresse
          <input className={fieldClass} name="billing_address" value={values.billing_address} onChange={(e) => setValues((p) => ({ ...p, billing_address: e.target.value }))} />
        </label>
        <label className="text-sm font-medium">
          Postnummer
          <input className={fieldClass} name="billing_postcode" inputMode="numeric" value={values.billing_postcode} onChange={(e) => setValues((p) => ({ ...p, billing_postcode: e.target.value.replace(/\D/g, "").slice(0, 4) }))} />
        </label>
        <label className="text-sm font-medium">
          Poststed
          <input className={fieldClass} name="billing_city" value={values.billing_city} onChange={(e) => setValues((p) => ({ ...p, billing_city: e.target.value }))} />
        </label>
      </div>

      <button
        type="submit"
        name="save-billing"
        disabled={busy}
        className="mt-6 min-h-[44px] rounded-full bg-neutral-900 px-6 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Lagrer …" : "Lagre fakturaprofil"}
      </button>
    </form>
  );
}
