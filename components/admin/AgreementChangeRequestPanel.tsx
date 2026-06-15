"use client";

import { useMemo, useState, useTransition } from "react";

import { Card } from "@/components/ui/card";
import type { DayKey, Tier } from "@/lib/admin/agreement/types";

const DAY_OPTIONS: Array<{ key: DayKey; label: string }> = [
  { key: "mon", label: "Mandag" },
  { key: "tue", label: "Tirsdag" },
  { key: "wed", label: "Onsdag" },
  { key: "thu", label: "Torsdag" },
  { key: "fri", label: "Fredag" },
];

const PACKAGE_OPTIONS: Array<{ value: Tier; label: string }> = [
  { value: "BASIS", label: "Basis" },
  { value: "LUXUS", label: "Luxus" },
  { value: "ENTERPRISE", label: "Enterprise" },
];

type Props = {
  companyId: string;
  activeDeliveryDays: DayKey[];
  disabled?: boolean;
};

type RequestRow = {
  id: string;
  status: string;
  effective_from: string;
  requested_change: { day_overrides?: Record<string, { package?: Tier }> };
  note?: string | null;
  created_at?: string;
};

function formatStatus(status: string) {
  if (status === "PENDING_PROVIDER_APPROVAL") return "Venter leverandør";
  if (status === "PENDING_SUPERADMIN_APPROVAL") return "Venter superadmin";
  if (status === "APPROVED") return "Godkjent";
  if (status === "REJECTED") return "Avvist";
  if (status === "CANCELLED") return "Kansellert";
  return status;
}

export default function AgreementChangeRequestPanel({ companyId, activeDeliveryDays, disabled }: Props) {
  const [weekday, setWeekday] = useState<DayKey>(activeDeliveryDays[0] ?? "mon");
  const [pkg, setPkg] = useState<Tier>("ENTERPRISE");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [pending, startTransition] = useTransition();

  const selectableDays = useMemo(
    () => DAY_OPTIONS.filter((d) => activeDeliveryDays.includes(d.key)),
    [activeDeliveryDays],
  );

  async function refreshRequests() {
    const res = await fetch("/api/admin/agreement/change-requests", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (json?.ok && Array.isArray(json?.data?.requests)) {
      setRequests(json.data.requests);
    }
  }

  function submit() {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/agreement/change-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            effectiveFrom,
            note: note.trim() || null,
            requestedChange: {
              day_overrides: {
                [weekday]: { package: pkg },
              },
            },
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          setError(json?.message ?? "Kunne ikke sende forespørsel.");
          return;
        }
        setMessage("Forespørsel sendt til godkjenning. Aktiv avtale er uendret til den trer i kraft.");
        setNote("");
        await refreshRequests();
      } catch {
        setError("Nettverksfeil. Prøv igjen.");
      }
    });
  }

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="lp-h2">Foreslå avtaleendring</h2>
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Send en kontrollert endringsforespørsel med ønsket ikrafttredelsesdato. Endringen gjelder ikke før den er godkjent.
        </p>
      </div>

      {selectableDays.length === 0 ? (
        <p className="text-sm text-[rgb(var(--lp-muted))]">Ingen aktive leveringsdager å endre.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-xs uppercase tracking-[0.08em] text-[rgb(var(--lp-muted))]">Ukedag</span>
            <select
              className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2"
              value={weekday}
              onChange={(e) => setWeekday(e.target.value as DayKey)}
              disabled={disabled || pending}
            >
              {selectableDays.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-xs uppercase tracking-[0.08em] text-[rgb(var(--lp-muted))]">Ny pakke</span>
            <select
              className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2"
              value={pkg}
              onChange={(e) => setPkg(e.target.value as Tier)}
              disabled={disabled || pending}
            >
              {PACKAGE_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-xs uppercase tracking-[0.08em] text-[rgb(var(--lp-muted))]">Gjelder fra</span>
            <input
              type="date"
              className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              disabled={disabled || pending}
            />
          </label>

          <label className="grid gap-1 text-sm md:col-span-2">
            <span className="text-xs uppercase tracking-[0.08em] text-[rgb(var(--lp-muted))]">Notat (valgfritt)</span>
            <textarea
              className="min-h-[88px] rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={disabled || pending}
              placeholder="Kort begrunnelse for endringen"
            />
          </label>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="lp-btn lp-btn--primary lp-neon-focus"
          onClick={submit}
          disabled={disabled || pending || !effectiveFrom || selectableDays.length === 0}
        >
          {pending ? "Sender …" : "Send endringsforespørsel"}
        </button>
        <button
          type="button"
          className="lp-btn lp-btn--secondary"
          onClick={() => startTransition(refreshRequests)}
          disabled={pending}
        >
          Oppdater liste
        </button>
      </div>

      {message ? <p className="mt-3 text-sm text-[rgb(var(--lp-text))]">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {requests.length > 0 ? (
        <div className="mt-6">
          <div className="text-xs uppercase tracking-[0.08em] text-[rgb(var(--lp-muted))]">Siste forespørsler</div>
          <ul className="mt-2 grid gap-2">
            {requests.slice(0, 5).map((r) => {
              const overrideDay = Object.keys(r.requested_change?.day_overrides ?? {})[0] ?? "—";
              const overridePkg = r.requested_change?.day_overrides?.[overrideDay]?.package ?? "—";
              return (
                <li key={r.id} className="rounded-xl border border-[rgb(var(--lp-border))] bg-white/70 px-3 py-2 text-sm">
                  <div>
                    {overrideDay}: {overridePkg} · fra {r.effective_from}
                  </div>
                  <div className="text-xs text-[rgb(var(--lp-muted))]">{formatStatus(r.status)}</div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <input type="hidden" value={companyId} readOnly aria-hidden />
    </Card>
  );
}
