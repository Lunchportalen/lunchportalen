"use client";

import { useEffect, useMemo, useState } from "react";

type BatchStatus = "queued" | "packed" | "delivered";

type KitchenOrder = {
  id: string;
  full_name: string;
  department: string | null;
  note: string | null;
};

type KitchenGroup = {
  delivery_date: string; // YYYY-MM-DD
  delivery_window: string;
  company: string;
  location: string;
  company_location_id: string;
  batch_status: BatchStatus;
  packed_at: string | null;
  delivered_at: string | null;
  orders: KitchenOrder[];
};

async function setBatchStatus(payload: {
  delivery_date: string;
  delivery_window: string;
  company_location_id: string;
  status: BatchStatus;
}) {
  const res = await fetch("/api/kitchen/batch", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Kunne ikke oppdatere status");
  }
}

function StatusPill({ status }: { status: BatchStatus }) {
  const label = status === "queued" ? "Klar" : status === "packed" ? "Pakket" : "Levert";

  const cls =
    status === "queued"
      ? "border-slate-200 bg-slate-50 text-slate-900"
      : status === "packed"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-emerald-200 bg-emerald-50 text-emerald-900";

  const dot =
    status === "queued"
      ? "bg-slate-500"
      : status === "packed"
      ? "bg-amber-500"
      : "bg-emerald-500";

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        cls,
      ].join(" ")}
    >
      <span aria-hidden className={["h-2 w-2 rounded-full", dot].join(" ")} />
      {label}
    </span>
  );
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm transition",
        active
          ? "font-semibold shadow-sm"
          : "text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-bg))]",
      ].join(" ")}
      type="button"
    >
      {label}
    </button>
  );
}

