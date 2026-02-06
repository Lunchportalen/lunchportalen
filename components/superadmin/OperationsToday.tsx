// components/superadmin/OperationsToday.tsx
import { osloTodayISODate } from "@/lib/date/oslo";
import {
  listDeliveriesForDate,
  listForecastForDate,
  listWasteSignalsForDate,
  type DeliveryRow,
  type ForecastRow,
  type WasteSignalRow,
} from "@/lib/superadmin/queries";
import OperationsTodayActions from "./OperationsTodayActions";

type Grouped = {
  companyId: string;
  companyName: string;
  locations: {
    locationId: string | null;
    locationName: string;
    windows: {
      windowLabel: string;
      rows: DeliveryRow[];
      portions: number;
      notes: string[];
    }[];
    portions: number;
  }[];
  portions: number;
};

function safeName(v: any, fallback: string) {
  const s = String(v ?? "").trim();
  return s.length ? s : fallback;
}

function groupDeliveries(rows: DeliveryRow[]): { groups: Grouped[]; totalPortions: number } {
  const byCompany = new Map<string, Grouped>();
  let totalPortions = 0;

  for (const r of rows) {
    const companyId = String(r.company_id ?? "").trim() || "unknown_company";
    const companyName = safeName(r.company_name, "Ukjent firma");
    const locationId = r.location_id ?? null;
    const locationName = safeName(r.location_name, "Ukjent lokasjon");
    const windowLabel = safeName(r.window_label, "lunch");

    const portions = Number(r.portions ?? 0) || 0;
    totalPortions += portions;

    if (!byCompany.has(companyId)) {
      byCompany.set(companyId, { companyId, companyName, locations: [], portions: 0 });
    }
    const c = byCompany.get(companyId)!;

    let loc = c.locations.find((x) => x.locationId === locationId);
    if (!loc) {
      loc = { locationId, locationName, windows: [], portions: 0 };
      c.locations.push(loc);
    }

    let win = loc.windows.find((w) => w.windowLabel === windowLabel);
    if (!win) {
      win = { windowLabel, rows: [], portions: 0, notes: [] };
      loc.windows.push(win);
    }

    win.rows.push(r);
    win.portions += portions;
    loc.portions += portions;
    c.portions += portions;

    const note = String(r.notes ?? "").trim();
    if (note) win.notes.push(note);
  }

  const groups = Array.from(byCompany.values())
    .sort((a, b) => a.companyName.localeCompare(b.companyName, "nb"))
    .map((c) => ({
      ...c,
      locations: c.locations
        .sort((a, b) => a.locationName.localeCompare(b.locationName, "nb"))
        .map((l) => ({
          ...l,
          windows: l.windows.sort((a, b) => a.windowLabel.localeCompare(b.windowLabel, "nb")),
        })),
    }));

  return { groups, totalPortions };
}

function key(companyId: string, locationId: string | null, windowLabel: string) {
  return `${companyId}:${locationId ?? "null"}:${windowLabel}`;
}

function riskLabel(risk?: string) {
  if (risk === "high") return "Høy risiko";
  if (risk === "medium") return "Middels risiko";
  return "Lav risiko";
}

function riskChipClass(risk?: string) {
  if (risk === "high") return "lp-chip lp-chip-crit";
  if (risk === "medium") return "lp-chip lp-chip-warn";
  if (risk) return "lp-chip lp-chip-ok";
  return "lp-chip lp-chip-neutral";
}

function worstSignal(sigs: WasteSignalRow[]) {
  return (
    sigs.find((s) => s.severity === "critical") ??
    sigs.find((s) => s.severity === "warning") ??
    sigs.find((s) => s.severity === "info") ??
    null
  );
}

function signalChipClass(sev?: string) {
  if (sev === "critical") return "lp-chip lp-chip-crit";
  if (sev === "warning") return "lp-chip lp-chip-warn";
  if (sev === "info") return "lp-chip lp-chip-neutral";
  return "lp-chip lp-chip-neutral";
}

