// components/admin/SupportReportButton.tsx
"use client";

import { useMemo, useState } from "react";

type Props = {
  reason: string;
  companyId?: string | null;
  locationId?: string | null;
  agreementId?: string | null;
  extra?: Record<string, any> | null;
  enableNote?: boolean;
  noteLabel?: string;
  notePlaceholder?: string;
  buttonLabel?: string;
  buttonClassName?: string;
};

export default function SupportReportButton({
  reason,
  companyId,
  locationId,
  agreementId,
  extra,
  enableNote,
  noteLabel,
  notePlaceholder,
  buttonLabel,
  buttonClassName,
}: Props) {
  const [doneRid, setDoneRid] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [note, setNote] = useState<string>("");

  const label = useMemo(() => buttonLabel || "Send systemrapport", [buttonLabel]);

  async function send() {
    if (isSending) return;
    setErr(null);
    setDoneRid(null);
    setIsSending(true);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch("/api/admin/support/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason,
          path: window.location.pathname,
          companyId: companyId ?? null,
          locationId: locationId ?? null,
          agreementId: agreementId ?? null,
          desiredChange: enableNote ? note : null,
          extra: extra ?? null,
        }),
        signal: controller.signal,
      });

      const json = await res.json().catch(() => null);
      const rid = String(json?.rid ?? "");

      if (!res.ok || !json?.ok) {
        setErr(`Kunne ikke sende systemrapport. RID: ${rid || "ikke tilgjengelig"}`);
        return;
      }

      setDoneRid(rid || "ikke tilgjengelig");
    } catch {
      setErr("Kunne ikke sende systemrapport. RID: ikke tilgjengelig");
    } finally {
      window.clearTimeout(timeout);
      setIsSending(false);
    }
  }

  return (
    <div>
      {enableNote ? (
        <div className="mb-3">
          <div className="text-xs font-semibold text-[rgb(var(--lp-muted))]">{noteLabel || "Ønsket endring (valgfri)"}</div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 px-3 py-2 text-sm text-[rgb(var(--lp-fg))] shadow-sm"
            placeholder={notePlaceholder || "Beskriv ønsket endring kort."}
          />
        </div>
      ) : null}
      <button
        type="button"
        onClick={send}
        disabled={isSending}
        className={
          buttonClassName ||
          "lp-btn lp-btn--secondary min-h-11 border border-[rgb(var(--lp-border))] bg-white/70 px-4 py-2 text-sm font-semibold"
        }
      >
        {isSending ? "Sender..." : label}
      </button>

      {doneRid ? (
        <div className="mt-3 text-xs text-[rgb(var(--lp-muted))]">
          Systemrapport sendt. RID: <span className="font-mono">{doneRid}</span>
        </div>
      ) : null}

      {err ? <div className="mt-3 text-xs text-red-700">{err}</div> : null}
    </div>
  );
}