function fmtOsloTime(ts?: string | null) {
  if (!ts) return "";
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      timeZone: "Europe/Oslo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

export default function KitchenView() {
  const [data, setData] = useState<KitchenGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [activeWindow, setActiveWindow] = useState<string>("ALL");
  const [onlyNotDelivered, setOnlyNotDelivered] = useState(false);

  const [busyKey, setBusyKey] = useState<string | null>(null); // per group action
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    try {
      setErr(null);
      const res = await fetch("/api/kitchen/day", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as KitchenGroup[];
      setData(json);
    } catch (e: any) {
      setErr(e?.message || "Kunne ikke hente bestillinger");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const windows = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((g) => set.add(g.delivery_window));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "nb"));
  }, [data]);

  const filteredGroups = useMemo(() => {
    let groups = data ?? [];

    if (activeWindow !== "ALL") {
      groups = groups.filter((g) => g.delivery_window === activeWindow);
    }

    if (onlyNotDelivered) {
      groups = groups.filter((g) => g.batch_status !== "delivered");
    }

    return groups;
  }, [data, activeWindow, onlyNotDelivered]);

  const totalKuverter = useMemo(() => {
    return filteredGroups.reduce((sum, g) => sum + (g.orders?.length ?? 0), 0);
  }, [filteredGroups]);

  const companyTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of filteredGroups) {
      const company = g.company || "Ukjent firma";
      const prev = map.get(company) ?? 0;
      map.set(company, prev + (g.orders?.length ?? 0));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "nb"));
  }, [filteredGroups]);

  const headerMeta = useMemo(() => {
    const d = filteredGroups[0]?.delivery_date || "";
    const windowsCount = new Set(filteredGroups.map((g) => g.delivery_window)).size;
    return { date: d, windowsCount };
  }, [filteredGroups]);

  async function mark(g: KitchenGroup, status: BatchStatus) {
    const key = `${g.delivery_date}:${g.delivery_window}:${g.company_location_id}`;
    setBusyKey(key);
    setToast(null);

    try {
      await setBatchStatus({
        delivery_date: g.delivery_date,
        delivery_window: g.delivery_window,
        company_location_id: g.company_location_id,
        status,
      });

      setToast(
        status === "packed"
          ? `Markert pakket • ${g.company} (${g.delivery_window})`
          : `Markert levert • ${g.company} (${g.delivery_window})`
      );

      await load();
    } catch (e: any) {
      setToast(e?.message || "Kunne ikke oppdatere status");
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-[rgb(var(--lp-muted))]">Laster kjøkkenliste…</p>;
  }
  if (err) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        {err}
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 text-sm text-[rgb(var(--lp-muted))]">
        Ingen aktive bestillinger i dag.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top controls */}
      <div className="print:hidden space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Chip active={activeWindow === "ALL"} label="Alle" onClick={() => setActiveWindow("ALL")} />
            {windows.map((w) => (
              <Chip key={w} active={activeWindow === w} label={w} onClick={() => setActiveWindow(w)} />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--lp-text))] shadow-sm hover:bg-[rgb(var(--lp-bg))]"
              type="button"
            >
              Skriv ut
            </button>
            <button
              onClick={() => load()}
              className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--lp-text))] shadow-sm hover:bg-[rgb(var(--lp-bg))]"
              type="button"
            >
              Oppdater
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-[rgb(var(--lp-text))]">
            <input
              type="checkbox"
              checked={onlyNotDelivered}
              onChange={(e) => setOnlyNotDelivered(e.target.checked)}
            />
            Kun ikke levert
          </label>

          <p className="text-sm text-[rgb(var(--lp-muted))]">
            Oppdateres automatisk hvert 30. sekund
          </p>

          {headerMeta.date ? (
            <span className="ml-auto text-sm text-[rgb(var(--lp-muted))]">
              <span className="font-semibold text-[rgb(var(--lp-text))]">Dato:</span> {headerMeta.date}
              <span className="mx-2">•</span>
              <span className="font-semibold text-[rgb(var(--lp-text))]">Vinduer:</span> {headerMeta.windowsCount}
            </span>
          ) : null}
        </div>
      </div>

      {/* Company totals */}
      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 text-sm print:rounded-none print:border-0 print:p-0">
        <div className="mb-2 font-semibold text-[rgb(var(--lp-text))]">Sum per firma (visning)</div>

        {companyTotals.length === 0 ? (
          <p className="text-[rgb(var(--lp-muted))]">Ingen data i valgt visning.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {companyTotals.map(([company, count]) => (
              <div
                key={company}
                className="flex items-center justify-between border-b border-[rgb(var(--lp-divider))] py-1 last:border-0"
              >
                <span className="text-[rgb(var(--lp-muted))]">{company}</span>
                <span className="font-semibold text-[rgb(var(--lp-text))]">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Groups */}
      {filteredGroups.map((g, i) => {
        const key = `${g.delivery_date}:${g.delivery_window}:${g.company_location_id}`;
        const isBusy = busyKey === key;

        return (
          <section
            key={`${g.delivery_window}:${g.company_location_id}:${i}`}
            className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 shadow-sm print:shadow-none print:rounded-none print:border-0 print:p-0 print:break-inside-avoid"
          >
            <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[rgb(var(--lp-text))]">
                  {g.delivery_window} – {g.company}
                </h2>
                <p className="text-sm text-[rgb(var(--lp-muted))]">{g.location}</p>

                <p className="mt-1 text-sm">
                  <span className="text-[rgb(var(--lp-muted))]">Kuverter:</span>{" "}
                  <span className="font-semibold text-[rgb(var(--lp-text))]">{g.orders.length}</span>
                </p>

                {(g.packed_at || g.delivered_at) && (
                  <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                    {g.packed_at ? `Pakket: ${fmtOsloTime(g.packed_at)}` : null}
                    {g.packed_at && g.delivered_at ? <span className="mx-2">•</span> : null}
                    {g.delivered_at ? `Levert: ${fmtOsloTime(g.delivered_at)}` : null}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <StatusPill status={g.batch_status} />

                <div className="flex gap-2 print:hidden">
                  <button
                    className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-semibold text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-bg))] disabled:opacity-60"
                    type="button"
                    disabled={isBusy || g.batch_status === "packed" || g.batch_status === "delivered"}
                    onClick={() => mark(g, "packed")}
                  >
                    {isBusy ? "Oppdaterer…" : "Marker pakket"}
                  </button>

                  <button
                    className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-semibold text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-bg))] disabled:opacity-60"
                    type="button"
                    disabled={isBusy || g.batch_status === "delivered"}
                    onClick={() => mark(g, "delivered")}
                  >
                    {isBusy ? "Oppdaterer…" : "Marker levert"}
                  </button>
                </div>
              </div>
            </header>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--lp-divider))]">
                  <th className="py-2 text-left font-semibold text-[rgb(var(--lp-text))]">Navn</th>
                  <th className="py-2 text-left font-semibold text-[rgb(var(--lp-text))]">Avdeling</th>
                  <th className="py-2 text-left font-semibold text-[rgb(var(--lp-text))]">Notat</th>
                </tr>
              </thead>
              <tbody>
                {g.orders.map((o, idx) => (
                  <tr key={`${o.id}:${idx}`} className="border-b border-[rgb(var(--lp-divider))] last:border-0">
                    <td className="py-2 text-[rgb(var(--lp-text))]">{o.full_name}</td>
                    <td className="py-2 text-[rgb(var(--lp-muted))]">{o.department || "–"}</td>
                    <td className="py-2 text-[rgb(var(--lp-text))]">{o.note || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      {/* Footer totals */}
      <div className="pt-2 text-sm print:hidden">
        <span className="text-[rgb(var(--lp-muted))]">Totalt (visning):</span>{" "}
        <span className="font-semibold text-[rgb(var(--lp-text))]">{totalKuverter}</span>
      </div>

      {toast && (
        <div className="print:hidden rounded-2xl border border-[rgb(var(--lp-border))] bg-white px-4 py-3 text-sm text-[rgb(var(--lp-text))]">
          {toast}
        </div>
      )}
    </div>
  );
}
