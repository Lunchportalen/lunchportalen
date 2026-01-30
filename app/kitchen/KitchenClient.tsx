// app/kitchen/KitchenClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

type KitchenRow = {
  company: string;
  location: string;
  employeeName: string;
  department?: string | null;
  note?: string | null;
  tier?: "BASIS" | "LUXUS" | null;
};

type KitchenResp = {
  ok: boolean;
  date: string; // YYYY-MM-DD
  cutoff?: { isAfterCutoff: boolean; cutoffTime: string };
  summary: { orders: number; companies: number; people: number };
  rows: KitchenRow[];
  reason?: "NO_ORDERS" | "NOT_DELIVERY_DAY" | "COMPANIES_PAUSED" | "AUTH_REQUIRED" | "ERROR";
  detail?: string;
};

function osloISO(d: Date) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

function osloPretty(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00+01:00`);
  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

function isWeekendISO(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00+01:00`);
  const dow = d.getDay(); // 0 søn ... 6 lør
  return dow === 0 || dow === 6;
}

function addDaysISO(dateISO: string, days: number) {
  const d = new Date(`${dateISO}T12:00:00+01:00`);
  d.setDate(d.getDate() + days);
  return osloISO(d);
}

function nextBusinessDayISO(dateISO: string) {
  let cur = addDaysISO(dateISO, 1);
  while (isWeekendISO(cur)) cur = addDaysISO(cur, 1);
  return cur;
}

function chipClass(kind: "ok" | "warn" | "crit") {
  if (kind === "crit") return "bg-red-50 border-red-200 text-red-900";
  if (kind === "warn") return "bg-yellow-50 border-yellow-200 text-yellow-900";
  return "bg-emerald-50 border-emerald-200 text-emerald-900";
}

async function readJsonSafe<T = any>(r: Response): Promise<T | null> {
  const t = await r.text();
  if (!t) return null;
  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}

function normKitchenResp(dateISO: string, data: any): KitchenResp {
  const ok = Boolean(data?.ok);
  const date = String(data?.date ?? dateISO);

  const summaryIn = data?.summary ?? {};
  const summary = {
    orders: Number(summaryIn?.orders ?? 0),
    companies: Number(summaryIn?.companies ?? 0),
    people: Number(summaryIn?.people ?? 0),
  };

  const rows: KitchenRow[] = Array.isArray(data?.rows) ? (data.rows as any[]) : [];
  const cutoff = data?.cutoff && typeof data.cutoff === "object"
    ? {
        isAfterCutoff: Boolean(data.cutoff.isAfterCutoff),
        cutoffTime: String(data.cutoff.cutoffTime ?? "08:00"),
      }
    : undefined;

  const reason = data?.reason as KitchenResp["reason"] | undefined;
  const detail = data?.detail ? String(data.detail) : undefined;

  return { ok, date, cutoff, summary, rows, reason, detail };
}

