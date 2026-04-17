"use client";

import type { LocationDraft } from "@/lib/onboarding/types";

type Props = {
  locations: LocationDraft[];
  onChange: (rows: LocationDraft[]) => void;
  error?: string | null;
};

export default function LocationStep({ locations, onChange, error }: Props) {
  function update(i: number, patch: Partial<LocationDraft>) {
    const next = locations.map((row, idx) => (idx === i ? { ...row, ...patch } : row));
    onChange(next);
  }

  function addRow() {
    onChange([...locations, { name: "", address: "", instructions: "" }]);
  }

  function removeRow(i: number) {
    if (locations.length <= 1) return;
    onChange(locations.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[rgb(var(--lp-muted))]">Navn og adresse er påkrevd for hver lokasjon. Instruks er valgfritt.</p>
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {error}
        </div>
      ) : null}

      <div className="space-y-6">
        {locations.map((row, i) => (
          <div key={i} className="rounded-2xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface))] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[rgb(var(--lp-fg))]">Lokasjon {i + 1}</span>
              {locations.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="min-h-[44px] rounded-full px-3 text-sm text-[rgb(var(--lp-muted))] underline-offset-2 hover:underline"
                >
                  Fjern
                </button>
              ) : null}
            </div>
            <div className="grid gap-3">
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--lp-muted))]" htmlFor={`loc-name-${i}`}>
                  Lokasjonsnavn
                </label>
                <input
                  id={`loc-name-${i}`}
                  value={row.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  className="mt-1 min-h-[48px] w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 text-sm"
                  autoComplete="organization"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--lp-muted))]" htmlFor={`loc-addr-${i}`}>
                  Adresse
                </label>
                <input
                  id={`loc-addr-${i}`}
                  value={row.address}
                  onChange={(e) => update(i, { address: e.target.value })}
                  className="mt-1 min-h-[48px] w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 text-sm"
                  autoComplete="street-address"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--lp-muted))]" htmlFor={`loc-ins-${i}`}>
                  Instruks (valgfritt)
                </label>
                <textarea
                  id={`loc-ins-${i}`}
                  value={row.instructions}
                  onChange={(e) => update(i, { instructions: e.target.value })}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="min-h-[44px] rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 text-sm font-medium text-[rgb(var(--lp-fg))]"
      >
        Legg til lokasjon
      </button>
    </div>
  );
}
