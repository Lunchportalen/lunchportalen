"use client";

// components/billing/MarketApprovalClient.tsx — FASE 10 superadmin-handlinger.
// Eksplisitte statusoverganger i markedsgodkjenningsregisteret. Fail-closed:
// kun lovlige overganger tilbys; ACTIVATION_BLOCKED krever begrunnelse.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const NEXT_TRANSITIONS: Record<string, string[]> = {
  TECHNICALLY_READY: ["TAX_REVIEW_PENDING", "ACTIVATION_BLOCKED"],
  TAX_REVIEW_PENDING: ["TAX_APPROVED", "ACTIVATION_BLOCKED"],
  TAX_APPROVED: ["LEGAL_REVIEW_PENDING", "ACTIVATION_BLOCKED"],
  LEGAL_REVIEW_PENDING: ["LEGAL_APPROVED", "ACTIVATION_BLOCKED"],
  LEGAL_APPROVED: ["ACTIVE", "ACTIVATION_BLOCKED"],
  ACTIVE: ["ACTIVATION_BLOCKED"],
  ACTIVATION_BLOCKED: ["TECHNICALLY_READY"],
};

const STATUS_LABELS: Record<string, string> = {
  TECHNICALLY_READY: "Teknisk klar",
  TAX_REVIEW_PENDING: "Skattegjennomgang pågår",
  TAX_APPROVED: "Skatt godkjent",
  LEGAL_REVIEW_PENDING: "Juridisk gjennomgang pågår",
  LEGAL_APPROVED: "Juridisk godkjent",
  ACTIVATION_BLOCKED: "Aktivering blokkert",
  ACTIVE: "Aktiv",
};

export function marketApprovalStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export default function MarketApprovalClient({ countryCode, status }: { countryCode: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const options = NEXT_TRANSITIONS[status] ?? [];

  function transition(newStatus: string) {
    setError(null);
    let reason: string | null = null;
    if (newStatus === "ACTIVATION_BLOCKED") {
      reason = window.prompt(`Begrunnelse for å blokkere ${countryCode}:`)?.trim() || null;
      if (!reason) return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/superadmin/markets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ countryCode, newStatus, reason }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.ok === false) throw new Error(String(json?.message ?? `Feil (${res.status})`));
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((next) => (
        <button
          key={next}
          type="button"
          disabled={pending}
          onClick={() => transition(next)}
          className="inline-flex min-h-[44px] items-center rounded-full border border-neutral-200 bg-white px-3 text-xs font-semibold disabled:opacity-50"
        >
          → {STATUS_LABELS[next] ?? next}
        </button>
      ))}
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </div>
  );
}
