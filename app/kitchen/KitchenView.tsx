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
  delivery_date: string;
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
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Kunne ikke oppdatere status");
  }
}

function StatusPill({ status }: { status: BatchStatus }) {
  const label =
    status === "queued" ? "Klar" : status === "packed" ? "Pakket" : "Levert";
  return (
    <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs">
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
        "rounded-full border px-3 py-1 text-sm",
        active ? "font-semibold shadow-sm" : "opacity-80 hover:opacity-100",
      ].join(" ")}
      type="button"
    >
      {label}
    </button>
  );
}

export default function KitchenView() {
  const [data, setData] = useState<KitchenGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [activeWindow, setActiveWindow] = useState<string>("ALL");
  const [onlyNotDelivered, setOnlyNotDelivered] = useState(false);

  async function load() {
    try {
      setErr(null);
      const res = await fetch("/api/kitchen/today", { cache: "no-store" });
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
    const t = setInterval(load, 30000);
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

  // ✅ Sum per firma (i gjeldende visning)
  const companyTotals = useMemo(() => {
    const map = new Map<string, number>();

    for (const g of filteredGroups) {
      const company = g.company || "Ukjent firma";
      const prev = map.get(company) ?? 0;
      map.set(company, prev + (g.orders?.length ?? 0));
    }

    return Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], "nb")
    );
  }, [filteredGroups]);

  if (loading) return <p>Laster kjøkkenliste…</p>;
  if (err) return <p>{err}</p>;
  if (!data || data.length === 0) return <p>Ingen aktive bestillinger i dag.</p>;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="print:hidden space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip
            active={activeWindow === "ALL"}
            label="Alle"
            onClick={() => setActiveWindow("ALL")}
          />
          {windows.map((w) => (
            <Chip
              key={w}
              active={activeWindow === w}
              label={w}
              onClick={() => setActiveWindow(w)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => window.print()}
            className="rounded-lg border px-4 py-2 text-sm shadow-sm"
            type="button"
          >
            Skriv ut
          </button>
          <button
            onClick={() => load()}
            className="rounded-lg border px-4 py-2 text-sm shadow-sm"
            type="button"
          >
            Oppdater
          </button>

          <label className="ml-1 inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlyNotDelivered}
              onChange={(e) => setOnlyNotDelivered(e.target.checked)}
            />
            Kun ikke levert
          </label>

          <p className="text-sm opacity-70">
            Oppdateres automatisk hvert 30. sekund
          </p>
        </div>
      </div>

      {/* ✅ Company totals */}
      <div className="rounded-xl border p-4 text-sm print:rounded-none print:border-0 print:p-0">
        <div className="mb-2 font-semibold">Sum per firma (visning)</div>

        {companyTotals.length === 0 ? (
          <p className="opacity-70">Ingen data i valgt visning.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {companyTotals.map(([company, count]) => (
              <div
                key={company}
                className="flex items-center justify-between border-b py-1 last:border-0"
              >
                <span className="opacity-80">{company}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Groups */}
      {filteredGroups.map((g, i) => (
        <section
          key={`${g.delivery_window}:${g.company_location_id}:${i}`}
          className="rounded-xl border p-4 shadow-sm print:shadow-none print:rounded-none print:border-0 print:p-0 print:break-inside-avoid"
        >
          <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                {g.delivery_window} – {g.company}
              </h2>
              <p className="text-sm opacity-70">{g.location}</p>

              {/* Totalsum per gruppe */}
              <p className="mt-1 text-sm">
                <span className="opacity-70">Kuverter:</span>{" "}
                <span className="font-semibold">{g.orders.length}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <StatusPill status={g.batch_status} />

              <div className="flex gap-2 print:hidden">
                <button
                  className="rounded-lg border px-3 py-2 text-sm"
                  type="button"
                  onClick={async () => {
                    await setBatchStatus({
                      delivery_date: g.delivery_date,
                      delivery_window: g.delivery_window,
                      company_location_id: g.company_location_id,
                      status: "packed",
                    });
                    load();
                  }}
                >
                  Marker pakket
                </button>

                <button
                  className="rounded-lg border px-3 py-2 text-sm"
                  type="button"
                  onClick={async () => {
                    await setBatchStatus({
                      delivery_date: g.delivery_date,
                      delivery_window: g.delivery_window,
                      company_location_id: g.company_location_id,
                      status: "delivered",
                    });
                    load();
                  }}
                >
                  Marker levert
                </button>
              </div>
            </div>
          </header>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left">Navn</th>
                <th className="py-2 text-left">Avdeling</th>
                <th className="py-2 text-left">Notat</th>
              </tr>
            </thead>
            <tbody>
              {g.orders.map((o, idx) => (
                <tr key={`${o.id}:${idx}`} className="border-b last:border-0">
                  <td className="py-2">{o.full_name}</td>
                  <td className="py-2">{o.department || "–"}</td>
                  <td className="py-2">{o.note || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {/* Footer totals */}
      <div className="pt-2 text-sm print:hidden">
        <span className="opacity-70">Totalt (visning):</span>{" "}
        <span className="font-semibold">{totalKuverter}</span>
      </div>
    </div>
  );
}
