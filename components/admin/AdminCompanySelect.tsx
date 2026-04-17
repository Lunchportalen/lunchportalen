"use client";

import { useMemo, useRef, useState } from "react";
import type { AgreementPageCompany } from "@/lib/admin/agreement/types";

type AdminCompanySelectProps = {
  companies: AgreementPageCompany[];
  selectedId: string;
  label?: string;
};

function formatLabel(c: AgreementPageCompany) {
  const base = c.name ? String(c.name) : "Ukjent firma";
  const org = c.orgnr ? ` • ${c.orgnr}` : "";
  const loc = c.locationName ? ` — ${c.locationName}` : "";
  return `${base}${org}${loc}`;
}

export default function AdminCompanySelect({ companies, selectedId, label = "Firma" }: AdminCompanySelectProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [copied, setCopied] = useState(false);

  const selected = useMemo(() => companies.find((c) => c.id === selectedId) ?? companies[0], [companies, selectedId]);
  const copyLabel = copied ? "Kopiert" : "Kopier firma-ID";

  function handleChange() {
    if (formRef.current) formRef.current.requestSubmit();
  }

  async function handleCopy() {
    try {
      if (!selected?.id) return;
      await navigator.clipboard.writeText(selected.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  if (!companies.length) {
    return (
      <div className="text-sm text-[rgb(var(--lp-muted))]">
        Ingen firmadata tilgjengelig. Avtalen hentes alltid etter innlogget firmascope.
      </div>
    );
  }

  /** Ett firma (typisk company_admin): ingen «bytt firma»-affordance — scope er låst server-side. */
  if (companies.length === 1) {
    return (
      <div className="flex flex-col gap-1">
        <div className="text-xs uppercase tracking-[0.08em] text-[rgb(var(--lp-muted))]">{label} (eget firma)</div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 rounded-full border border-[rgb(var(--lp-border))] bg-white/80 px-3 py-2 text-sm text-[rgb(var(--lp-text))] shadow-sm">
            {formatLabel(selected)}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-full border border-[rgb(var(--lp-border))] bg-white/70 px-3 py-2 text-xs font-semibold text-[rgb(var(--lp-text))] hover:bg-white"
            title={selected?.id ?? ""}
          >
            {copyLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs uppercase tracking-[0.08em] text-[rgb(var(--lp-muted))]">{label}</div>
      <form ref={formRef} action="/admin/agreement" method="get" className="flex items-center gap-2">
        <select
          name="companyId"
          value={selectedId}
          onChange={handleChange}
          className="min-w-56 rounded-full border border-[rgb(var(--lp-border))] bg-white/80 px-3 py-2 text-sm text-[rgb(var(--lp-text))] shadow-sm"
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {formatLabel(c)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-full border border-[rgb(var(--lp-border))] bg-white/70 px-3 py-2 text-xs font-semibold text-[rgb(var(--lp-text))] hover:bg-white"
          title={selected?.id ?? ""}
        >
          {copyLabel}
        </button>
      </form>
    </div>
  );
}
