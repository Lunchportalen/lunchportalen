"use client";

import { useState } from "react";
import {
  NorwayLegalClickwrap,
  type NorwayLegalAcceptancePayload,
} from "@/components/legal/NorwayLegalClickwrap";

type Props = {
  userId: string;
  companyId: string | null;
  onAccepted?: () => void;
};

export function EmployeeNorwayLegalGate({ userId, companyId, onAccepted }: Props) {
  const [payload, setPayload] = useState<NorwayLegalAcceptancePayload[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!payload?.length) {
      setError("Du må akseptere alle vilkår.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      for (const item of payload) {
        const res = await fetch("/api/legal/norway/accept", {
          method: "POST",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            subjectType: "employee",
            subjectId: userId,
            organizationId: companyId,
            documentType: item.documentType,
            documentVersion: item.documentVersion,
            documentChecksum: item.documentChecksum,
            accepted: true,
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          setError(String(json?.message || "Kunne ikke lagre aksept."));
          setPending(false);
          return;
        }
      }
      onAccepted?.();
      window.location.reload();
    } catch {
      setError("Uventet feil ved lagring av aksept.");
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-8">
      <h1 className="text-xl font-semibold text-[#181715]">Aksept av vilkår</h1>
      <p className="text-sm text-[#6f6657]">Du må akseptere gjeldende norske vilkår før ukevisningen åpnes.</p>
      <NorwayLegalClickwrap role="employee" onChange={setPayload} />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="button"
        disabled={pending || !payload?.length}
        onClick={() => void submit()}
        className="min-h-12 w-full rounded-full bg-[#181715] px-5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Lagrer…" : "Bekreft og fortsett"}
      </button>
    </div>
  );
}
