"use client";

import { useEffect, useMemo, useState } from "react";

import { fallbackLuxusChoicesClient, type MealChoice } from "@/lib/cms/mealTierFallback";
import { unwrapJsonOkData } from "@/lib/http/unwrapClientJson";

type MenuDayItem = {
  date: string;
  weekday: string;
  isPublished: boolean;
  description: string | null;
  allergens: string[];
};

type WeekApiData = {
  ok?: boolean;
  weekOffset: number;
  range?: { from: string; to: string };
  days: MenuDayItem[];
};

type WindowDayRow = {
  date: string;
  allowedChoices?: { key: string; label?: string }[];
};

type WindowApiData = {
  days?: WindowDayRow[];
};

type BulkSetResp = {
  ok: boolean;
  rid?: string;
  message?: string;
  error?: string;
  detail?: string;
};

function Pill({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-900">
      <span aria-hidden className="h-2 w-2 rounded-full bg-slate-500" />
      {label}
    </div>
  );
}

function normalizeWeek(data: WeekApiData | null): { ok: boolean; range: { from: string; to: string }; days: MenuDayItem[] } {
  if (!data?.days?.length) return { ok: false, range: { from: "", to: "" }, days: [] };
  const days = data.days.map((d) => ({
    date: String(d.date ?? "").slice(0, 10),
    weekday: String(d.weekday ?? ""),
    isPublished: Boolean(d.isPublished),
    description: d.description != null ? String(d.description) : null,
    allergens: Array.isArray(d.allergens) ? d.allergens.map((x) => String(x)) : [],
  }));
  const from = data.range?.from ?? days[0]?.date ?? "";
  const to = data.range?.to ?? days[days.length - 1]?.date ?? "";
  const ok = days.length > 0 && days.every((x) => x.date);
  return { ok, range: { from, to }, days };
}

