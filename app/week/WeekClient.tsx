// app/week/WeekClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateNO, formatTimeNO } from "@/lib/date/format";

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
  lockReason?: "CUTOFF" | "COMPANY" | null;

  tier: Tier | null;
  allowedChoices: Choice[];

  wantsLunch: boolean;
  orderStatus: "ACTIVE" | "CANCELLED" | null;
  selectedChoiceKey: string | null;

  menuTitle?: string | null;
  menuDescription: string | null;
  allergens: string[];

  lastSavedAt?: string | null; // "HH:MM"
  unit_price?: number | null;
};

type WindowResp = {
  ok: boolean;
  range: { from: string; to: string };
  company?: { name?: string; policy?: string };
  agreement?: { status?: string; message?: string | null; delivery_days?: DayKey[] };
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

function tierLabel(t: Tier | null) {
  if (!t) return "Ikke tilgjengelig";
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
    return <span className="lp-chip lp-chip-neutral lp-status-pill whitespace-nowrap">Ikke i avtalen</span>;
  }
  if (day.lockReason === "CUTOFF") {
    return <span className="lp-chip lp-chip-warn lp-status-pill whitespace-nowrap">Låst kl. 08:00</span>;
  }
  if (day.lockReason === "COMPANY" || day.isLocked) {
    return <span className="lp-chip lp-chip-warn lp-status-pill whitespace-nowrap">Sperret</span>;
  }
  const status = day.orderStatus ?? (day.wantsLunch ? "ACTIVE" : null);
  if (status === "ACTIVE") {
    return <span className="lp-chip lp-chip-ok lp-status-pill whitespace-nowrap">Bestilt</span>;
  }
  if (status === "CANCELLED") {
    return <span className="lp-chip lp-chip-neutral lp-status-pill whitespace-nowrap">Avbestilt</span>;
  }
  return <span className="lp-chip lp-chip-neutral lp-status-pill whitespace-nowrap">Ikke bestilt</span>;
}

