"use client";

import { useState, useTransition } from "react";

type PlanTier = "BASIS" | "LUXUS";
type Props = {
  companyId: string;
  initialTier: PlanTier | null;
  initialAgreement: any | null;
};

export default function AgreementCard({ companyId, initialTier, initialAgreement }: Props) {
  const [tier, setTier] = useState<PlanTier>(initialTier ?? "BASIS");
  const [bindingMonths, setBindingMonths] = useState<number>(
    Number(initialAgreement?.contract?.binding_months ?? 12)
  );
  const [startDate, setStartDate] = useState<string>(
    initialAgreement?.contract?.start_date ?? new Date().toISOString().slice(0, 10)
  );
  const [note, setNote] = useState<string>(initialAgreement?.internal_note ?? "");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function save() {
    startTransition(async () => {
      setMsg(null);
      const res = await fetch("/api/superadmin/companies/agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({
          companyId,
          plan_tier: tier,
          start_date: startDate,
          binding_months: bindingMonths,
          delivery_days: ["mon", "tue", "wed", "thu", "fri"],
          note,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        setMsg(j?.message ?? "Kunne ikke lagre avtale.");
        return;
      }
      setMsg("Avtale oppdatert.");
    });
  }

  return (
    <div className="rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
      <div className="text-sm font-semibold">Avtale & binding</div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="block text-xs text-[rgb(var(--lp-muted))]">Plan</span>
          <select value={tier} onChange={(e) => setTier(e.target.value as PlanTier)} className="mt-1 w-full rounded-xl border px-3 py-2">
            <option value="BASIS">Basis</option>
            <option value="LUXUS">Luxus</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="block text-xs text-[rgb(var(--lp-muted))]">Binding (mnd)</span>
          <input type="number" value={bindingMonths} onChange={(e) => setBindingMonths(Number(e.target.value))} className="mt-1 w-full rounded-xl border px-3 py-2" />
        </label>

        <label className="text-sm">
          <span className="block text-xs text-[rgb(var(--lp-muted))]">Startdato</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="block text-xs text-[rgb(var(--lp-muted))]">Intern notat</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" rows={3} />
        </label>
      </div>

      {msg ? <div className="mt-3 text-sm">{msg}</div> : null}

      <div className="mt-4">
        <button onClick={save} disabled={pending} className="rounded-xl bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-60">
          {pending ? "Lagrerâ¦" : "Lagre avtale"}
        </button>
      </div>
    </div>
  );
}