export default async function OperationsToday() {
  const todayISO = osloTodayISODate();

  const [rows, forecasts, signals] = await Promise.all([
    listDeliveriesForDate(todayISO),
    listForecastForDate(todayISO),
    listWasteSignalsForDate(todayISO),
  ]);

  const { groups, totalPortions } = groupDeliveries(rows);

  const forecastMap = new Map<string, ForecastRow>();
  for (const f of forecasts) {
    forecastMap.set(key(f.company_id, f.location_id, f.window_label), f);
  }

  const signalMap = new Map<string, WasteSignalRow[]>();
  for (const s of signals) {
    const k = key(s.company_id, s.location_id, s.window_label);
    const arr = signalMap.get(k) ?? [];
    arr.push(s);
    signalMap.set(k, arr);
  }

  const totalSignals = signals.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 rounded-2xl border bg-surface p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm text-muted">Dagens produksjon</div>
          <div className="mt-1 text-xl font-semibold">{todayISO} • {totalPortions} porsjoner</div>
          <div className="mt-1 text-sm text-muted">ACTIVE / READY FOR PRODUCTION</div>
          <div className="mt-1 text-xs text-muted">Dette er fasit. Ingen manuelle unntak.</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>
              Kilde: <span className="font-medium">public.deliveries</span> (én sannhet)
            </span>
            <span className="lp-chip lp-chip-neutral">Signals: {totalSignals}</span>
          </div>
        </div>

        {/* Client actions (print + CSV) */}
        <OperationsTodayActions dateISO={todayISO} />
      </div>

      {/* Body */}
      <div className="space-y-3">
        {groups.length === 0 ? (
          <div className="rounded-2xl border bg-surface p-6 text-sm text-muted">
            Ingen leveranser funnet for i dag.
          </div>
        ) : (
          groups.map((c) => (
            <div key={c.companyId} className="rounded-2xl border bg-surface p-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div className="text-lg font-semibold">{c.companyName}</div>
                <div className="text-sm text-muted">Totalt firma: {c.portions} porsjoner</div>
              </div>

              <div className="mt-3 space-y-3">
                {c.locations.map((l) => (
                  <div
                    key={`${c.companyId}:${l.locationId ?? "null"}`}
                    className="rounded-xl border bg-white p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{l.locationName}</div>
                      <div className="text-sm text-muted">Totalt lokasjon: {l.portions} porsjoner</div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {l.windows.map((w) => {
                        const uniqueNotes = Array.from(new Set(w.notes));
                        const k = key(c.companyId, l.locationId, w.windowLabel);

                        const f = forecastMap.get(k);
                        const sigs = signalMap.get(k) ?? [];
                        const worst = worstSignal(sigs);

                        return (
                          <div
                            key={w.windowLabel}
                            className="rounded-xl bg-bg p-3"
                            data-delivery-row
                            data-date={todayISO}
                            data-company={c.companyName}
                            data-location={l.locationName}
                            data-window={w.windowLabel}
                            data-portions={String(w.portions)}
                            data-notes={uniqueNotes.join(" • ")}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold">{w.windowLabel}</div>
                              <div className="text-sm font-semibold">{w.portions} porsjoner</div>
                            </div>

                            {/* Forecast (read-only, discreet) */}
                            {f ? (
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                <span className={riskChipClass(f.risk_level)}>{riskLabel(f.risk_level)}</span>
                                <span className="lp-chip lp-chip-neutral">
                                  Forecast: {f.forecast_portions} ({f.low_portions}–{f.high_portions})
                                </span>
                              </div>
                            ) : (
                              <div className="mt-2 text-xs text-muted">
                                Forecast: ikke tilgjengelig (for lite historikk)
                              </div>
                            )}

                            {/* Signals */}
                            {worst ? (
                              <div className="mt-2 flex flex-col gap-1 text-xs">
                                <span className={signalChipClass(worst.severity)}>
                                  {worst.signal_type.replaceAll("_", " ")}
                                </span>
                                <div className="text-muted lp-wrap-anywhere">{worst.message}</div>
                              </div>
                            ) : null}

                            {/* Notes */}
                            {uniqueNotes.length > 0 && (
                              <div className="mt-2 text-xs text-muted lp-wrap-anywhere">
                                <span className="font-medium">Notater:</span> {uniqueNotes.join(" • ")}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
