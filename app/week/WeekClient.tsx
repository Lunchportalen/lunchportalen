// app/week/WeekClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

  tier: Tier; // ✅ visnings-tier (fra window)
  allowedChoices: Choice[];

  wantsLunch: boolean; // true == ACTIVE
  selectedChoiceKey: string | null;

  menuTitle?: string | null;
  menuDescription: string | null;
  allergens: string[];

  // UI kvittering
  lastSavedAt?: string | null; // "HH:MM" eller "DD.MM HH:MM" om du vil
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
  if (s.includes("locked") || s.includes("låst")) return "Dagen er låst etter 08:00.";
  if (s.includes("unauth") || s.includes("innlogget")) return "Du er ikke innlogget.";
  if (s.includes("mangler menyvalg") || s.includes("no_choices")) return "Firmaavtalen mangler menyvalg.";
  if (s.includes("ikke aktiv") || s.includes("not enabled")) return "Denne dagen er ikke aktiv i avtalen.";
  if (s.includes("weekend") || s.includes("helg")) return "Helg støttes ikke i portalen (Man–Fre).";
  if (s.includes("no_order") || s.includes("må bestille")) return "Du må bestille lunsj før du kan velge meny.";
  if (s.includes("not_active") || s.includes("aktiv bestilling")) return "Du må ha aktiv bestilling for å endre menyvalg.";
  return raw || "Noe gikk galt. Prøv igjen.";
}

