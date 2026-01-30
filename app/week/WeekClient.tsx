// app/week/WeekClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { formatDateForDisplay } from "@/lib/date/format";

/* =========================================================
   Types
========================================================= */

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
type Tier = "BASIS" | "LUXUS";
type Choice = { key: string; label?: string };

type OrderDay = {
  date: string;
  weekday: DayKey;
  isLocked: boolean;
  isEnabled: boolean;

  tier: Tier;
  allowedChoices: Choice[];

  wantsLunch: boolean;
  selectedChoiceKey: string | null;

  menuTitle?: string | null;
  menuDescription: string | null;
  allergens: string[];

  lastSavedAt?: string | null; // "HH:MM"
};

type WindowResp = {
  ok: boolean;
  range: { from: string; to: string };
  company?: { name?: string; policy?: string };
  days: OrderDay[];
  error?: string;
  detail?: string;
  rid?: string;
};

type ToggleResp =
  | {
      ok: true;
      rid?: string;
      order: {
        id?: string;
        date: string;
        status: "ACTIVE" | "CANCELLED" | string;
        note?: string | null;
        slot?: string | null;
        updated_at?: string | null;
        saved_at?: string | null;
        created_at?: string | null;
      };
      pricing: { tier: "BASIS" | "LUXUS"; unit_price: number };
    }
  | { ok: false; rid?: string; error: string; message: string; detail?: any };

type ChoiceSaveResp =
  | {
      ok: true;
      rid?: string;
      order: {
        id?: string;
        date: string;
        status: string;
        note?: string | null;
        slot?: string | null;
        updated_at?: string | null;
        saved_at?: string | null;
        created_at?: string | null;
      };
    }
  | { ok: false; rid?: string; error: string; message: string; detail?: any };

/* =========================================================
   Helpers
========================================================= */

function weekdayLabel(w: DayKey) {
  const map: Record<DayKey, string> = { mon: "Man", tue: "Tir", wed: "Ons", thu: "Tor", fri: "Fre" };
  return map[w];
}

function tierLabel(t: Tier) {
  return t === "BASIS" ? "Basis" : "Luxus";
}

function canAct(day: OrderDay) {
  return day.isEnabled && !day.isLocked;
}

function safeUserMessage(raw: string) {
  const s = (raw || "").toLowerCase();

  // error codes / patterns
  if (s.includes("cutoff_locked") || s.includes("etter kl. 08") || s.includes("låst etter")) return "Dagen er låst etter 08:00.";
  if (s.includes("date_locked_past") || s.includes("passert")) return "Datoen er passert og kan ikke endres.";
  if (s.includes("company_paused") || s.includes("pauset")) return "Bestilling/avbestilling er midlertidig pauset for firma.";
  if (s.includes("company_closed") || s.includes("stengt")) return "Firma er stengt. Bestilling/avbestilling er låst.";
  if (s.includes("not_active") || s.includes("ikke aktivt")) return "Firma er ikke aktivt. Bestilling/avbestilling er låst.";

  if (s.includes("unauth") || s.includes("innlogget")) return "Du er ikke innlogget.";
  if (s.includes("no_choices") || s.includes("mangler menyvalg")) return "Firmaavtalen mangler menyvalg.";
  if (s.includes("ikke aktiv") || s.includes("not enabled")) return "Denne dagen er ikke aktiv i avtalen.";
  if (s.includes("weekend") || s.includes("helg")) return "Helg støttes ikke i portalen (Man–Fre).";
  if (s.includes("no_order") || s.includes("må bestille")) return "Du må registrere lunsj før du kan velge meny.";
  if (s.includes("aktiv bestilling")) return "Du må ha aktiv bestilling for å endre menyvalg.";

  return raw || "Noe gikk galt. Prøv igjen.";
}

function StatusChip({ day }: { day: OrderDay }) {
  if (!day.isEnabled) {
    return <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">Ikke aktiv</span>;
  }
  if (day.isLocked) {
    return <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">🔒 Låst</span>;
  }
  if (day.wantsLunch) {
    return <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">✅ Registrert</span>;
  }
  return <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">⭕ Ikke registrert</span>;
}