export default function NextWeekOrderClient() {
  const [loading, setLoading] = useState(true);
  const [weekOk, setWeekOk] = useState(false);
  const [range, setRange] = useState({ from: "", to: "" });
  const [days, setDays] = useState<MenuDayItem[]>([]);
  const [rowChoicesByDate, setRowChoicesByDate] = useState<Record<string, MealChoice[]>>({});

  const [choicesByDate, setChoicesByDate] = useState<Record<string, string>>({});
  const [noteByDate, setNoteByDate] = useState<Record<string, string>>({});

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadNextWeek() {
    setLoading(true);
    setMsg(null);
    try {
      const [weekRes, winRes] = await Promise.all([
        fetch("/api/week?weekOffset=1", { cache: "no-store" }),
        fetch("/api/order/window?weeks=2", { cache: "no-store" }),
      ]);
      const weekJson = await weekRes.json();
      const winJson = await winRes.json();

      const weekRaw = unwrapJsonOkData<WeekApiData>(weekJson) ?? (weekJson as WeekApiData);
      const norm = normalizeWeek(weekRaw);
      setWeekOk(norm.ok);
      setRange(norm.range);
      setDays(norm.days);

      const initChoices: Record<string, string> = {};
      const initNotes: Record<string, string> = {};
      norm.days.forEach((d) => {
        initChoices[d.date] = initChoices[d.date] ?? "";
        initNotes[d.date] = initNotes[d.date] ?? "";
      });
      setChoicesByDate(initChoices);
      setNoteByDate(initNotes);

      const winData = unwrapJsonOkData<WindowApiData>(winJson) ?? (winJson as WindowApiData);
      const dateSet = new Set(norm.days.map((d) => d.date));
      const nextRow: Record<string, MealChoice[]> = {};
      for (const row of winData?.days ?? []) {
        const dt = String(row?.date ?? "").slice(0, 10);
        if (!dateSet.has(dt)) continue;
        const raw = Array.isArray(row.allowedChoices) ? row.allowedChoices : [];
        const mapped: MealChoice[] = raw
          .map((c) => ({
            key: String(c?.key ?? "")
              .trim()
              .toLowerCase(),
            label: String(c?.label ?? c?.key ?? "").trim() || String(c?.key ?? "").trim().toLowerCase(),
          }))
          .filter((c) => c.key);
        nextRow[dt] = mapped;
      }
      setRowChoicesByDate(nextRow);

      if (!weekRes.ok || !norm.ok) {
        setMsg("Neste uke kunne ikke lastes.");
      }
    } catch {
      setWeekOk(false);
      setDays([]);
      setRange({ from: "", to: "" });
      setMsg("Kunne ikke hente neste uke.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNextWeek();
  }, []);

  const choicesForDate = useMemo(() => {
    return (date: string): MealChoice[] => {
      const cms = rowChoicesByDate[date];
      return cms?.length ? cms : fallbackLuxusChoicesClient();
    };
  }, [rowChoicesByDate]);

  const quickChoiceButtons = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of days) {
      if (!d.isPublished) continue;
      for (const c of choicesForDate(d.date)) {
        if (!m.has(c.key)) m.set(c.key, c.label);
      }
    }
    if (!m.size) {
      for (const c of fallbackLuxusChoicesClient()) m.set(c.key, c.label);
    }
    return [...m.entries()].map(([key, label]) => ({ key, label }));
  }, [days, choicesForDate]);

  const allPublished = useMemo(() => {
    if (!weekOk || !days.length) return false;
    return days.every((d) => d.isPublished);
  }, [weekOk, days]);

  const missingChoices = useMemo(() => {
    const missing: string[] = [];
    days.forEach((d) => {
      if (!d.isPublished) return;
      if (!choicesByDate[d.date]) missing.push(d.date);
    });
    return missing;
  }, [days, choicesByDate]);

  function setAll(choiceKey: string) {
    const next = { ...choicesByDate };
    days.forEach((d) => {
      if (!d.isPublished) return;
      const list = choicesForDate(d.date);
      if (list.some((c) => c.key === choiceKey)) next[d.date] = choiceKey;
    });
    setChoicesByDate(next);
  }

  async function saveAll() {
    if (!weekOk) return;

    const orderDays = days.filter((d) => d.isPublished);
    if (!orderDays.length) {
      setMsg("Ingen publiserte dager å bestille.");
      return;
    }

    if (missingChoices.length) {
      setMsg("Velg for alle publiserte dager før du lagrer.");
      return;
    }

    const firstKey = choicesByDate[orderDays[0]?.date ?? ""];
    if (!firstKey) {
      setMsg("Velg minst ett måltid.");
      return;
    }

    setBusy(true);
    setMsg(null);

    try {
      const res = await fetch("/api/order/bulk-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ choice_key: firstKey, weekIndex: 1 }),
      });

      const jsonRaw = await res.json().catch(() => ({}));
      const json = (unwrapJsonOkData<BulkSetResp>(jsonRaw) ?? jsonRaw) as BulkSetResp;

      if (!res.ok || !json?.ok) {
        setMsg(json?.message || (json as { error?: string })?.error || "Kunne ikke lagre neste uke.");
        return;
      }

      setMsg(json?.message || "Neste uke er lagret.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-[rgb(var(--lp-border))] bg-white/70 p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-semibold text-[rgb(var(--lp-text))]">Bestill neste uke</div>
          <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
            Forhåndsbestilling (Man–Fre). Ett måltidsvalg settes for alle åpne dager neste uke (API bulk-set).
          </div>
        </div>

        <div className="flex items-center gap-2">
          {weekOk ? <Pill label={`${range.from} → ${range.to}`} /> : <Pill label="—" />}
          {!allPublished && weekOk ? <Pill label="Ikke fullt publisert" /> : null}
        </div>
      </div>

      {loading ? (
        <div className="mt-4 rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 text-sm text-[rgb(var(--lp-muted))]">
          Henter neste uke…
        </div>
      ) : !weekOk ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Neste uke kunne ikke lastes.
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="text-xs font-semibold text-[rgb(var(--lp-muted))]">Sett alle (samme valg for visning):</div>
            {quickChoiceButtons.map((c) => (
              <button
                key={c.key}
                type="button"
                className="h-9 rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 text-xs font-semibold text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-bg))]"
                onClick={() => setAll(c.key)}
                disabled={busy}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-[rgb(var(--lp-border))] bg-white">
            <div className="divide-y divide-[rgb(var(--lp-divider))]">
              {days.map((d) => {
                const disabled = !d.isPublished || busy;
                const rowOpts = choicesForDate(d.date);
                return (
                  <div key={d.date} className="p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[rgb(var(--lp-text))]">
                          {d.weekday} <span className="font-normal text-[rgb(var(--lp-muted))]">• {d.date}</span>
                        </div>
                        <div className="mt-1 text-sm text-[rgb(var(--lp-text))]">
                          {d.isPublished ? (
                            d.description || "—"
                          ) : (
                            <span className="text-[rgb(var(--lp-muted))]">Ikke publisert</span>
                          )}
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-2 md:w-[360px]">
                        <select
                          className="h-11 w-full rounded-2xl border border-[rgb(var(--lp-border))] bg-white px-3 text-sm outline-none focus:ring-4 focus:ring-[rgb(var(--lp-cta)/0.15)] disabled:opacity-60"
                          value={choicesByDate[d.date] ?? ""}
                          onChange={(e) => setChoicesByDate((prev) => ({ ...prev, [d.date]: e.target.value }))}
                          disabled={disabled}
                        >
                          <option value="">{d.isPublished ? "Velg…" : "Utilgjengelig"}</option>
                          {rowOpts.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.label}
                            </option>
                          ))}
                        </select>

                        <input
                          className="h-11 w-full rounded-2xl border border-[rgb(var(--lp-border))] bg-white px-3 text-sm outline-none focus:ring-4 focus:ring-[rgb(var(--lp-cta)/0.15)] disabled:opacity-60"
                          placeholder="Kommentar (valgfritt) — kobles ikke til bulk-set"
                          value={noteByDate[d.date] ?? ""}
                          onChange={(e) => setNoteByDate((prev) => ({ ...prev, [d.date]: e.target.value }))}
                          disabled={disabled}
                          maxLength={280}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-[rgb(var(--lp-cta))] px-5 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={saveAll}
              disabled={busy || !days.length}
            >
              {busy ? "Lagrer…" : "Lagre neste uke"}
            </button>

            <button
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-[rgb(var(--lp-border))] bg-white px-5 text-sm font-semibold text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-bg))] disabled:opacity-60"
              onClick={loadNextWeek}
              disabled={busy}
            >
              Oppdater
            </button>

            {missingChoices.length ? (
              <div className="text-sm text-amber-900">Velg for alle publiserte dager før lagring.</div>
            ) : null}
          </div>

          {msg ? (
            <div className="mt-4 rounded-2xl border border-[rgb(var(--lp-border))] bg-white px-4 py-3 text-sm text-[rgb(var(--lp-text))]">
              {msg}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
