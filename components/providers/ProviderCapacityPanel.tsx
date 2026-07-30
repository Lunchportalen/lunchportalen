"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

type CapacityMode = "UNLIMITED" | "LIMITED" | "CLOSED";

type DayRow = {
  serviceDate: string;
  choiceKey: string;
  capacityMode: CapacityMode;
  capacityLimit: number | null;
  reservedQty: number;
  releasedQty: number;
  remainingQty: number | null;
};

type AuditRow = {
  id: string;
  service_date?: string | null;
  choice_key?: string | null;
  action: string;
  created_at: string;
};

function todayOslo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export default function ProviderCapacityPanel() {
  const [from, setFrom] = useState(todayOslo);
  const [to, setTo] = useState(() => addDaysISO(todayOslo(), 14));
  const [serviceDate, setServiceDate] = useState(todayOslo);
  const [mode, setMode] = useState<CapacityMode>("UNLIMITED");
  const [limit, setLimit] = useState("50");
  const [choiceKey, setChoiceKey] = useState("varmrett");
  const [days, setDays] = useState<DayRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [policyMode, setPolicyMode] = useState<string>("—");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      const res = await fetch(
        `/api/provider/capacity?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { credentials: "same-origin", headers: { Accept: "application/json" } },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(String(json?.message || "Kunne ikke hente kapasitet."));
        return;
      }
      setDays(Array.isArray(json.data?.days) ? json.data.days : []);
      setAudit(Array.isArray(json.data?.audit) ? json.data.audit : []);
      setPolicyMode(String(json.data?.policy?.defaultMode ?? "mangler"));
    });
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  function onSave(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const body = {
        serviceDate,
        choiceKey,
        capacityMode: mode,
        capacityLimit: mode === "LIMITED" ? Number(limit) : null,
        note: "provider_capacity_ui",
      };
      const res = await fetch("/api/provider/capacity", {
        method: "PUT",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(String(json?.message || "Kunne ikke lagre kapasitet."));
        return;
      }
      setMessage("Kapasitet lagret.");
      load();
    });
  }

  return (
    <div className="ds-section space-y-6">
      <div>
        <h2 className="ds-h3">Kapasitet</h2>
        <p className="ds-body">
          Eksplisitt kapasitet per leverandør og dag. Standardpolicy: <strong>{policyMode}</strong>.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="grid gap-1 text-sm">
          Fra
          <input
            type="date"
            className="rounded border px-3 py-2 min-h-11"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Til
          <input
            type="date"
            className="rounded border px-3 py-2 min-h-11"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="rounded-full border px-4 py-2 min-h-11 text-sm"
          onClick={load}
          disabled={pending}
        >
          Oppdater
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-3">Dato</th>
              <th className="py-2 pr-3">Valg</th>
              <th className="py-2 pr-3">Modus</th>
              <th className="py-2 pr-3">Grense</th>
              <th className="py-2 pr-3">Booket</th>
              <th className="py-2 pr-3">Frigitt</th>
              <th className="py-2 pr-3">Igjen</th>
            </tr>
          </thead>
          <tbody>
            {days.length === 0 ? (
              <tr>
                <td className="py-3 text-neutral-600" colSpan={7}>
                  Ingen dagsoverstyringer i perioden. Standardpolicy gjelder.
                </td>
              </tr>
            ) : (
              days.map((d) => (
                <tr key={`${d.serviceDate}:${d.choiceKey}`} className="border-b border-neutral-100">
                  <td className="py-2 pr-3">{d.serviceDate}</td>
                  <td className="py-2 pr-3">{d.choiceKey}</td>
                  <td className="py-2 pr-3">{d.capacityMode}</td>
                  <td className="py-2 pr-3">{d.capacityLimit ?? "—"}</td>
                  <td className="py-2 pr-3">{d.reservedQty}</td>
                  <td className="py-2 pr-3">{d.releasedQty}</td>
                  <td className="py-2 pr-3">{d.remainingQty ?? "∞"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={onSave} className="grid gap-3 max-w-xl">
        <h3 className="ds-h3">Sett kapasitet for dag</h3>
        <label className="grid gap-1 text-sm">
          Servicedato
          <input
            type="date"
            required
            className="rounded border px-3 py-2 min-h-11"
            value={serviceDate}
            onChange={(e) => setServiceDate(e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Valg (choice key)
          <input
            className="rounded border px-3 py-2 min-h-11"
            value={choiceKey}
            onChange={(e) => setChoiceKey(e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Modus
          <select
            className="rounded border px-3 py-2 min-h-11"
            value={mode}
            onChange={(e) => setMode(e.target.value as CapacityMode)}
          >
            <option value="UNLIMITED">Ubegrenset</option>
            <option value="LIMITED">Begrenset</option>
            <option value="CLOSED">Stengt</option>
          </select>
        </label>
        {mode === "LIMITED" ? (
          <label className="grid gap-1 text-sm">
            Kapasitet
            <input
              type="number"
              min={0}
              step={1}
              required
              className="rounded border px-3 py-2 min-h-11"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </label>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="justify-self-start rounded-full border px-5 py-2 min-h-11 text-sm font-medium hover:shadow-[0_0_0_3px_rgba(255,45,149,0.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff2d95]"
        >
          Lagre kapasitet
        </button>
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </form>

      <div>
        <h3 className="ds-h3">Revisjon</h3>
        <ul className="text-sm space-y-1 mt-2">
          {audit.length === 0 ? (
            <li className="text-neutral-600">Ingen revisjonshendelser ennå.</li>
          ) : (
            audit.slice(0, 12).map((a) => (
              <li key={a.id}>
                {String(a.created_at).slice(0, 19)} · {a.action}
                {a.service_date ? ` · ${a.service_date}` : ""}
                {a.choice_key ? ` · ${a.choice_key}` : ""}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