function defaultChoiceKey(day: OrderDay) {
  const varm = day.allowedChoices?.find((c) => c.key === "varmmat")?.key;
  return varm ?? day.allowedChoices?.[0]?.key ?? null;
}

function choiceLabel(day: OrderDay, key: string) {
  return day.allowedChoices.find((c) => c.key === key)?.label ?? key;
}

function nowHHMM() {
  return new Date().toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
}

function hhmmFromIso(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

function clientRequestId() {
  try {
    // @ts-ignore
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Forhindrer racing toasts.
 */
function useTimeoutRef() {
  const t = useRef<number | null>(null);
  const clear = () => {
    if (t.current) window.clearTimeout(t.current);
    t.current = null;
  };
  const set = (fn: () => void, ms: number) => {
    clear();
    t.current = window.setTimeout(fn, ms);
  };
  useEffect(() => clear, []);
  return { set, clear };
}

function TogglePill({
  active,
  disabled,
  onClick,
  title,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "h-10 w-16 rounded-full border px-1 transition",
        "focus:outline-none focus:ring-2 focus:ring-offset-2",
        disabled ? "opacity-50 cursor-not-allowed" : "hover:brightness-[1.02] active:brightness-[0.98]",
        active
          ? "bg-emerald-600 border-emerald-700 focus:ring-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
          : "bg-rose-600 border-rose-700 focus:ring-rose-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]",
      ].join(" ")}
      aria-pressed={active}
      title={title}
    >
      <span
        className={[
          "block h-8 w-8 rounded-full bg-white transition shadow",
          active ? "translate-x-6" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

/* =========================================================
   Main
========================================================= */

export default function WeekClient() {
  const [weekIndex, setWeekIndex] = useState<0 | 1>(0);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WindowResp | null>(null);

  // global: feil ved lasting av window
  const [msg, setMsg] = useState<string | null>(null);

  // per-day feil (ingen stille feil)
  const [dayMsg, setDayMsg] = useState<Record<string, string | null>>({});

  // per-day saving (ingen optimistic UI)
  const [savingByDate, setSavingByDate] = useState<Record<string, boolean>>({});

  // toast
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useTimeoutRef();

  // abort inflight load
  const abortRef = useRef<AbortController | null>(null);

  // iOS safe-area padding
  const safeAreaStyle = useMemo(
    () => ({ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" } as CSSProperties),
    []
  );

  function showToast(text: string) {
    setToast(text);
    toastT.set(() => setToast(null), 2200);
  }

  function setDayError(date: string, text: string | null) {
    setDayMsg((prev) => ({ ...prev, [date]: text }));
  }

  function setSaving(date: string, v: boolean) {
    setSavingByDate((prev) => ({ ...prev, [date]: v }));
  }

  async function loadWindow() {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch("/api/order/window?weeks=2", { cache: "no-store", signal: ac.signal });
      const json = (await res.json().catch(() => null)) as WindowResp | null;

      if (!res.ok || !json || !json.ok) {
        const errText = safeUserMessage(json?.error || json?.detail || "Kunne ikke hente lunsjplanen.");
        setMsg(errText);
        setData(null);
        return;
      }

      const days = Array.isArray(json.days) ? json.days.slice(0, 10) : [];

      // reset per-day errors for current days
      const nextDayMsg: Record<string, string | null> = {};
      const nextSaving: Record<string, boolean> = {};
      for (const d of days) {
        nextDayMsg[d.date] = null;
        nextSaving[d.date] = Boolean(savingByDate[d.date]); // behold evt. pågående (sjeldent)
      }
      setDayMsg(nextDayMsg);
      setSavingByDate(nextSaving);

      setData({ ...json, days });
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setMsg("Kunne ikke hente lunsjplanen. Prøv igjen.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWindow();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const daysThisWeek = useMemo(() => (data?.days ?? []).slice(0, 5), [data]);
  const daysNextWeek = useMemo(() => (data?.days ?? []).slice(5, 10), [data]);
  const visibleDays = weekIndex === 0 ? daysThisWeek : daysNextWeek;

  const summary = useMemo(() => {
    const enabled = visibleDays.filter((d) => d.isEnabled).length;
    const ordered = visibleDays.filter((d) => d.wantsLunch).length;
    const locked = visibleDays.filter((d) => d.isLocked).length;
    return { enabled, ordered, locked };
  }, [visibleDays]);

  const headerTitle = useMemo(() => {
    const name = data?.company?.name?.trim();
    return name ? `${name} – Planlegg lunsj` : "Planlegg lunsj";
  }, [data?.company?.name]);

  const rangeText = useMemo(() => {
    if (!data?.range) return null;
    return `${formatDateForDisplay(data.range.from)} – ${formatDateForDisplay(data.range.to)}`;
  }, [data?.range]);

  const isAnySaving = useMemo(() => Object.values(savingByDate).some(Boolean), [savingByDate]);

  /* =========================================================
     Actions (server-verifisert, ingen optimistic UI)
  ========================================================= */

  async function toggleOrder(date: string, nextWantsLunch: boolean) {
    if (!data?.days?.length) return;

    if (savingByDate[date]) return;
    setSaving(date, true);
    setMsg(null);
    setDayError(date, null);

    const daySnapshot = data.days.find((d) => d.date === date);
    const pick =
      nextWantsLunch && daySnapshot
        ? daySnapshot.selectedChoiceKey && daySnapshot.allowedChoices.some((c) => c.key === daySnapshot.selectedChoiceKey)
          ? daySnapshot.selectedChoiceKey
          : defaultChoiceKey(daySnapshot)
        : null;

    const rid = clientRequestId();

    try {
      const res = await fetch("/api/orders/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-rid": rid },
        cache: "no-store",
        body: JSON.stringify({
          date,
          wants_lunch: nextWantsLunch,
          client_request_id: rid,
          choice_key: nextWantsLunch ? pick : null,
        }),
      });

      const json = (await res.json().catch(() => null)) as ToggleResp | null;

      if (!res.ok || !json || (json as any).ok === false) {
        const m = safeUserMessage((json as any)?.message || (json as any)?.error || "Kunne ikke lagre. Prøv igjen.");
        setDayError(date, m);
        showToast(`⚠️ ${m}`);
        await loadWindow(); // refresh locks/status
        return;
      }

      const status = String((json as any).order?.status ?? "").toUpperCase();
      const active = status === "ACTIVE";

      const serverHHMM =
        hhmmFromIso((json as any).order?.saved_at) ||
        hhmmFromIso((json as any).order?.updated_at) ||
        hhmmFromIso((json as any).order?.created_at) ||
        nowHHMM();

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map((d) =>
            d.date === date
              ? {
                  ...d,
                  wantsLunch: active,
                  selectedChoiceKey: active ? (pick ?? d.selectedChoiceKey) : null,
                  lastSavedAt: serverHHMM,
                }
              : d
          ),
        };
      });

      showToast(`✅ ${active ? "Registrert" : "Avbestilt"} • ${formatDateForDisplay(date)} • ${serverHHMM}`);
    } catch {
      const m = "Kunne ikke lagre. Prøv igjen.";
      setDayError(date, m);
      showToast("⚠️ Kunne ikke lagre. Prøv igjen.");
      await loadWindow();
    } finally {
      setSaving(date, false);
    }
  }

  async function saveChoice(day: OrderDay, key: string) {
    if (!data?.days?.length) return;
    if (!canAct(day)) return;
    if (savingByDate[day.date]) return;

    if (!day.wantsLunch) {
      showToast("ℹ️ Registrer lunsj først for å velge meny.");
      return;
    }
    if (!day.allowedChoices.some((c) => c.key === key)) return;

    setSaving(day.date, true);
    setMsg(null);
    setDayError(day.date, null);

    const rid = clientRequestId();

    try {
      const res = await fetch("/api/orders/choice", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-rid": rid },
        cache: "no-store",
        body: JSON.stringify({
          date: day.date,
          choice_key: key,
          client_request_id: rid,
        }),
      });

      const json = (await res.json().catch(() => null)) as ChoiceSaveResp | null;

      if (!res.ok || !json || (json as any).ok === false) {
        const m = safeUserMessage((json as any)?.message || (json as any)?.error || "Kunne ikke lagre menyvalg.");
        setDayError(day.date, m);
        showToast(`⚠️ ${m}`);
        await loadWindow();
        return;
      }

      const serverHHMM =
        hhmmFromIso((json as any).order?.saved_at) ||
        hhmmFromIso((json as any).order?.updated_at) ||
        hhmmFromIso((json as any).order?.created_at) ||
        nowHHMM();

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map((d) =>
            d.date === day.date
              ? {
                  ...d,
                  selectedChoiceKey: key,
                  lastSavedAt: serverHHMM,
                }
              : d
          ),
        };
      });

      showToast(`✅ Lagret: ${choiceLabel(day, key)} • ${formatDateForDisplay(day.date)} • ${serverHHMM}`);
    } catch {
      const m = "Kunne ikke lagre menyvalg. Prøv igjen.";
      setDayError(day.date, m);
      showToast("⚠️ Kunne ikke lagre menyvalg. Prøv igjen.");
      await loadWindow();
    } finally {
      setSaving(day.date, false);
    }
  }

  function onToggleLunch(day: OrderDay) {
    if (!canAct(day)) return;
    void toggleOrder(day.date, !day.wantsLunch);
  }

  function onSelectChoice(day: OrderDay, key: string) {
    if (!canAct(day)) return;
    if (day.selectedChoiceKey === key) return;
    void saveChoice(day, key);
  }

  /* =========================================================
     Render
  ========================================================= */

  return (
    <section className="rounded-2xl border border-border bg-surface p-4" style={safeAreaStyle}>
      {/* Toast */}
      {toast ? (
        <div className="mb-3 rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-text" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}

      {/* Top */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium text-text">{headerTitle}</div>
          <div className="text-sm text-muted">
            Endringer låses kl. <span className="font-medium text-text">08:00</span> samme dag.
            {data?.company?.policy ? <span className="ml-2 text-muted">• {data.company.policy}</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekIndex(0)}
            className={[
              "min-h-[44px] rounded-xl border px-3 py-2 text-sm transition",
              weekIndex === 0 ? "border-border bg-bg text-text" : "border-border/60 text-muted hover:bg-bg",
            ].join(" ")}
            aria-pressed={weekIndex === 0}
            disabled={isAnySaving}
          >
            Denne uke
          </button>
          <button
            type="button"
            onClick={() => setWeekIndex(1)}
            className={[
              "min-h-[44px] rounded-xl border px-3 py-2 text-sm transition",
              weekIndex === 1 ? "border-border bg-bg text-text" : "border-border/60 text-muted hover:bg-bg",
            ].join(" ")}
            aria-pressed={weekIndex === 1}
            disabled={isAnySaving}
          >
            Neste uke
          </button>
          <button
            type="button"
            onClick={loadWindow}
            className="min-h-[44px] rounded-xl border border-border/40 px-3 py-2 text-sm text-muted hover:bg-bg transition"
            disabled={loading || isAnySaving}
          >
            Oppdater
          </button>
        </div>
      </div>

      {/* Range + small stats */}
      <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-muted">
          {rangeText ? (
            <>
              Periode: <span className="font-medium text-text">{rangeText}</span>
            </>
          ) : (
            <>Periode</>
          )}
        </div>

        {!loading && !msg ? (
          <div className="text-sm text-muted">
            {summary.ordered} registrert • {summary.enabled} aktive • {summary.locked} låste
            {isAnySaving ? <span className="ml-2">• Lagrer…</span> : null}
          </div>
        ) : (
          <div className="text-sm text-muted">{isAnySaving ? "Lagrer…" : null}</div>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="mt-4 text-sm text-muted">Henter lunsjplan…</div>
      ) : msg ? (
        <div className="mt-4 rounded-2xl border border-border bg-bg p-4 text-sm text-muted">{msg}</div>
      ) : (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {visibleDays.map((day) => {
              const saving = Boolean(savingByDate[day.date]);
              const disabled = saving || day.isLocked || !day.isEnabled;
              const inlineErr = dayMsg[day.date] ?? null;

              const unitPrice = day.tier === "BASIS" ? 90 : 130;

              return (
                <div key={day.date} className={["rounded-2xl border border-border bg-surface p-4", saving ? "ring-1 ring-border" : ""].join(" ")}>
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold tracking-tight text-text">
                        {weekdayLabel(day.weekday)}{" "}
                        <span className="text-sm font-normal text-muted">({formatDateForDisplay(day.date)})</span>
                      </div>

                      <div className="mt-1 text-sm text-muted">
                        {day.menuTitle ? <span className="font-medium text-text">{day.menuTitle}</span> : <span className="font-medium text-text">Meny</span>}
                        {day.menuDescription ? <span className="text-muted"> • {day.menuDescription}</span> : <span className="italic"> • Kommer</span>}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <StatusChip day={day} />
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted">
                          {tierLabel(day.tier)} • {unitPrice} kr
                        </span>
                        <TogglePill
                          active={day.wantsLunch}
                          disabled={disabled}
                          onClick={() => onToggleLunch(day)}
                          title={day.wantsLunch ? "Klikk for å avbestille" : "Klikk for å registrere"}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Allergens */}
                  {day.allergens?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {day.allergens.map((a) => (
                        <span key={a} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                          {a}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {/* Inline error (minimal, ikke boks) */}
                  {inlineErr ? (
                    <div className="mt-3 text-sm">
                      <span className="text-muted">⚠️ </span>
                      <span className="text-text">{inlineErr}</span>
                    </div>
                  ) : null}

                  {/* Choices (kun når registrert) */}
                  {day.wantsLunch ? (
                    <div className="mt-4">
                      <div className="text-xs text-muted">
                        Menyvalg{day.isLocked ? " (låst)" : ""}:
                        <span className="ml-2 text-text font-medium">
                          {day.selectedChoiceKey ? choiceLabel(day, day.selectedChoiceKey) : "Ikke valgt"}
                        </span>
                      </div>

                      {day.allowedChoices?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {day.allowedChoices.map((c) => {
                            const active = day.selectedChoiceKey === c.key;
                            return (
                              <button
                                key={c.key}
                                type="button"
                                disabled={disabled}
                                onClick={() => onSelectChoice(day, c.key)}
                                className={[
                                  "min-h-[44px] rounded-full border px-4 py-2 text-sm transition",
                                  "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[rgba(0,0,0,0.15)]",
                                  disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-bg active:brightness-[0.99]",
                                  active ? "bg-bg text-text font-medium border-border" : "border-border/60 bg-white text-text/80",
                                ].join(" ")}
                              >
                                {c.label ?? c.key}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-muted">Ingen valg tilgjengelig i avtalen.</div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 text-sm text-muted">
                      {day.isEnabled ? (day.isLocked ? "Låst etter 08:00." : "Ikke registrert.") : "Ikke aktiv i avtalen."}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-4 flex items-center justify-between text-xs text-muted">
                    <span>{saving ? "Lagrer…" : day.lastSavedAt ? `Sist lagret: ${day.lastSavedAt}` : ""}</span>
                    <span className="opacity-80">Man–Fre</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Weekend CTA (roligere) */}
          <div className="mt-5 flex flex-col gap-2 rounded-2xl border border-border bg-bg p-4">
            <div className="text-sm font-medium text-text">Helgelevering (lørdag/søndag)</div>
            <div className="text-sm text-muted">Levering i helg bestilles ikke i Lunchportalen.</div>
            <div>
              <a
                href="https://melhuscatering.no/catering/bestill-her/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center rounded-xl border border-border px-4 py-2 text-sm text-text hover:bg-surface"
              >
                Bestill helgelevering
              </a>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
