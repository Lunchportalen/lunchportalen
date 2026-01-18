"use client";
import { useEffect, useState } from "react";

export default function DriverPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/driver/today", { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ ok: false }));
  }, []);

  if (!data) return <main className="p-6">Laster…</main>;
  if (!data.ok) return <main className="p-6">Ingen tilgang.</main>;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">Leveringer i dag</h1>
      <p className="mt-2 text-sm opacity-70">{data.date}</p>

      <div className="mt-6 space-y-4">
        {data.deliveries.map((d: any) => (
          <div key={d.locationId} className="rounded-2xl border border-border bg-white p-4">
            <div className="font-semibold">{d.companyName} – {d.locationName}</div>
            <div className="mt-1 text-sm opacity-80">{d.address}</div>

            <div className="mt-3 text-sm">
              <div><strong>Totals:</strong> Basis {d.totals.basis} • Luxus {d.totals.luxus}</div>
              <div><strong>Leveringsvindu:</strong> {d.windowFrom ?? "–"} – {d.windowTo ?? "–"}</div>
              <div><strong>Kontakt:</strong> {d.contactName ?? "–"} • {d.contactPhone ?? "–"}</div>
              {d.deliveryNotes ? <div className="mt-2"><strong>Notat:</strong> {d.deliveryNotes}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
