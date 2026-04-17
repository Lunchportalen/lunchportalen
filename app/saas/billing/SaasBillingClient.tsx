"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type BillingPayload = {
  companyId: string | null;
  companyName: string | null;
  saasPlan: string | null;
  subscription: {
    plan?: string | null;
    status?: string | null;
    current_period_end?: string | null;
    stripe_customer_id?: string | null;
  } | null;
};

export default function SaasBillingClient() {
  const [data, setData] = useState<BillingPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    const res = await fetch("/api/saas/billing", { credentials: "include" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j?.ok) {
      setErr(typeof j?.message === "string" ? j.message : "Kunne ikke hente faktureringsdata.");
      return;
    }
    setData(j.data as BillingPayload);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openPortal() {
    setPortalBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/saas/billing", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ action: "portal" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setErr(typeof j?.message === "string" ? j.message : "Kunne ikke åpne portal.");
        return;
      }
      const url = j?.data?.url;
      if (typeof url === "string" && url.length) window.location.assign(url);
      else setErr("Mangler portal-lenke.");
    } finally {
      setPortalBusy(false);
    }
  }

  if (!data && !err) {
    return <p className="text-center text-sm text-[rgb(var(--lp-muted))]">Laster …</p>;
  }

  if (err && !data) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-red-600">{err}</p>
        <Link href="/saas/onboarding" className="inline-block min-h-[44px] rounded-full border border-[rgba(var(--lp-border),0.85)] px-4 py-2.5 text-base">
          Opprett firma
        </Link>
      </div>
    );
  }

  const sub = data?.subscription;
  const period = sub?.current_period_end ? new Date(sub.current_period_end).toLocaleString("nb-NO") : "—";

  return (
    <div className="mx-auto w-full max-w-md space-y-6 text-center">
      <dl className="space-y-2 text-left text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-[rgb(var(--lp-muted))]">Firma</dt>
          <dd className="font-medium">{data?.companyName ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[rgb(var(--lp-muted))]">Plan (firma)</dt>
          <dd className="font-medium">{data?.saasPlan ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[rgb(var(--lp-muted))]">Abonnementsstatus</dt>
          <dd className="font-medium">{sub?.status ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[rgb(var(--lp-muted))]">Neste periode slutt</dt>
          <dd className="font-medium">{period}</dd>
        </div>
      </dl>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      <button
        type="button"
        disabled={portalBusy || !sub?.stripe_customer_id}
        onClick={() => void openPortal()}
        className="lp-btn-primary min-h-[44px] w-full rounded-full px-4 py-2.5 text-base font-medium disabled:opacity-60"
      >
        {portalBusy ? "Åpner portal …" : "Åpne faktureringsportal"}
      </button>
      {!sub?.stripe_customer_id ? (
        <p className="text-xs text-[rgb(var(--lp-muted))]">Kunde hos betalingsleverandør mangler. Fullfør onboarding eller konfigurer Stripe.</p>
      ) : null}
      <Link
        href="/saas/plans"
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-[rgba(var(--lp-border),0.85)] px-4 py-2.5 text-base text-[rgb(var(--lp-text))]"
      >
        Velg annen plan
      </Link>
    </div>
  );
}
