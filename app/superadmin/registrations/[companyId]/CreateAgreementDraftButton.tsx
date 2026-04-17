"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export default function CreateAgreementDraftButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/superadmin/company-registrations/${encodeURIComponent(companyId)}/create-agreement-draft`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: "{}",
      });
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      if (!res.ok || json?.ok !== true) {
        const msg = safeStr(json?.message) || `Feil (HTTP ${res.status})`;
        setErr(msg);
        return;
      }
      const aid = safeStr(json?.data?.agreementId);
      if (aid) {
        router.push(`/superadmin/agreements/${encodeURIComponent(aid)}`);
        return;
      }
      setErr("Uventet svar fra server.");
    } catch {
      setErr("Nettverksfeil.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4">
      <div className="text-sm font-semibold">Avtaleutkast</div>
      <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
        Oppretter avtale i status <strong>Venter</strong> via samme RPC som superadmin-avtaler. Ukedags Basis/Luxus hentes fra{" "}
        <strong>company_registrations</strong> (slik firmaadmin registrerte dem), flettes inn i <strong>agreement_json.plan.days</strong>{" "}
        med priser fra CMS, deretter utledning og RPC. Firma <strong>aktiveres ikke</strong> automatisk. Neste eksplisitte steg er «Godkjenn
        avtale» på avtalesiden — da blir utkastet gjeldende aktiv avtale; firma settes aktivt i samme canonical RPC når modellen krever det.
        Mangler registrert plan, vises feilmelding.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={onClick}
        className="mt-3 inline-flex min-h-[44px] items-center rounded-2xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-50"
      >
        {busy ? "Oppretter…" : "Opprett avtaleutkast"}
      </button>
      {err ? <p className="mt-2 text-xs font-medium text-red-700">{err}</p> : null}
    </div>
  );
}