function StatusChip({ day }: { day: OrderDay }) {
  if (!day.isEnabled) return <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">Ikke aktiv</span>;
  if (day.isLocked) return <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">🔒 Låst</span>;
  if (day.wantsLunch) return <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">✅ Bestilt</span>;
  return <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">⭕ Ikke bestilt</span>;
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

  const [savingDate, setSavingDate] = useState<string | null>(null);

  // toast
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useTimeoutRef();

  // abort inflight load
  const abortRef = useRef<AbortController | null>(null);

  // iOS safe-area padding
  const safeAreaStyle = useMemo(
    () => ({ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" } as React.CSSProperties),
    []
  );

  function showToast(text: string) {
    setToast(text);
    toastT.set(() => setToast(null), 2200);
  }

  function setDayError(date: string, text: string | null) {
    setDayMsg((prev) => ({ ...prev, [date]: text }));
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
      for (const d of days) nextDayMsg[d.date] = null;
      setDayMsg(nextDayMsg);

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

  /* =========================================================
     Actions (idempotent-klare)
  ========================================================= */

  // Toggle -> nå sender vi wants_lunch eksplisitt + client_request_id (backend kan ignorere uten å feile)
  async function toggleOrder(date: string, nextWantsLunch: boolean, daySnapshot?: OrderDay) {
    if (!data?.days?.length) return;

    if (savingDate && savingDate !== date) {
      showToast("⏳ Lagrer allerede. Prøv igjen om et øyeblikk.");
      return;
    }

    setSavingDate(date);
    setMsg(null);
    setDayError(date, null);

    // Optimistisk UI
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map((d) =>
          d.date === date
            ? {
                ...d,
                wantsLunch: nextWantsLunch,
                selectedChoiceKey: nextWantsLunch ? d.selectedChoiceKey : null,
              }
            : d
        ),
      };
    });

    const pick =
      nextWantsLunch && daySnapshot
        ? daySnapshot.selectedChoiceKey && daySnapshot.allowedChoices.some((c) => c.key === daySnapshot.selectedChoiceKey)
          ? daySnapshot.selectedChoiceKey
          : defaultChoiceKey(daySnapshot)
        : null;

    try {
      const res = await fetch("/api/orders/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          date,
          wants_lunch: nextWantsLunch, // ✅ idempotent-klart
          client_request_id: clientRequestId(), // ✅ idempotent-klart
          choice_key: nextWantsLunch ? pick : null,
        }),
      });

      const json = (await res.json().catch(() => null)) as ToggleResp | null;

      if (!res.ok || !json || (json as any).ok === false) {
        await loadWindow();
        const m = safeUserMessage((json as any)?.message || (json as any)?.error || "Kunne ikke lagre. Prøv igjen.");
        setDayError(date, m);
        showToast(`⚠️ ${m}`);
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

      const tier = (json as any).pricing?.tier as "BASIS" | "LUXUS" | undefined;
      const unit = Number((json as any).pricing?.unit_price ?? 0);
      const tierText = tier ? `${tier} (${unit} kr)` : "";
      showToast(`✅ ${active ? "Bestilt" : "Avbestilt"}${tierText ? ` – ${tierText}` : ""}`);
    } catch {
      await loadWindow();
      const m = "Kunne ikke lagre. Prøv igjen.";
      setDayError(date, m);
      showToast("⚠️ Kunne ikke lagre. Prøv igjen.");
    } finally {
      setSavingDate(null);
    }
  }

  // Autosave valg: POST /api/orders/choice (idempotent-klart med client_request_id)
  async function saveChoice(day: OrderDay, key: string) {
    if (!data?.days?.length) return;
    if (!canAct(day)) return;

    if (!day.wantsLunch) {
      showToast("ℹ️ Bestill lunsj først for å velge meny.");
      return;
    }
    if (!day.allowedChoices.some((c) => c.key === key)) return;

    if (savingDate && savingDate !== day.date) {
      showToast("⏳ Lagrer allerede. Prøv igjen om et øyeblikk.");
      return;
    }

    const prevKey = day.selectedChoiceKey;

    setSavingDate(day.date);
    setMsg(null);
    setDayError(day.date, null);

    // Optimistisk UI
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map((d) => (d.date === day.date ? { ...d, selectedChoiceKey: key } : d)),
      };
    });

    try {
      const res = await fetch("/api/orders/choice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          date: day.date,
          choice_key: key,
          client_request_id: clientRequestId(), // ✅ idempotent-klart
        }),
      });

      const json = (await res.json().catch(() => null)) as ChoiceSaveResp | null;

      if (!res.ok || !json || (json as any).ok === false) {
        // rollback
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            days: prev.days.map((d) => (d.date === day.date ? { ...d, selectedChoiceKey: prevKey } : d)),
          };
        });

        await loadWindow();
        const m = safeUserMessage((json as any)?.message || (json as any)?.error || "Kunne ikke lagre menyvalg.");
        setDayError(day.date, m);
        showToast(`⚠️ ${m}`);
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

      showToast(`✅ Lagret: ${choiceLabel(day, key)}`);
    } catch {
      // rollback
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map((d) => (d.date === day.date ? { ...d, selectedChoiceKey: prevKey } : d)),
        };
      });

      await loadWindow();
      const m = "Kunne ikke lagre menyvalg. Prøv igjen.";
      setDayError(day.date, m);
      showToast("⚠️ Kunne ikke lagre menyvalg. Prøv igjen.");
    } finally {
      setSavingDate(null);
    }
  }

  function onToggleLunch(day: OrderDay) {
    if (!canAct(day)) return;
    void toggleOrder(day.date, !day.wantsLunch, day);
  }

  function onSelectChoice(day: OrderDay, key: string) {
    if (!canAct(day)) return;
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
          >
            Neste uke
          </button>
          <button
            type="button"
            onClick={loadWindow}
            className="min-h-[44px] rounded-xl border border-border/40 px-3 py-2 text-sm text-muted hover:bg-bg transition"
            disabled={loading || !!savingDate}
          >
            Oppdater
          </button>
        </div>
      </div>

      {/* Range */}
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

        <div className="flex items-center gap-2 text-sm">{savingDate ? <span className="text-muted">Lagrer…</span> : null}</div>
      </div>

      {/* Summary */}
      {!loading && !msg ? (
        <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-border bg-bg p-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-text">
            <span className="font-medium">Ukeoversikt:</span>{" "}
            <span className="text-muted">
              {summary.ordered} bestilt • {summary.enabled} aktive dager • {summary.locked} låste
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="lp-chip">Man–Fre</span>
            <span className="lp-chip">Cut-off 08:00</span>
            <span className="lp-chip">Idempotent-ready</span>
          </div>
        </div>
      ) : null}

      {/* Body */}
      {loading ? (
        <div className="mt-4 text-sm text-muted">Henter lunsjplan…</div>
      ) : msg ? (
        <div className="mt-4 rounded-2xl border border-border bg-bg p-4 text-sm text-muted">{msg}</div>
      ) : (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {visibleDays.map((day) => {
              const disabled = day.isLocked || !day.isEnabled || savingDate === day.date;
              const activeChoice = day.selectedChoiceKey;
              const unitPrice = day.tier === "BASIS" ? 90 : 130;

              const inlineErr = dayMsg[day.date] ?? null;

              return (
                <div
                  key={day.date}
                  className={["relative rounded-2xl border border-border bg-surface p-4", day.isLocked ? "opacity-95" : ""].join(" ")}
                >
                  {/* Locked overlay */}
                  {day.isLocked ? (
                    <div className="pointer-events-none absolute inset-0 rounded-2xl">
                      <div className="absolute inset-0 rounded-2xl bg-white/40 backdrop-blur-[2px]" />
                      <div className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface/90 px-3 py-1 text-xs text-muted shadow-sm">
                        <span>🔒</span>
                        <span className="font-medium text-text">Låst kl. 08:00</span>
                      </div>
                      <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-border bg-surface/80 px-3 py-2 text-xs text-muted">
                        Endringer er ikke mulig etter cut-off.
                      </div>
                    </div>
                  ) : null}

                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold tracking-tight text-text">
                        {weekdayLabel(day.weekday)}{" "}
                        <span className="text-sm font-normal text-muted">({formatDateForDisplay(day.date)})</span>
                      </div>

                      <div className="mt-1 text-sm text-muted">
                        {day.menuTitle ? <span className="font-medium text-text">{day.menuTitle}:</span> : null}{" "}
                        {day.menuDescription ? day.menuDescription : <span className="italic">Meny kommer</span>}
                      </div>

                      {day.allergens?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {day.allergens.map((a) => (
                            <span key={a} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                              {a}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <StatusChip day={day} />
                      <span className="text-xs text-muted">
                        {tierLabel(day.tier)} • {unitPrice} kr
                      </span>
                    </div>
                  </div>

                  {/* Inline error per dag */}
                  {inlineErr ? (
                    <div className="mt-3 rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-muted">
                      <span className="font-medium text-text">⚠️</span> {inlineErr}
                    </div>
                  ) : null}

                  {/* Actions */}
                  <div className="mt-4 rounded-xl border border-border bg-bg p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-text">Lunsj</div>
                        <div className="text-xs text-muted">
                          {!day.isEnabled ? "Ikke aktiv i avtalen." : day.isLocked ? "Låst etter 08:00." : "Kan endres frem til 08:00."}
                        </div>
                      </div>

                      <TogglePill
                        active={day.wantsLunch}
                        disabled={disabled}
                        onClick={() => onToggleLunch(day)}
                        title={day.wantsLunch ? "Klikk for å avbestille" : "Klikk for å bestille"}
                      />
                    </div>

                    {day.wantsLunch ? (
                      <div className="mt-3">
                        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-bg px-3 py-1 text-sm transition">
                          <span className="text-muted">Valgt</span>
                          <span className="font-medium text-text">{activeChoice ? choiceLabel(day, activeChoice) : "–"}</span>
                        </div>

                        <div className="mt-2 rounded-xl border border-border bg-surface p-2 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                            {day.allowedChoices.map((c) => {
                              const active = day.selectedChoiceKey === c.key;

                              return (
                                <button
                                  key={c.key}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => onSelectChoice(day, c.key)}
                                  className={[
                                    "min-h-[44px] w-full sm:w-auto rounded-xl sm:rounded-full border px-3 py-2 text-sm transition",
                                    "active:scale-[0.99] sm:active:scale-100",
                                    "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[rgb(var(--lp-cta)/0.35)]",
                                    disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-bg",
                                    active
                                      ? [
                                          "bg-bg text-text font-medium",
                                          "border-[rgba(255,0,140,0.55)]",
                                          "ring-2 ring-[rgba(255,0,140,0.55)]",
                                          "ring-offset-2 ring-offset-bg",
                                          "shadow-[0_0_0_1px_rgba(255,0,140,0.10),0_0_14px_rgba(255,0,140,0.22)]",
                                        ].join(" ")
                                      : "border-border/60 bg-white text-text/80",
                                  ].join(" ")}
                                >
                                  {c.label ?? c.key}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="mt-2 text-xs text-muted">Menyvalg lagres automatisk.</div>
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-muted">Ikke bestilt.</div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-muted">
                    <span>{day.wantsLunch ? "✅ Bestilt" : "⭕ Ikke bestilt"}</span>
                    <span>{day.lastSavedAt ? `Sist lagret: ${day.lastSavedAt}` : ""}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Weekend CTA */}
          <div className="mt-5 rounded-2xl border border-border bg-bg p-4">
            <div className="text-sm font-medium text-text">Helgelevering (lørdag/søndag)</div>
            <div className="mt-1 text-sm text-muted">Levering i helg bestilles ikke i Lunchportalen.</div>
            <a
              href="https://melhuscatering.no/catering/bestill-her/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-[44px] items-center rounded-xl border border-border px-4 py-2 text-sm text-text hover:bg-surface"
            >
              Bestill helgelevering
            </a>
          </div>
        </>
      )}
    </section>
  );
}
