"use client";

import { useEffect, useMemo, useState } from "react";

type MenuDayItem = {
  date: string; // YYYY-MM-DD
  weekday: string;
  isPublished: boolean;
  description: string | null;
  allergens: string[];
};

type WeekResp = {
  ok: boolean;
  weekOffset: 0 | 1;
  range: { from: string; to: string };
  days: MenuDayItem[];
  error?: string;
  detail?: string;
};

type BulkSetResp = {
  ok: boolean;
  rid?: string;
  message?: string;
  error?: string;
  detail?: string;
};

const CHOICES = [
  { key: "salatbar", label: "Salatbar" },
  { key: "paasmurt", label: "Påsmurt" },
  { key: "varmmat", label: "Varmmat" },
  { key: "sushi", label: "Sushi" },
  { key: "poke", label: "Pokébowl" },
  { key: "thai", label: "Thaimat" },
] as const;

type ChoiceKey = (typeof CHOICES)[number]["key"];

function Pill({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-900">
      <span aria-hidden className="h-2 w-2 rounded-full bg-slate-500" />
      {label}
    </div>
  );
}

export default function NextWeekOrderClient() {
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState<WeekResp | null>(null);

  // valg per dato
  const [choicesByDate, setChoicesByDate] = useState<Record<string, ChoiceKey | "">>({});
  const [noteByDate, setNoteByDate] = useState<Record<string, string>>({});

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadNextWeek() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/week?weekOffset=1", { cache: "no-store" });
      const json = (await res.json()) as WeekResp;
      setWeek(json);

      // init maps
      if (json?.ok) {
        const initChoices: Record<string, ChoiceKey | ""> = {};
        const initNotes: Record<string, string> = {};
        json.days.forEach((d) => {
          initChoices[d.date] = initChoices[d.date] ?? "";
          initNotes[d.date] = initNotes[d.date] ?? "";
        });
        setChoicesByDate(initChoices);
        setNoteByDate(initNotes);
      }
    } catch {
      setWeek({ ok: false, weekOffset: 1, range: { from: "", to: "" }, days: [], error: "FETCH_FAILED" });
      setMsg("Kunne ikke hente neste uke.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNextWeek();
  }, []);

  const days = useMemo(() => (week?.ok ? week.days : []), [week]);

  const allPublished = useMemo(() => {
    if (!week?.ok) return false;
    return week.days.every((d) => d.isPublished);
  }, [week]);

  const missingChoices = useMemo(() => {
    const missing: string[] = [];
    days.forEach((d) => {
      if (!d.isPublished) return; // ikke bestillbar uten publisert meny
      if (!choicesByDate[d.date]) missing.push(d.date);
    });
    return missing;
  }, [days, choicesByDate]);

  function setAll(choice: ChoiceKey) {
    const next = { ...choicesByDate };
    days.forEach((d) => {
      if (d.isPublished) next[d.date] = choice;
    });
    setChoicesByDate(next);
  }

  async function saveAll() {
    if (!week?.ok) return;

    // kun publiserte dager kan bestilles
    const orderDays = days.filter((d) => d.isPublished);
    if (!orderDays.length) {
      setMsg("Ingen publiserte dager å bestille.");
      return;
    }

    if (missingChoices.length) {
      setMsg("Velg for alle publiserte dager før du lagrer.");
      return;
    }

    const payload = {
      days: orderDays.map((d) => ({
        date: d.date,
        choice_key: choicesByDate[d.date],
        note: noteByDate[d.date] || "",
      })),
    };

    setBusy(true);
    setMsg(null);

    try {
      const res = await fetch("/api/order/bulk-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const json = (await res.json().catch(() => ({}))) as BulkSetResp;

      if (!res.ok || !json?.ok) {
        setMsg(json?.message || json?.error || "Kunne ikke lagre neste uke.");
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
            Forhåndsbestilling (Man–Fre). Lagre alle i én operasjon.
          </div>
        </div>

        <div className="flex items-center gap-2">
          {week?.ok ? (
            <Pill label={`${week.range.from} → ${week.range.to}`} />
          ) : (
            <Pill label="—" />
          )}
          {!allPublished && <Pill label="Ikke fullt publisert" />}
        </div>
      </div>

      {loading ? (
        <div className="mt-4 rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 text-sm text-[rgb(var(--lp-muted))]">
          Henter neste uke…
        </div>
      ) : !week?.ok ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Neste uke kunne ikke lastes.
        </div>
      ) : (
        <>
          {/* Quick actions */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="text-xs font-semibold text-[rgb(var(--lp-muted))]">Sett alle:</div>
            {CHOICES.map((c) => (
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

          {/* Rows */}
          <div className="mt-4 overflow-hidden rounded-2xl border border-[rgb(var(--lp-border))] bg-white">
            <div className="divide-y divide-[rgb(var(--lp-divider))]">
              {days.map((d) => {
                const disabled = !d.isPublished || busy;
                return (
                  <div key={d.date} className="p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[rgb(var(--lp-text))]">
                          {d.weekday} <span className="font-normal text-[rgb(var(--lp-muted))]">• {d.date}</span>
                        </div>
                        <div className="mt-1 text-sm text-[rgb(var(--lp-text))]">
                          {d.isPublished ? (d.description || "—") : <span className="text-[rgb(var(--lp-muted))]">Ikke publisert</span>}
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-2 md:w-[360px]">
                        <select
                          className="h-11 w-full rounded-2xl border border-[rgb(var(--lp-border))] bg-white px-3 text-sm outline-none focus:ring-4 focus:ring-[rgb(var(--lp-cta)/0.15)] disabled:opacity-60"
                          value={choicesByDate[d.date] ?? ""}
                          onChange={(e) =>
                            setChoicesByDate((prev) => ({ ...prev, [d.date]: e.target.value as ChoiceKey }))
                          }
                          disabled={disabled}
                        >
                          <option value="">{d.isPublished ? "Velg…" : "Utilgjengelig"}</option>
                          {CHOICES.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.label}
                            </option>
                          ))}
                        </select>

                        <input
                          className="h-11 w-full rounded-2xl border border-[rgb(var(--lp-border))] bg-white px-3 text-sm outline-none focus:ring-4 focus:ring-[rgb(var(--lp-cta)/0.15)] disabled:opacity-60"
                          placeholder="Kommentar (valgfritt)"
                          value={noteByDate[d.date] ?? ""}
                          onChange={(e) =>
                            setNoteByDate((prev) => ({ ...prev, [d.date]: e.target.value }))
                          }
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

          {/* Actions */}
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
              <div className="text-sm text-amber-900">
                Velg for alle publiserte dager før lagring.
              </div>
            ) : null}
          </div>

          {msg && (
            <div className="mt-4 rounded-2xl border border-[rgb(var(--lp-border))] bg-white px-4 py-3 text-sm text-[rgb(var(--lp-text))]">
              {msg}
            </div>
          )}
        </>
      )}
    </section>
  );
}
