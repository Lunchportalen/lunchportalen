"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

export default function RegistrationDecisionActions({ agreementId }: { agreementId: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function postDecision(action: "approve" | "reject") {
    const aid = safeStr(agreementId);
    if (!aid) {
      setError("Mangler avtale-ID.");
      return;
    }

    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/superadmin/agreements/${encodeURIComponent(aid)}/${action}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        cache: "no-store",
        body: action === "reject" ? JSON.stringify({ reason }) : "{}",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok !== true) {
        setError(safeStr(json?.message) || `Kunne ikke ${action === "approve" ? "godkjenne" : "avslå"}.`);
        return;
      }
      setModalOpen(false);
      setReason("");
      router.refresh();
    } catch {
      setError("Nettverksfeil.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={!agreementId || busy !== null}
          onClick={() => postDecision("approve")}
          className="inline-flex min-h-[44px] items-center rounded-xl border bg-white px-3 py-2 text-xs font-semibold hover:bg-neutral-50 disabled:opacity-50"
        >
          {busy === "approve" ? "Godkjenner..." : "Godkjenn"}
        </button>
        <button
          type="button"
          disabled={!agreementId || busy !== null}
          onClick={() => setModalOpen(true)}
          className="inline-flex min-h-[44px] items-center rounded-xl border bg-white px-3 py-2 text-xs font-semibold hover:bg-neutral-50 disabled:opacity-50"
        >
          Avvis
        </button>
      </div>
      {error ? <p className="max-w-[220px] text-right text-xs font-medium text-red-700">{error}</p> : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 text-left shadow-xl">
            <h2 className="text-lg font-semibold text-neutral-900">Avvis registrering</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Intern merknad lagres på registreringen. E-posten til firmaet bruker fast, hyggelig tekst.
            </p>
            <label className="mt-4 block text-sm font-medium text-neutral-800">
              Intern merknad
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--lp-ring))]"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={busy !== null}
                className="min-h-[44px] rounded-xl border bg-white px-4 text-sm font-semibold"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={() => postDecision("reject")}
                disabled={busy !== null}
                className="min-h-[44px] rounded-xl border bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy === "reject" ? "Avviser..." : "Avvis"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
