"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { KitchenGroup } from "@/lib/kitchen/grouping";

const OSLO_TZ = "Europe/Oslo" as const;

function addDaysISO(iso: string, deltaDays: number) {
  // iso er YYYY-MM-DD. Bruk "T00:00:00" og returner ny ISO-dato (YYYY-MM-DD).
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function todayOsloISO() {
  // Stabil "today" i Europe/Oslo uansett klientens lokale TZ.
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: OSLO_TZ }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function escapeCsv(v: unknown) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function sanitizeFilePart(s: string) {
  // Unngå rare tegn i filnavn (Windows/macOS).
  return (s || "ukjent")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function csvForGroup(dateISO: string, g: KitchenGroup) {
  const header = ["date", "window", "company", "location", "address", "time_oslo", "name", "department", "note"];

  const lines = g.orders.map((o) => [
    dateISO,
    g.deliveryWindow,
    g.company.name,
    g.location.label,
    `${g.location.addressLine1}, ${g.location.postalCode} ${g.location.city}`,
    o.timeOslo ?? "",
    o.name,
    o.department ?? "",
    (o.note ?? "").replace(/\r?\n/g, " ").trim(),
  ]);

  return [header, ...lines].map((row) => row.map(escapeCsv).join(",")).join("\n");
}

export default function KitchenClient(props: {
  dateISO: string;
  total: number;
  menuText: string;
  allergens: string[];
  groups: KitchenGroup[];
}) {
  const router = useRouter();
  const [date, setDate] = useState(props.dateISO);

  const allCsv = useMemo(() => {
    const header = ["date", "window", "company", "location", "address", "time_oslo", "name", "department", "note"];
    const rows: string[][] = [];

    for (const g of props.groups) {
      for (const o of g.orders) {
        rows.push([
          props.dateISO,
          g.deliveryWindow,
          g.company.name,
          g.location.label,
          `${g.location.addressLine1}, ${g.location.postalCode} ${g.location.city}`,
          o.timeOslo ?? "",
          o.name,
          o.department ?? "",
          (o.note ?? "").replace(/\r?\n/g, " ").trim(),
        ]);
      }
    }

    return [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
  }, [props.dateISO, props.groups]);

  const go = useCallback(
    (dateISO: string) => {
      router.push(`/admin/kjokken?date=${encodeURIComponent(dateISO)}`);
      router.refresh();
    },
    [router]
  );

  const applyDate = useCallback(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    go(date);
  }, [date, go]);

  const download = useCallback((text: string, filename: string) => {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }, []);

  const printPage = useCallback(() => {
    window.print();
  }, []);

  return (
    <main className="p-6">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Kjøkkenoversikt</h1>
          <p className="mt-2 text-sm opacity-80">Gruppert per leveringsvindu → firma → lokasjon. (Admin)</p>

          <div className="mt-2 text-sm opacity-80">
            <span className="opacity-70">Dato:</span>{" "}
            <span className="font-medium">{props.dateISO}</span>{" "}
            <span className="opacity-70">• Totalt:</span>{" "}
            <span className="font-medium">{props.total}</span>
          </div>
        </div>

        <div className="no-print flex items-end gap-3 flex-wrap">
          <label className="text-sm">
            <div className="opacity-80">Dato</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-2 rounded-lg border border-white/15 bg-transparent px-3 py-2 outline-none"
            />
          </label>

          <button
            onClick={applyDate}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/5"
          >
            Oppdater
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => go(addDaysISO(props.dateISO, -1))}
              className="rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/5"
              title="Forrige dag"
            >
              ←
            </button>
            <button
              onClick={() => go(todayOsloISO())}
              className="rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/5"
              title="I dag"
            >
              I dag
            </button>
            <button
              onClick={() => go(addDaysISO(props.dateISO, 1))}
              className="rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/5"
              title="Neste dag"
            >
              →
            </button>
          </div>

          <a
            href={`/api/admin/orders?date=${encodeURIComponent(props.dateISO)}`}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/5"
          >
            JSON
          </a>

          <button
            onClick={() => download(allCsv, `kjokken-${props.dateISO}.csv`)}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/5"
            disabled={props.total === 0}
          >
            Eksporter CSV (alle)
          </button>

          <button
            onClick={printPage}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/5"
          >
            Print
          </button>
        </div>
      </div>

      <section className="mt-6 rounded-xl border border-white/15 p-4 lp-kitchen-card">
        <div className="text-sm opacity-70">Dagens meny</div>
        <div className="mt-2 font-medium">{props.menuText}</div>
        {props.allergens?.length ? (
          <div className="mt-1 text-sm opacity-70">Allergener: {props.allergens.join(", ")}</div>
        ) : null}
      </section>

      <div className="mt-6 grid gap-4">
        {props.groups.map((g) => {
          const filename = `kjokken-${props.dateISO}-${sanitizeFilePart(g.company.name)}-${sanitizeFilePart(
            g.location.label
          )}.csv`;

          return (
            <section key={g.key} className="rounded-xl border border-white/15 p-4 lp-kitchen-card">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-sm opacity-70">Leveringsvindu</div>
                  <div className="mt-1 text-xl font-bold">{g.deliveryWindow}</div>

                  <div className="mt-2 text-sm">
                    <span className="opacity-70">Firma:</span>{" "}
                    <span className="font-medium">{g.company.name}</span>
                  </div>

                  <div className="mt-1 text-sm">
                    <span className="opacity-70">Lokasjon:</span>{" "}
                    <span className="font-medium">{g.location.label}</span>{" "}
                    <span className="opacity-70">
                      — {g.location.addressLine1}, {g.location.postalCode} {g.location.city}
                    </span>
                  </div>
                </div>

                <div className="no-print flex items-center gap-3">
                  <div className="text-sm opacity-80">
                    <span className="opacity-70">Antall:</span>{" "}
                    <span className="font-medium">{g.count}</span>
                  </div>

                  <button
                    onClick={() => download(csvForGroup(props.dateISO, g), filename)}
                    className="rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/5"
                    disabled={g.count === 0}
                  >
                    CSV (gruppe)
                  </button>
                </div>
              </div>

              {g.count ? (
                <div className="mt-4 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="opacity-70">
                      <tr className="text-left">
                        <th className="py-2 pr-4">Tid</th>
                        <th className="py-2 pr-4">Navn</th>
                        <th className="py-2 pr-4">Avdeling</th>
                        <th className="py-2 pr-4">Notat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.orders.map((o) => (
                        <tr key={o.orderId} className="border-t border-white/10">
                          <td className="py-2 pr-4 whitespace-nowrap">{o.timeOslo || "—"}</td>
                          <td className="py-2 pr-4 font-medium">{o.name}</td>
                          <td className="py-2 pr-4 opacity-80">{o.department || "—"}</td>
                          <td className="py-2 pr-4">{o.note?.trim() ? o.note : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-3 text-sm opacity-70">Ingen bestillinger i denne gruppen.</div>
              )}
            </section>
          );
        })}

        {props.groups.length === 0 ? (
          <div className="mt-3 text-sm opacity-70">Ingen aktive bestillinger for denne datoen.</div>
        ) : null}
      </div>
    </main>
  );
}