function isoWeekNumber(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00`);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day + 3);
  const firstThu = new Date(d.getFullYear(), 0, 4);
  const firstThuDay = (firstThu.getDay() + 6) % 7;
  firstThu.setDate(firstThu.getDate() - firstThuDay + 3);
  const diff = d.getTime() - firstThu.getTime();
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

function formatRangeShort(fromISO: string, toISO: string) {
  const fmt = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short" });
  const from = fmt.format(new Date(`${fromISO}T12:00:00`));
  const to = fmt.format(new Date(`${toISO}T12:00:00`));
  return `${from}–${to}`;
}

function cutoffChipClass(tone: "ok" | "warn") {
  return tone === "warn" ? "lp-chip lp-chip-warn" : "lp-chip lp-chip-ok";
}

function defaultChoiceKey(day: OrderDay) {
  const varm = day.allowedChoices?.find((c) => c.key === "varmmat")?.key;
  return varm ?? day.allowedChoices?.[0]?.key ?? null;
}

function choiceLabel(day: OrderDay, key: string) {
  return day.allowedChoices.find((c) => c.key === key)?.label ?? key;
}

function nowHHMM() {
  return formatTimeNO(new Date().toISOString());
}

function hhmmFromIso(iso: string | null | undefined) {
  if (!iso) return null;
  const t = formatTimeNO(iso);
  return t || null;
}

function receiptText(day: OrderDay, saving: boolean) {
  if (saving) return "Lagrer…";
  if (!day.isEnabled) return "";
  if (day.lockReason === "CUTOFF") return "Sperret etter cut-off kl. 08:00.";
  if (day.lockReason === "COMPANY" || day.isLocked) return "Sperret.";
  const status = day.orderStatus ?? (day.wantsLunch ? "ACTIVE" : null);
  if (status === "ACTIVE") return day.lastSavedAt ? `Bestilt kl. ${day.lastSavedAt}` : "Bestilt";
  if (status === "CANCELLED") return day.lastSavedAt ? `Avbestilt kl. ${day.lastSavedAt}` : "Avbestilt";
  return "Ikke bestilt";
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
        "lp-toggle lp-week-toggle transition",
        "focus:outline-none focus:ring-2 focus:ring-offset-2",
        disabled ? "opacity-50 cursor-not-allowed" : "hover:brightness-[1.01] active:brightness-[0.99]",
        active
          ? "bg-[rgb(var(--lp-cta))] border-[rgb(var(--lp-accent-2))] focus:ring-[rgba(var(--lp-ring),0.35)] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
          : "bg-[rgb(var(--lp-surface-2))] border-[rgb(var(--lp-border))] focus:ring-[rgba(var(--lp-ring),0.25)]",
      ].join(" ")}
      aria-pressed={active}
      title={title}
    >
      <span
        className={[
          "lp-toggle-thumb",
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

  const companyLabel = useMemo(() => {
    const name = data?.company?.name?.trim();
    return name ? name : null;
  }, [data?.company?.name]);

  const agreementNotice = useMemo(() => {
    const msg = data?.agreement?.message ?? null;
    return msg && String(msg).trim().length ? String(msg).trim() : null;
  }, [data?.agreement?.message]);

  const visibleRange = useMemo(() => {
    if (!visibleDays.length) return null;
    return { from: visibleDays[0].date, to: visibleDays[visibleDays.length - 1].date };
  }, [visibleDays]);

  const weekLabel = useMemo(() => {
    if (!visibleRange) return "Uke";
    return `Uke ${isoWeekNumber(visibleRange.from)}`;
  }, [visibleRange]);

  const rangeLabel = useMemo(() => {
    if (!visibleRange) return null;
    return formatRangeShort(visibleRange.from, visibleRange.to);
  }, [visibleRange]);

  const cutoffInfo = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    const today = visibleDays.find((d) => d.date === todayISO);
    if (today?.lockReason === "CUTOFF") return { label: "Låst kl. 08:00", tone: "warn" as const };
    if (today?.isLocked) return { label: "Låst", tone: "warn" as const };
    return { label: "Åpen", tone: "ok" as const };
  }, [visibleDays]);

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

      const statusRaw = String((json as any).order?.status ?? "").toUpperCase();
      const normalizedStatus = statusRaw === "ACTIVE" ? "ACTIVE" : statusRaw === "CANCELLED" ? "CANCELLED" : null;
      const active = normalizedStatus === "ACTIVE";

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
                  orderStatus: normalizedStatus,
                  selectedChoiceKey: active ? (pick ?? d.selectedChoiceKey) : null,
                  lastSavedAt: serverHHMM,
                }
              : d
          ),
        };
      });

      showToast(`✅ ${active ? "Registrert" : "Avbestilt"} • ${formatDateNO(date)} • ${serverHHMM}`);
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
      const statusRaw = String((json as any).order?.status ?? "").toUpperCase();
      const normalizedStatus = statusRaw === "ACTIVE" ? "ACTIVE" : statusRaw === "CANCELLED" ? "CANCELLED" : null;

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map((d) =>
            d.date === day.date
              ? {
                  ...d,
                  selectedChoiceKey: key,
                  orderStatus: normalizedStatus ?? d.orderStatus,
                  lastSavedAt: serverHHMM,
                }
              : d
          ),
        };
      });

      showToast(`✅ Lagret: ${choiceLabel(day, key)} • ${formatDateNO(day.date)} • ${serverHHMM}`);
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
    <section className="lp-card lp-card-pad lp-safe-bottom-pad">
      {toast ? (
        <div
          className="mb-3 rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 px-4 py-3 text-sm text-[rgb(var(--lp-fg))]"
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {companyLabel ? <div className="text-xs text-[rgb(var(--lp-muted))]">{companyLabel}</div> : null}
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <div className="text-lg font-semibold text-[rgb(var(--lp-fg))]">
              {weekLabel}
              {rangeLabel ? ` · ${rangeLabel}` : ""}
            </div>
            <span className={cutoffChipClass(cutoffInfo.tone)}>{cutoffInfo.label}</span>
          </div>
          <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">Endringer kan gjøres frem til 08:00 samme dag.</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekIndex(0)}
            className={[
              "lp-btn min-h-[44px] border-[rgb(var(--lp-border))] bg-white/70 text-[rgb(var(--lp-muted))] hover:bg-white",
              weekIndex === 0 ? "text-[rgb(var(--lp-fg))] bg-[rgb(var(--lp-surface))]" : "",
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
              "lp-btn min-h-[44px] border-[rgb(var(--lp-border))] bg-white/70 text-[rgb(var(--lp-muted))] hover:bg-white",
              weekIndex === 1 ? "text-[rgb(var(--lp-fg))] bg-[rgb(var(--lp-surface))]" : "",
            ].join(" ")}
            aria-pressed={weekIndex === 1}
            disabled={isAnySaving}
          >
            Neste uke
          </button>
          <button
            type="button"
            onClick={loadWindow}
            className="lp-btn min-h-[44px] border-[rgb(var(--lp-border))] bg-white/70 text-[rgb(var(--lp-muted))] hover:bg-white"
            disabled={loading || isAnySaving}
          >
            Oppdater
          </button>
        </div>
      </div>

      {agreementNotice ? (
        <div className="mt-4 rounded-2xl bg-white/70 p-4 text-sm text-[rgb(var(--lp-muted))]">{agreementNotice}</div>
      ) : null}

      {loading ? (
        <div className="mt-4 text-sm text-[rgb(var(--lp-muted))]">Henter lunsjplan …</div>
      ) : msg ? (
        <div className="mt-4 rounded-2xl border border-[rgb(var(--lp-border))] bg-white/70 p-4 text-sm text-[rgb(var(--lp-muted))]">
          {msg}
        </div>
      ) : data?.agreement?.status !== "ACTIVE" ? (
        <div className="mt-4 rounded-2xl bg-white/70 p-5 text-sm text-[rgb(var(--lp-muted))]">
          <div className="text-base font-semibold text-[rgb(var(--lp-fg))]">
            {agreementNotice || "Ingen aktiv avtale"}
          </div>
          <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Kontakt administrator for å aktivere avtale.</div>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {visibleDays.map((day) => {
              const saving = Boolean(savingByDate[day.date]);
              const disabled = saving || day.isLocked || !day.isEnabled;
              const inlineErr = dayMsg[day.date] ?? null;

              const unitPrice = typeof day.unit_price === "number" ? day.unit_price : null;

              return (
                <div
                  key={day.date}
                  className="rounded-[var(--lp-radius)] bg-[rgb(var(--lp-surface))] p-4 shadow-[0_1px_2px_rgba(32,33,36,0.06)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-[rgb(var(--lp-fg))]">
                        {weekdayLabel(day.weekday)}
                        <span className="ml-2 text-sm font-normal text-[rgb(var(--lp-muted))]">{formatDateNO(day.date)}</span>
                      </div>

                      <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
                        {day.menuTitle ? (
                          <span className="font-medium text-[rgb(var(--lp-fg))]">{day.menuTitle}</span>
                        ) : (
                          <span className="font-medium text-[rgb(var(--lp-fg))]">Meny</span>
                        )}
                        {day.menuDescription ? (
                          <span className="text-[rgb(var(--lp-muted))]"> · {day.menuDescription}</span>
                        ) : (
                          <span className="text-[rgb(var(--lp-muted))]"> · Kommer</span>
                        )}
                      </div>

                      {day.isEnabled && unitPrice ? (
                        <div className="mt-2 text-xs text-[rgb(var(--lp-muted))]">{unitPrice} kr</div>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={[
                          "inline-flex min-h-[24px] items-center justify-center rounded-full px-3 text-xs font-semibold",
                          !day.isEnabled
                            ? "bg-neutral-200 text-neutral-500"
                            : day.tier === "LUXUS"
                            ? "bg-amber-100 text-amber-900"
                            : day.tier === "BASIS"
                              ? "bg-slate-200 text-slate-900"
                              : "bg-neutral-200 text-neutral-500",
                        ].join(" ")}
                      >
                        {day.isEnabled && day.tier ? tierLabel(day.tier) : "Ikke i avtalen"}
                      </span>
                      {day.isEnabled ? <StatusChip day={day} /> : null}
                      <TogglePill
                        active={day.wantsLunch}
                        disabled={disabled}
                        onClick={() => onToggleLunch(day)}
                        title={day.wantsLunch ? "Klikk for å avbestille" : "Klikk for å registrere"}
                      />
                    </div>
                  </div>

                  {day.allergens?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {day.allergens.map((a) => (
                        <span
                          key={a}
                          className="rounded-full bg-white/70 px-2 py-0.5 text-xs text-[rgb(var(--lp-muted))]"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {inlineErr ? (
                    <div className="mt-3 text-sm text-[rgb(var(--lp-fg))]">
                      <span className="text-[rgb(var(--lp-muted))]">⚠︎ </span>
                      <span>{inlineErr}</span>
                    </div>
                  ) : null}

                  {day.wantsLunch ? (
                    <div className="mt-4">
                      <div className="text-xs text-[rgb(var(--lp-muted))]">
                        Menyvalg{day.isLocked ? " (låst)" : ""}:
                        <span className="ml-2 text-[rgb(var(--lp-fg))] font-medium">
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
                                  "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[rgba(var(--lp-ring),0.25)]",
                                  disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-white active:brightness-[0.99]",
                                  active
                                    ? "bg-[rgb(var(--lp-surface))] text-[rgb(var(--lp-fg))] font-medium border-[rgb(var(--lp-border))]"
                                    : "border-[rgb(var(--lp-border))] bg-white/80 text-[rgb(var(--lp-muted))]",
                                ].join(" ")}
                              >
                                {c.label ?? c.key}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Ingen valg tilgjengelig i avtalen.</div>
                      )}
                    </div>
                  ) : null}

                  {receiptText(day, saving) ? (
                    <div className="mt-4 text-xs text-[rgb(var(--lp-muted))]">{receiptText(day, saving)}</div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-6 border-t border-[rgb(var(--lp-divider))] pt-5">
            <div className="text-sm font-medium text-[rgb(var(--lp-fg))]">Helgelevering (lørdag/søndag)</div>
            <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">Levering i helg bestilles ikke i Lunchportalen.</div>
            <div className="mt-3">
              <a
                href="https://melhuscatering.no/catering/bestill-her/"
                target="_blank"
                rel="noopener noreferrer"
                className="lp-btn min-h-[44px] border-[rgb(var(--lp-border))] bg-white/80 text-[rgb(var(--lp-fg))]"
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
