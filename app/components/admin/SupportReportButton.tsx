// components/admin/SupportReportButton.tsx
"use client";

import { useState, useTransition } from "react";

type Props = {
  reason: string;
  companyId?: string | null;
  locationId?: string | null;
};

export default function SupportReportButton({ reason, companyId, locationId }: Props) {
  const [doneRid, setDoneRid] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function send() {
    setErr(null);
    setDoneRid(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/support/report", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            reason,
            path: window.location.pathname,
            company_id: companyId ?? null,
            location_id: locationId ?? null,
          }),
        });

        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.ok) {
          setErr(json?.message ?? "Kunne ikke sende rapport.");
          return;
        }
        setDoneRid(String(json.rid ?? ""));
      } catch {
        setErr("Kunne ikke sende rapport (nettverksfeil).");
      }
    });
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={send}
        disabled={isPending}
        className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90 disabled:opacity-60"
      >
        {isPending ? "Sender…" : "Send systemrapport"}
      </button>

      {doneRid ? (
        <div className="mt-3 text-xs text-[rgb(var(--lp-muted))]">
          Rapport sendt. RID: <span className="font-mono">{doneRid}</span>
        </div>
      ) : null}

      {err ? <div className="mt-3 text-xs text-red-700">{err}</div> : null}
    </div>
  );
}