async function fetchKitchen(dateISO: string): Promise<KitchenResp> {
  const r = await fetch(`/api/kitchen?date=${encodeURIComponent(dateISO)}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!r.ok) {
    return {
      ok: false,
      date: dateISO,
      summary: { orders: 0, companies: 0, people: 0 },
      rows: [],
      reason: r.status === 401 ? "AUTH_REQUIRED" : "ERROR",
      detail: `HTTP ${r.status}`,
    };
  }

  const data = await readJsonSafe<any>(r);

  if (!data || typeof data !== "object") {
    return {
      ok: false,
      date: dateISO,
      summary: { orders: 0, companies: 0, people: 0 },
      rows: [],
      reason: "ERROR",
      detail: "Invalid JSON payload",
    };
  }

  return normKitchenResp(dateISO, data);
}

/** Finn første "aktive" dato (har bestillinger) framover innen 14 dager (Mon–Fre). */
async function findNextActiveDate(startISO: string) {
  let cur = startISO;

  for (let i = 0; i < 14; i++) {
    if (isWeekendISO(cur)) {
      cur = nextBusinessDayISO(cur);
      continue;
    }

    const res = await fetchKitchen(cur);
    if (res.ok && (res.summary?.orders ?? 0) > 0) return { date: cur, res };

    cur = nextBusinessDayISO(cur);
  }

  const res = await fetchKitchen(startISO);
  return { date: startISO, res };
}

function EmptyState({
  reason,
  onNextActive,
}: {
  reason?: KitchenResp["reason"];
  onNextActive: () => void;
}) {
  const text = (() => {
    switch (reason) {
      case "NOT_DELIVERY_DAY":
        return "Dette er ikke en leveringsdag (Man–Fre).";
      case "COMPANIES_PAUSED":
        return "Ingen aktive firma/avtaler denne dagen.";
      case "AUTH_REQUIRED":
        return "Du må være innlogget for å se kjøkkenvisning.";
      case "ERROR":
        return "Kunne ikke hente data. Sjekk API/tilkobling.";
      case "NO_ORDERS":
      default:
        return "Ingen bestillinger denne dagen.";
    }
  })();

  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="text-sm text-slate-700">{text}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={onNextActive}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Gå til neste leveringsdag
        </button>
      </div>
      <div className="mt-4 text-xs text-slate-500">
        Tips: Kjøkkenvisning er laget for drift — du skal alltid ha et tydelig neste steg,
        selv når det er tomt.
      </div>
    </div>
  );
}

export default function KitchenClient() {
  const todayISO = useMemo(() => osloISO(new Date()), []);
  const [dateISO, setDateISO] = useState<string>(todayISO);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<KitchenResp | null>(null);
  const [autoPicked, setAutoPicked] = useState(false);

  async function load(d: string) {
    setLoading(true);
    try {
      const res = await fetchKitchen(d);
      setData(res);
    } finally {
      setLoading(false);
    }
  }

  // Første load: autovelg "i dag", men hvis tomt -> finn neste aktive dag (Mon–Fre)
  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const first = await fetchKitchen(todayISO);
        if (!alive) return;

        const isHardError = !first.ok && (first.reason === "AUTH_REQUIRED" || first.reason === "ERROR");

        if (!isHardError && (first.summary?.orders ?? 0) === 0 && !autoPicked) {
          const next = await findNextActiveDate(todayISO);
          if (!alive) return;
          setAutoPicked(true);
          setDateISO(next.date);
          setData(next.res);
        } else {
          setDateISO(todayISO);
          setData(first);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayISO]);

  // Når dateISO endres via UI: last data (men unngå dobbel-load på init)
  useEffect(() => {
    if (!data) return;
    if (data.date !== dateISO) load(dateISO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO]);

  const summary = data?.summary ?? { orders: 0, companies: 0, people: 0 };
  const pretty = osloPretty(dateISO);

  const status = (() => {
    if (!data) return { kind: "warn" as const, label: "Laster…" };
    if (!data.ok) return { kind: "crit" as const, label: "Problem" };
    if ((summary.orders ?? 0) === 0) return { kind: "warn" as const, label: "Tom dag" };
    return { kind: "ok" as const, label: "Klar" };
  })();

  const cutoffLabel = (() => {
    if (!data?.cutoff) return null;
    return data.cutoff.isAfterCutoff
      ? `Stengt (etter ${data.cutoff.cutoffTime})`
      : `Åpen (til ${data.cutoff.cutoffTime})`;
  })();

  function setPrevDay() {
    setAutoPicked(true);
    setDateISO(addDaysISO(dateISO, -1));
  }
  function setNextDay() {
    setAutoPicked(true);
    setDateISO(addDaysISO(dateISO, 1));
  }
  function setTomorrow() {
    setAutoPicked(true);
    setDateISO(addDaysISO(todayISO, 1));
  }
  function setNextDelivery() {
    setAutoPicked(true);
    setDateISO(nextBusinessDayISO(todayISO));
  }
  async function goNextActive() {
    setLoading(true);
    try {
      const next = await findNextActiveDate(dateISO);
      setAutoPicked(true);
      setDateISO(next.date);
      setData(next.res);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Kjøkken – dagens bestillinger</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${chipClass(status.kind)}`}>
              {status.label}
            </span>

            {cutoffLabel ? (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
                {cutoffLabel}
              </span>
            ) : null}

            {loading ? <span className="text-xs text-slate-500">Henter…</span> : null}
          </div>
        </div>
      </div>

      {/* Operativ toppkontroll */}
      <div className="mb-5 rounded-2xl border bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Dag-navigasjon + kalender */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={setPrevDay} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" title="Forrige dag">
              ◀
            </button>

            <div className="min-w-[260px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900">
              {pretty}
            </div>

            <button onClick={setNextDay} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" title="Neste dag">
              ▶
            </button>

            <label className="ml-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <span>📅</span>
              <input
                type="date"
                value={dateISO}
                onChange={(e) => {
                  setAutoPicked(true);
                  setDateISO(e.target.value);
                }}
                className="bg-transparent outline-none"
              />
            </label>
          </div>

          {/* Hurtigknapper */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setAutoPicked(true);
                setDateISO(todayISO);
              }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium"
            >
              I dag
            </button>
            <button onClick={setTomorrow} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium">
              I morgen
            </button>
            <button onClick={setNextDelivery} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium">
              Neste leveringsdag
            </button>
            <button onClick={goNextActive} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
              Finn aktive bestillinger
            </button>
          </div>
        </div>

        {/* Operative tall */}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border bg-slate-50 p-4">
            <div className="text-xs text-slate-500">Totalt</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{summary.orders}</div>
            <div className="text-xs text-slate-500">bestillinger</div>
          </div>
          <div className="rounded-xl border bg-slate-50 p-4">
            <div className="text-xs text-slate-500">Firma</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{summary.companies}</div>
            <div className="text-xs text-slate-500">aktive</div>
          </div>
          <div className="rounded-xl border bg-slate-50 p-4">
            <div className="text-xs text-slate-500">Personer</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{summary.people}</div>
            <div className="text-xs text-slate-500">i dag</div>
          </div>
        </div>
      </div>

      {/* Innhold */}
      {!data || loading ? (
        <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600">Laster kjøkkenoversikt…</div>
      ) : !data.ok || summary.orders === 0 ? (
        <EmptyState reason={data.reason ?? "NO_ORDERS"} onNextActive={goNextActive} />
      ) : (
        <div className="rounded-2xl border bg-white">
          <div className="border-b p-4 text-sm font-medium text-slate-900">Bestillinger</div>

          <div className="divide-y">
            {data.rows.map((row, idx) => (
              <div key={idx} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900">
                    {row.employeeName}
                    {row.department ? <span className="ml-2 text-xs font-normal text-slate-500">• {row.department}</span> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {row.tier ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
                        {row.tier === "BASIS" ? "Basis" : "Luxus"}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
                      {row.company} • {row.location}
                    </span>
                  </div>
                </div>

                {row.note ? (
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <span className="font-medium">Notat:</span> {row.note}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
