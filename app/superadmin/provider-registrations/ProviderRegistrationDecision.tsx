"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProviderRegistrationDecision({
  registrationId,
  companyName,
}: {
  registrationId: string;
  companyName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  async function approve() {
    if (busy) return;
    setError(null);
    setBusy("approve");
    try {
      const res = await fetch(`/api/superadmin/provider-registrations/${registrationId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok !== true) {
        setError(String(json?.message ?? "Kunne ikke godkjenne."));
        return;
      }
      router.refresh();
    } catch {
      setError("Uventet feil.");
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    if (busy) return;
    setError(null);
    setBusy("reject");
    try {
      const res = await fetch(`/api/superadmin/provider-registrations/${registrationId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok !== true) {
        setError(String(json?.message ?? "Kunne ikke avslå."));
        return;
      }
      router.refresh();
    } catch {
      setError("Uventet feil.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-w-[200px] flex-col items-stretch gap-2">
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={approve}
        disabled={busy !== null}
        className="min-h-[44px] rounded-full bg-neutral-900 px-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
      >
        {busy === "approve" ? "Godkjenner …" : `Godkjenn ${companyName}`}
      </button>
      {rejecting ? (
        <div className="space-y-2">
          <textarea
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            rows={2}
            placeholder="Intern begrunnelse (valgfritt)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            type="button"
            onClick={reject}
            disabled={busy !== null}
            className="min-h-[44px] w-full rounded-full border border-red-200 px-4 text-sm font-semibold text-red-700 disabled:opacity-60"
          >
            {busy === "reject" ? "Avslår …" : "Bekreft avslag"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRejecting(true)}
          disabled={busy !== null}
          className="min-h-[44px] rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-700 disabled:opacity-60"
        >
          Avslå
        </button>
      )}
    </div>
  );
}
