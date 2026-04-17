"use client";

import { useState } from "react";

type PlanKey = "basic" | "pro" | "enterprise";

function PlanCard(props: {
  title: string;
  blurb: string;
  plan: PlanKey;
  primary?: boolean;
  onChoose: (p: PlanKey) => void;
  busy: PlanKey | null;
}) {
  const { title, blurb, plan, primary, onChoose, busy } = props;
  const isBusy = busy === plan;
  return (
    <div
      className={`rounded-2xl border p-4 text-center ${
        primary ? "border-[rgba(255,0,127,0.35)] shadow-[var(--lp-shadow-soft)]" : "border-[rgba(var(--lp-border),0.75)]"
      }`}
    >
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <p className="font-body mt-2 text-sm text-[rgb(var(--lp-muted))]">{blurb}</p>
      <button
        type="button"
        disabled={isBusy || busy != null}
        onClick={() => onChoose(plan)}
        className={
          primary
            ? "lp-btn-primary mt-4 min-h-[44px] w-full rounded-full px-4 py-2.5 text-base font-medium disabled:opacity-60"
            : "mt-4 min-h-[44px] w-full rounded-full border border-[rgba(var(--lp-border),0.85)] bg-white px-4 py-2.5 text-base font-medium text-[rgb(var(--lp-text))] disabled:opacity-60"
        }
      >
        {isBusy ? "Åpner …" : "Velg"}
      </button>
    </div>
  );
}

export default function SaasPlansClient() {
  const [busy, setBusy] = useState<PlanKey | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function choose(plan: PlanKey) {
    setErr(null);
    setBusy(plan);
    try {
      const res = await fetch("/api/saas/billing", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ action: "checkout", plan }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setErr(typeof j?.message === "string" ? j.message : "Kunne ikke starte betaling.");
        return;
      }
      const url = j?.data?.url;
      if (typeof url === "string" && url.length) window.location.assign(url);
      else setErr("Mangler betalingslenke.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {err ? <p className="text-center text-sm text-red-600">{err}</p> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <PlanCard title="Basic" blurb="Kom i gang med kjernefunksjoner." plan="basic" onChoose={choose} busy={busy} />
        <PlanCard title="Pro" blurb="Anbefalt for de fleste firma." plan="pro" primary onChoose={choose} busy={busy} />
        <PlanCard title="Enterprise" blurb="Større behov og oppfølging." plan="enterprise" onChoose={choose} busy={busy} />
      </div>
    </div>
  );
}
