"use client";

import { useEffect, useState } from "react";

type KitchenGroup = {
  delivery_date: string;
  delivery_window: string;
  company: string;
  location: string;
  company_location_id: string;
  batch_status: "queued" | "packed" | "delivered";
  packed_at: string | null;
  delivered_at: string | null;
  orders: Array<{
    id: string;
    full_name: string;
    department: string | null;
    note: string | null;
  }>;
};

async function setBatchStatus(payload: {
  delivery_date: string;
  delivery_window: string;
  company_location_id: string;
  status: "queued" | "packed" | "delivered";
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

function StatusPill({ status }: { status: KitchenGroup["batch_status"] }) {
  const label =
    status === "queued" ? "Klar" : status === "packed" ? "Pakket" : "Levert";

  return (
    <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs">
      {label}
    </span>
  );
}

export default function KitchenView() {
  const [data, setData] = useState<KitchenGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setErr(null);
      const res = await fetch("/api/kitchen/today", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
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

  if (loading) return <p>Laster kjøkkenliste…</p>;
  if (err) return <p>{err}</p>;
  if (!data || data.length === 0) return <p>Ingen aktive bestillinger i dag.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg border px-4 py-2 text-sm shadow-sm"
        >
          Skriv ut
        </button>
        <button
          onClick={() => load()}
          className="rounded-lg border px-4 py-2 text-sm shadow-sm"
        >
          Oppdater
        </button>
        <p className="text-sm opacity-70">Oppdateres automatisk hvert 30. sekund</p>
      </div>

      {data.map((g, i) => (
        <section
          key={i}
          className="rounded-xl border p-4 shadow-sm print:shadow-none print:rounded-none print:border-0 print:p-0 print:break-inside-avoid"
        >
          <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                {g.delivery_window} – {g.company}
              </h2>
              <p className="text-sm opacity-70">{g.location}</p>
            </div>

            <div className="flex items-center gap-3">
              <StatusPill status={g.batch_status} />

              <div className="flex gap-2 print:hidden">
                <button
                  className="rounded-lg border px-3 py-2 text-sm"
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
                <tr key={idx} className="border-b last:border-0">
                  <td className="py-2">{o.full_name}</td>
                  <td className="py-2">{o.department || "–"}</td>
                  <td className="py-2">{o.note || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
