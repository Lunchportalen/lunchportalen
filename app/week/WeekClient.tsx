// app/week/WeekClient.tsx
"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateNO, formatTimeNO } from "@/lib/date/format";
import { canSeeNextWeek, canSeeThisWeek } from "@/lib/week/availability";

const API_BASE = "/api/order";

/* =========================================================
   Types
========================================================= */

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
type Tier = "BASIS" | "LUXUS";
type Choice = { key: string; label?: string };

type AgreementStatus =
  | "ACTIVE"
  | "PENDING_COMPANY"
  | "NOT_READY"
  | "STARTS_LATER"
  | "MISSING"
  | string;

type OrderStatus = "ACTIVE" | "CANCELLED" | null;

type OrderDay = {
  date: string;
  weekday: DayKey;
  isLocked: boolean;
  isEnabled: boolean;
  lockReason?: "CUTOFF" | "COMPANY" | null;

  tier: Tier | null;
  allowedChoices: Choice[];

  wantsLunch: boolean;
  orderStatus: OrderStatus;
  selectedChoiceKey: string | null;

  menuTitle?: string | null;
  menuDescription: string | null;
  allergens: string[];

  lastSavedAt?: string | null; // "HH:MM"
  unit_price?: number | null;

  note?: string | null;
};

type WindowResp = {
  ok: boolean;
  range: { from: string; to: string };
  company?: { name?: string; policy?: string };
  agreement?: {
    status?: AgreementStatus;
    message?: string | null;
    delivery_days?: DayKey[];
    start_date?: string | null;
  };
  days: OrderDay[];
  error?: string;
  detail?: string;
  rid?: string;
};

type WindowWrapped =
  | { ok: true; rid?: string; data: WindowResp }
  | ({ ok: true; rid?: string } & WindowResp)
  | { ok: false; rid?: string; error?: string; detail?: string; message?: string };

type SetChoiceResp =
  | {
      ok: true;
      rid?: string;
      receipt?: { orderId?: string; status?: string; date?: string; updatedAt?: string | null };
      date: string;
      choice_key: string;
      note: string | null;
      updated_at?: string | null;
    }
  | { ok: false; rid?: string; error?: string; message?: string; detail?: any };

type SetDayResp =
  | {
      ok: true;
      rid?: string;
      receipt?: { orderId?: string; status?: string; date?: string; updatedAt?: string | null };
      date: string;
      status?: string;
      wants_lunch?: boolean;
      choice_key?: string | null;
      note?: string | null;
      pricing?: { tier?: string; unit_price?: number };
      updated_at?: string | null;
    }
  | { ok: false; rid?: string; error?: string; message?: string; detail?: any };

/* =========================================================
   Fixed choices + variants
========================================================= */

const FIXED_CHOICES: Record<Tier, Choice[]> = {
  BASIS: [
    { key: "salatbar", label: "Salatbar" },
    { key: "paasmurt", label: "Påsmurt" },
    { key: "varmmat", label: "Varmmat" },
  ],
  LUXUS: [
    { key: "salatbar", label: "Salatbar" },
    { key: "paasmurt", label: "Påsmurt" },
    { key: "varmmat", label: "Varmmat" },
    { key: "sushi", label: "Sushi" },
    { key: "pokebowl", label: "Pokébowl" },
    { key: "thaimat", label: "Thaimat" },
  ],
};

const SUBCHOICES: Record<"salatbar" | "paasmurt", string[]> = {
  salatbar: ["Skinke", "Kylling", "Vegan"],
  paasmurt: ["Ost/Skinke", "Kylling karri", "Roastbiff", "Laks/Eggerøre", "Vegan"],
};

const NOTE_SEP = "||";

/* =========================================================
   Helpers
========================================================= */

function asOrderStatus(v: unknown): OrderStatus {
  const raw = String(v ?? "").trim();
  const up = raw.toUpperCase();
  if (up === "ACTIVE") return "ACTIVE";
  if (up === "CANCELLED" || up === "CANCELED") return "CANCELLED";

  const s = raw.toLowerCase();
  if (s === "active" || s === "a" || s === "1") return "ACTIVE";
  if (s === "cancelled" || s === "canceled" || s === "c" || s === "0") return "CANCELLED";
  return null;
}

function mapDay(d: any): OrderDay {
  const date = String(d?.date ?? "").trim();
  const status = asOrderStatus(d?.orderStatus ?? d?.status);

  const wantsFromApi =
    typeof d?.wantsLunch === "boolean"
      ? Boolean(d.wantsLunch)
      : typeof d?.wants_lunch === "boolean"
      ? Boolean(d.wants_lunch)
      : false;

  const wants = status === "ACTIVE" ? true : status === "CANCELLED" ? false : wantsFromApi;

  return {
    date,
    weekday: d?.weekday as DayKey,
    isLocked: Boolean(d?.isLocked),
    isEnabled: Boolean(d?.isEnabled),
    lockReason: (d?.lockReason ?? null) as any,

    tier: (d?.tier ?? null) as any,
    allowedChoices: Array.isArray(d?.allowedChoices) ? d.allowedChoices : [],

    wantsLunch: wants,
    orderStatus: status ?? (wants ? "ACTIVE" : null),
    selectedChoiceKey: wants ? (d?.selectedChoiceKey ?? null) : null,

    menuTitle: d?.menuTitle ?? null,
    menuDescription: d?.menuDescription ?? null,
    allergens: Array.isArray(d?.allergens) ? d.allergens : [],

    lastSavedAt: d?.lastSavedAt ?? null,
    unit_price: typeof d?.unit_price === "number" ? d.unit_price : null,

    note: d?.note ?? null,
  };
}

function needsVariant(choiceKey: string | null | undefined): choiceKey is "salatbar" | "paasmurt" {
  const k = String(choiceKey ?? "").toLowerCase();
  return k === "salatbar" || k === "paasmurt";
}

function titleForChoiceKey(choiceKey: string) {
  const k = String(choiceKey ?? "").toLowerCase();
  if (k === "salatbar") return "Salatbar";
  if (k === "paasmurt") return "Påsmurt";
  return choiceKey;
}

function buildVariantNote(choiceKey: string, variant: string) {
  return `${titleForChoiceKey(choiceKey)}: ${String(variant ?? "").trim()}`;
}

function noteSuffixFromStoredNote(note: string | null | undefined) {
  const n = String(note ?? "").trim();
  if (!n) return "";
  const idx = n.indexOf(NOTE_SEP);
  if (idx === -1) return n;
  return n.slice(idx + NOTE_SEP.length).trim();
}

function extractVariantFromNote(choiceKey: string, note: string | null | undefined): string | null {
  const suffix = noteSuffixFromStoredNote(note);
  if (!suffix) return null;

  const keyTitle = titleForChoiceKey(choiceKey);
  const prefix = `${keyTitle}:`;
  if (suffix.toLowerCase().startsWith(prefix.toLowerCase())) {
    const v = suffix.slice(prefix.length).trim();
    return v || null;
  }

  const k = String(choiceKey ?? "").toLowerCase();
  if (needsVariant(k)) {
    const opt = SUBCHOICES[k].find((x) => x.toLowerCase() === suffix.toLowerCase());
    return opt ?? null;
  }
  return null;
}

function variantValueForDisplay(day: OrderDay): string | null {
  const ck = String(day.selectedChoiceKey ?? "").toLowerCase();
  if (!needsVariant(ck)) return null;
  return extractVariantFromNote(ck, day.note ?? null);
}

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

function effectiveChoices(day: OrderDay): Choice[] {
  const api = Array.isArray(day.allowedChoices)
    ? day.allowedChoices.filter((c) => c && String((c as any).key || "").trim().length)
    : [];
  if (api.length) return api;
  if (day.tier === "BASIS" || day.tier === "LUXUS") return FIXED_CHOICES[day.tier];
  return [];
}

function safeUserMessage(raw: string) {
  const s = (raw || "").toLowerCase();
  if (s.includes("locked_after_0800") || s.includes("etter 08") || s.includes("låst etter")) return "Dagen er låst etter 08:00.";
  if (s.includes("date_locked_past") || s.includes("passert")) return "Datoen er passert og kan ikke endres.";
  if (s.includes("company_paused") || s.includes("pauset")) return "Bestilling/avbestilling er midlertidig pauset for firma.";
  if (s.includes("company_closed") || s.includes("stengt")) return "Firma er stengt. Bestilling/avbestilling er låst.";
  if (s.includes("unauth") || s.includes("innlogget")) return "Du er ikke innlogget.";
  if (s.includes("missing_choice_key") || s.includes("velg meny")) return "Velg meny for å bestille.";
  if (s.includes("missing_variant") || s.includes("velg variant")) return "Velg variant først.";
  return raw || "Noe gikk galt. Prøv igjen.";
}

function isoWeekNumber(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstThuDay = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstThuDay + 3);
  const diff = d.getTime() - firstThu.getTime();
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

function formatRangeShort(fromISO: string, toISO: string) {
  const fmt = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short" });
  const from = fmt.format(new Date(`${fromISO}T12:00:00Z`));
  const to = fmt.format(new Date(`${toISO}T12:00:00Z`));
  return `${from}–${to}`;
}

function cutoffChipClass(tone: "ok" | "warn") {
  return tone === "warn" ? "lp-chip lp-chip-warn" : "lp-chip lp-chip-ok";
}

function defaultChoiceKey(day: OrderDay) {
  const choices = effectiveChoices(day);
  const varm = choices.find((c) => String(c.key).toLowerCase() === "varmmat")?.key;
  return varm ?? choices?.[0]?.key ?? null;
}

function choiceLabel(day: OrderDay, key: string) {
  const choices = effectiveChoices(day);
  return choices.find((c) => c.key === key)?.label ?? key;
}

function nowHHMM() {
  return formatTimeNO(new Date().toISOString());
}

function hhmmFromIso(iso: string | null | undefined) {
  if (!iso) return null;
  const t = formatTimeNO(iso);
  return t || null;
}

function hhmmFromUpdatedAt(updatedAt: string | null | undefined) {
  if (!updatedAt) return null;
  return hhmmFromIso(updatedAt);
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

function normAgreementStatus(v: unknown): AgreementStatus | null {
  const s = String(v ?? "").trim().toUpperCase();
  return s ? s : null;
}

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

function StatusChip({ day }: { day: OrderDay }) {
  if (!day.isEnabled) return <span className="lp-chip lp-chip-neutral lp-status-pill whitespace-nowrap">Ikke i avtalen</span>;
  if (day.lockReason === "CUTOFF") return <span className="lp-chip lp-chip-warn lp-status-pill whitespace-nowrap">Låst kl. 08:00</span>;
  if (day.lockReason === "COMPANY" || day.isLocked) return <span className="lp-chip lp-chip-warn lp-status-pill whitespace-nowrap">Sperret</span>;
  const status = day.orderStatus ?? (day.wantsLunch ? "ACTIVE" : null);
  if (status === "ACTIVE") return <span className="lp-chip lp-chip-ok lp-status-pill whitespace-nowrap">Bestilt</span>;
  if (status === "CANCELLED") return <span className="lp-chip lp-chip-neutral lp-status-pill whitespace-nowrap">Avbestilt</span>;
  return <span className="lp-chip lp-chip-neutral lp-status-pill whitespace-nowrap">Ikke bestilt</span>;
}

function LpButton({
  children,
  onClick,
  disabled,
  variant,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant: "primary" | "secondary";
  title?: string;
}) {
  const base = "lp-btn min-h-[44px] border border-[rgb(var(--lp-border))] transition";
  const primary = "lp-btn--primary";
  const secondary = "lp-btn--secondary";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[base, variant === "primary" ? primary : secondary].join(" ")}
    >
      {children}
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

  const [msg, setMsg] = useState<string | null>(null);
  const [dayMsg, setDayMsg] = useState<Record<string, string | null>>({});
  const [savingByDate, setSavingByDate] = useState<Record<string, boolean>>({});

  const [toast, setToast] = useState<string | null>(null);
  const toastT = useTimeoutRef();

  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const abortRef = useRef<AbortController | null>(null);
  const didLoadRef = useRef(false);

  const [variantByDate, setVariantByDate] = useState<Record<string, string>>({});
  const variantByDateRef = useRef<Record<string, string>>({});

  function getVariant(date: string) {
    return variantByDateRef.current[String(date).trim()] ?? "";
  }
  function setVariant(date: string, v: string) {
    const k = String(date).trim();
    variantByDateRef.current[k] = v;
    setVariantByDate((prev) => ({ ...prev, [k]: v }));
  }

  const [openVariantForDate, setOpenVariantForDate] = useState<Record<string, "salatbar" | "paasmurt" | null>>({});
  const [pendingChoiceByDate, setPendingChoiceByDate] = useState<Record<string, string | null>>({});

  function clearPending(dateKey: string) {
    setPendingChoiceByDate((prev) => ({ ...prev, [dateKey]: null }));
  }

  type PendingAction =
    | { kind: "setLunch"; date: string; wantsLunch: boolean; preferredChoiceKey?: string | null; note?: string | null }
    | { kind: "choice"; date: string; choiceKey: string; note?: string | null };

  const pendingRef = useRef<Record<string, PendingAction | null>>({});
  const runningRef = useRef<Record<string, boolean>>({});

  const toastSeqRef = useRef<Record<string, number>>({});
  function nextToastSeq(date: string) {
    const k = String(date).trim();
    const n = (toastSeqRef.current[k] ?? 0) + 1;
    toastSeqRef.current[k] = n;
    return n;
  }
  function isToastSeqCurrent(date: string, seq: number) {
    return (toastSeqRef.current[String(date).trim()] ?? 0) === seq;
  }

  function enqueue(action: PendingAction) {
    const k = String(action.date).trim();
    pendingRef.current[k] = { ...action, date: k };
    void runQueue(k);
  }

  async function runQueue(date: string) {
    const k = String(date).trim();
    if (runningRef.current[k]) return;
    runningRef.current[k] = true;

    try {
      while (true) {
        const action = pendingRef.current[k];
        if (!action) break;
        pendingRef.current[k] = null;

        if (action.kind === "setLunch") {
          await setLunchForDay(action.date, action.wantsLunch, action.preferredChoiceKey ?? null, action.note ?? null);
        } else {
          const d = data?.days?.find((x) => String(x.date).trim() === k);
          if (d) await saveChoice(d, action.choiceKey, action.note ?? null);
        }
      }
    } finally {
      runningRef.current[k] = false;
    }
  }

  function showToast(text: string) {
    setToast(text);
    toastT.set(() => setToast(null), 2200);
  }

  function setDayError(date: string, text: string | null) {
    const k = String(date).trim();
    setDayMsg((prev) => ({ ...prev, [k]: text }));
  }

  function setSaving(date: string, v: boolean) {
    const k = String(date).trim();
    setSavingByDate((prev) => ({ ...prev, [k]: v }));
  }

  function openVariantIfNeeded(dateKey: string, choiceKey: string | null) {
    const k = String(choiceKey ?? "").toLowerCase();
    if (k === "salatbar" || k === "paasmurt") {
      setOpenVariantForDate((prev) => ({ ...prev, [dateKey]: k as any }));
      setPendingChoiceByDate((prev) => ({ ...prev, [dateKey]: k }));
    }
  }

  function buildNote(choiceKey: "salatbar" | "paasmurt", variant: string) {
    return `variant${NOTE_SEP}${buildVariantNote(choiceKey, variant)}`;
  }

  async function loadWindow() {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch(`${API_BASE}/window?weeks=2`, { cache: "no-store", signal: ac.signal });
      const raw = (await res.json().catch(() => null)) as WindowWrapped | null;

      const payload =
        raw && typeof raw === "object" && (raw as any).ok === true && "data" in raw && (raw as any).data
          ? ((raw as any).data as WindowResp)
          : raw && typeof raw === "object" && (raw as any).ok === true && "days" in raw
          ? (raw as any as WindowResp)
          : null;

      if (!res.ok || !raw || (raw as any).ok !== true || !payload) {
        const errText = safeUserMessage(
          (payload as any)?.error ||
            (payload as any)?.detail ||
            (raw as any)?.error ||
            (raw as any)?.detail ||
            (raw as any)?.message ||
            "Kunne ikke hente lunsjplanen."
        );
        setMsg(errText);
        setData(null);
        return;
      }

      const daysRaw = Array.isArray(payload.days) ? payload.days.slice(0, 10) : [];
      const days = daysRaw.map(mapDay);

      // prefill variant from note
      for (const d of days) {
        const dk = String(d.date).trim();
        const ck = String(d.selectedChoiceKey ?? "").toLowerCase();
        if (d.wantsLunch && needsVariant(ck)) {
          const vFromNote = extractVariantFromNote(ck, d.note ?? null);
          if (vFromNote) setVariant(dk, vFromNote);
        }
      }

      // reset per-day errors (but keep saving flags)
      const nextDayMsg: Record<string, string | null> = {};
      const nextSaving: Record<string, boolean> = {};
      for (const d of days) {
        const k = String(d.date).trim();
        nextDayMsg[k] = null;
        nextSaving[k] = Boolean(savingByDate[k]);
      }
      setDayMsg(nextDayMsg);
      setSavingByDate(nextSaving);

      setData({ ...payload, ok: true, days });
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setMsg("Kunne ikke hente lunsjplanen. Prøv igjen.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    void loadWindow();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availability = useMemo(() => {
    return { showThisWeek: canSeeThisWeek(now), openNextWeek: canSeeNextWeek(now) };
  }, [now]);

  const daysThisWeek = useMemo(() => (data?.days ?? []).slice(0, 5), [data]);
  const daysNextWeek = useMemo(() => (data?.days ?? []).slice(5, 10), [data]);

  useEffect(() => {
    if (weekIndex === 0 && !availability.showThisWeek && availability.openNextWeek) {
      setWeekIndex(1);
      showToast("↪︎ Ukeplanen er oppdatert til neste uke.");
      return;
    }
    if (weekIndex === 1 && !availability.openNextWeek) {
      setWeekIndex(0);
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekIndex, availability.showThisWeek, availability.openNextWeek]);

  const visibleDays = useMemo(() => {
    if (weekIndex === 0) return availability.showThisWeek ? daysThisWeek : [];
    return availability.openNextWeek ? daysNextWeek : [];
  }, [weekIndex, availability.showThisWeek, availability.openNextWeek, daysThisWeek, daysNextWeek]);

  const companyLabel = useMemo(() => data?.company?.name?.trim() || null, [data?.company?.name]);

  const agreementNotice = useMemo(() => {
    const m = data?.agreement?.message ?? null;
    return m && String(m).trim().length ? String(m).trim() : null;
  }, [data?.agreement?.message]);

  const agreementStatus = useMemo(() => normAgreementStatus(data?.agreement?.status), [data?.agreement?.status]);
  const agreementStartDate = useMemo(() => data?.agreement?.start_date ?? null, [data?.agreement?.start_date]);

  const hasEnabledDays = useMemo(() => (data?.days ?? []).some((d) => d.isEnabled), [data?.days]);
  const isAgreementActive = agreementStatus === "ACTIVE" || hasEnabledDays;

  const agreementStatusMessage = useMemo(() => {
    if (hasEnabledDays) return null;
    if (!agreementStatus || agreementStatus === "ACTIVE") return null;

    if (agreementStatus === "STARTS_LATER") {
      if (agreementStartDate) return `Avtalen starter ${formatDateNO(agreementStartDate)}.`;
      return "Avtalen starter senere.";
    }
    if (agreementStatus === "PENDING_COMPANY" || agreementStatus === "NOT_READY") {
      return "Firmaet er ikke aktivert ennå. Kontakt firma-admin.";
    }
    return agreementNotice || "Ingen aktiv avtale";
  }, [agreementStatus, agreementStartDate, agreementNotice, hasEnabledDays]);

  const showAgreementNotice = useMemo(
    () => (agreementNotice && agreementStatus === "ACTIVE" ? agreementNotice : null),
    [agreementNotice, agreementStatus]
  );

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

  function lockLabel(day: OrderDay) {
    if (!day.isEnabled) return "Ikke i avtalen";
    if (day.lockReason === "CUTOFF") return "Låst etter 08:00";
    if (day.lockReason === "COMPANY" || day.isLocked) return "Sperret";
    return "";
  }

  function currentIsActive(day: OrderDay) {
    const current = day.orderStatus ?? (day.wantsLunch ? "ACTIVE" : null);
    return current === "ACTIVE";
  }

  async function setLunchForDay(date: string, wantsLunch: boolean, preferredChoiceKey: string | null, note: string | null) {
    const dateKey = String(date).trim();
    const toastSeq = nextToastSeq(dateKey);

    if (!data?.days?.length) return;
    if (savingByDate[dateKey]) return;

    const daySnapshot = data.days.find((d) => String(d.date).trim() === dateKey);
    if (!daySnapshot) return;
    if (!daySnapshot.isEnabled) return;
    if (daySnapshot.isLocked) return;

    const choices = effectiveChoices(daySnapshot);

    setSaving(dateKey, true);
    setMsg(null);
    setDayError(dateKey, null);

    const pick =
      wantsLunch
        ? preferredChoiceKey && choices.some((c) => c.key === preferredChoiceKey)
          ? preferredChoiceKey
          : daySnapshot.selectedChoiceKey && choices.some((c) => c.key === daySnapshot.selectedChoiceKey)
          ? daySnapshot.selectedChoiceKey
          : defaultChoiceKey(daySnapshot)
        : null;

    if (wantsLunch && !pick) {
      const m = "Velg meny for å bestille.";
      setDayError(dateKey, m);
      if (isToastSeqCurrent(dateKey, toastSeq)) showToast(`⚠️ ${m}`);
      setSaving(dateKey, false);
      return;
    }

    const rid = clientRequestId();
    const optimisticStatus: OrderStatus = wantsLunch ? "ACTIVE" : "CANCELLED";

    // Optimistic
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map((d) => {
          if (String(d.date).trim() !== dateKey) return d;
          return {
            ...d,
            wantsLunch,
            orderStatus: optimisticStatus,
            selectedChoiceKey: wantsLunch ? (pick ?? d.selectedChoiceKey ?? null) : null,
            lastSavedAt: nowHHMM(),
            note: wantsLunch ? (note ?? d.note ?? null) : d.note ?? null,
          };
        }),
      };
    });

    try {
      const res = await fetch(`${API_BASE}/set-day`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-rid": rid },
        cache: "no-store",
        body: JSON.stringify({
          date: dateKey,
          wants_lunch: Boolean(wantsLunch),
          choice_key: wantsLunch ? pick : null,
          note: wantsLunch ? (note ?? null) : null,
        }),
      });

      const json = (await res.json().catch(() => null)) as SetDayResp | null;

      if (!res.ok || !json || (json as any).ok === false) {
        const m = safeUserMessage((json as any)?.message || (json as any)?.error || "Kunne ikke lagre.");
        setDayError(dateKey, m);
        if (m.toLowerCase().includes("variant")) openVariantIfNeeded(dateKey, pick);
        if (isToastSeqCurrent(dateKey, toastSeq)) showToast(`⚠️ ${m}`);
        return;
      }

      const serverDate = String((json as any).date ?? (json as any).receipt?.date ?? dateKey).trim();
      const normalizedStatus: OrderStatus = (() => {
        const n = asOrderStatus((json as any).status ?? (json as any).receipt?.status);
        return n ?? optimisticStatus;
      })();

      const active = normalizedStatus === "ACTIVE";
      const serverHHMM = hhmmFromUpdatedAt((json as any).updated_at ?? (json as any).receipt?.updatedAt) || nowHHMM();
      const pricingUnit =
        typeof (json as any)?.pricing?.unit_price === "number" ? Number((json as any).pricing.unit_price) : null;
      const serverNote = (json as any)?.note ?? (active ? note : null);

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map((d) => {
            if (String(d.date).trim() !== serverDate) return d;
            return {
              ...d,
              wantsLunch: active,
              orderStatus: normalizedStatus,
              selectedChoiceKey: active ? (pick ?? d.selectedChoiceKey ?? null) : null,
              lastSavedAt: serverHHMM,
              unit_price: pricingUnit ?? d.unit_price ?? null,
              note: serverNote ?? d.note ?? null,
            };
          }),
        };
      });

      clearPending(serverDate);

      if (active && needsVariant(String(pick ?? ""))) setOpenVariantForDate((prev) => ({ ...prev, [serverDate]: null }));

      if (active && isToastSeqCurrent(serverDate, toastSeq)) showToast(`✅ Registrert • ${formatDateNO(serverDate)} • ${serverHHMM}`);
      if (!active && isToastSeqCurrent(serverDate, toastSeq)) showToast(`✅ Avbestilt • ${formatDateNO(serverDate)} • ${serverHHMM}`);
    } catch {
      setDayError(dateKey, "Kunne ikke lagre. Prøv igjen.");
      if (isToastSeqCurrent(dateKey, toastSeq)) showToast("⚠️ Kunne ikke lagre. Prøv igjen.");
    } finally {
      setSaving(dateKey, false);
    }
  }

  async function saveChoice(day: OrderDay, key: string, note: string | null) {
    const dateKey = String(day.date).trim();
    const toastSeq = nextToastSeq(dateKey);

    if (!data?.days?.length) return;
    if (!canAct(day)) return;
    if (savingByDate[dateKey]) return;

    if (!currentIsActive(day)) {
      enqueue({ kind: "setLunch", date: dateKey, wantsLunch: true, preferredChoiceKey: key, note: note ?? null });
      return;
    }

    setSaving(dateKey, true);
    setMsg(null);
    setDayError(dateKey, null);

    // Optimistic
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map((d) => {
          if (String(d.date).trim() !== dateKey) return d;
          return {
            ...d,
            selectedChoiceKey: key,
            wantsLunch: true,
            orderStatus: "ACTIVE",
            lastSavedAt: nowHHMM(),
            note: note ?? d.note ?? null,
          };
        }),
      };
    });

    const rid = clientRequestId();

    try {
      const res = await fetch(`${API_BASE}/set-choice`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-rid": rid },
        cache: "no-store",
        body: JSON.stringify({ date: dateKey, choice_key: key, note: note ?? null }),
      });

      const json = (await res.json().catch(() => null)) as SetChoiceResp | null;

      if (!res.ok || !json || (json as any).ok === false) {
        const m = safeUserMessage((json as any)?.message || (json as any)?.error || "Kunne ikke lagre menyvalg.");
        setDayError(dateKey, m);
        if (m.toLowerCase().includes("variant")) openVariantIfNeeded(dateKey, key);
        if (isToastSeqCurrent(dateKey, toastSeq)) showToast(`⚠️ ${m}`);
        return;
      }

      const serverDate = String((json as any).date ?? (json as any).receipt?.date ?? dateKey).trim();
      const serverHHMM = hhmmFromUpdatedAt((json as any).updated_at ?? (json as any).receipt?.updatedAt) || nowHHMM();

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map((d) => {
            if (String(d.date).trim() !== serverDate) return d;
            return {
              ...d,
              selectedChoiceKey: (json as any).choice_key ?? key,
              orderStatus: "ACTIVE",
              wantsLunch: true,
              lastSavedAt: serverHHMM,
              note: (json as any).note ?? note ?? d.note ?? null,
            };
          }),
        };
      });

      clearPending(serverDate);

      if (needsVariant(String(key))) setOpenVariantForDate((prev) => ({ ...prev, [serverDate]: null }));
      if (isToastSeqCurrent(serverDate, toastSeq))
        showToast(`✅ Lagret: ${choiceLabel(day, key)} • ${formatDateNO(serverDate)} • ${serverHHMM}`);
    } catch {
      setDayError(dateKey, "Kunne ikke lagre menyvalg. Prøv igjen.");
      if (isToastSeqCurrent(dateKey, toastSeq)) showToast("⚠️ Kunne ikke lagre menyvalg. Prøv igjen.");
    } finally {
      setSaving(dateKey, false);
    }
  }

  function onClickAvbestill(day: OrderDay) {
    const dateKey = String(day.date).trim();
    if (savingByDate[dateKey]) return;
    if (!day.isEnabled) return;
    if (day.isLocked) return;
    if (!currentIsActive(day)) return;
    clearPending(dateKey);
    enqueue({ kind: "setLunch", date: dateKey, wantsLunch: false });
  }

  function onSelectChoice(day: OrderDay, key: string) {
    const dateKey = String(day.date).trim();
    if (savingByDate[dateKey]) return;
    if (!day.isEnabled) return;
    if (day.isLocked) return;

    const lowerKey = String(key).toLowerCase();

    if (needsVariant(lowerKey)) {
      setOpenVariantForDate((prev) => ({ ...prev, [dateKey]: lowerKey as any }));
      setPendingChoiceByDate((prev) => ({ ...prev, [dateKey]: lowerKey }));
      setDayError(dateKey, `Velg variant for ${titleForChoiceKey(lowerKey)}.`);
      showToast(`⚠️ Velg variant for ${titleForChoiceKey(lowerKey)}.`);
      return;
    }

    clearPending(dateKey);
    enqueue({ kind: "choice", date: dateKey, choiceKey: key });
  }

  function onVariantSelected(day: OrderDay, choiceKey: "salatbar" | "paasmurt", variantValue: string) {
    const dateKey = String(day.date).trim();
    if (savingByDate[dateKey]) return;
    if (!day.isEnabled) return;
    if (day.isLocked) return;

    const v = String(variantValue ?? "").trim();
    setVariant(dateKey, v);
    setDayError(dateKey, null);

    if (!v) {
      setDayError(dateKey, `Velg variant for ${titleForChoiceKey(choiceKey)}.`);
      return;
    }

    const note = buildNote(choiceKey, v);

    setOpenVariantForDate((prev) => ({ ...prev, [dateKey]: null }));

    if (!currentIsActive(day)) {
      enqueue({ kind: "setLunch", date: dateKey, wantsLunch: true, preferredChoiceKey: choiceKey, note });
      return;
    }

    enqueue({ kind: "choice", date: dateKey, choiceKey, note });
  }

  const availabilityText = useMemo(() => {
    if (!availability.openNextWeek) return "Neste uke åpner torsdag kl. 08:00.";
    return null;
  }, [availability.openNextWeek]);

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
          {availabilityText ? <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{availabilityText}</div> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {availability.showThisWeek ? (
            <button
              type="button"
              onClick={() => setWeekIndex(0)}
              className={cx("lp-btn lp-btn--secondary min-h-[44px]", weekIndex === 0 ? "lp-active-ring" : "")}
              aria-pressed={weekIndex === 0}
              disabled={isAnySaving}
            >
              Denne uke
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setWeekIndex(1)}
            className={cx("lp-btn lp-btn--secondary min-h-[44px]", weekIndex === 1 ? "lp-active-ring" : "")}
            aria-pressed={weekIndex === 1}
            disabled={isAnySaving || !availability.openNextWeek}
            title={!availability.openNextWeek ? "Neste uke åpner torsdag kl. 08:00." : ""}
          >
            Neste uke
          </button>

          <button
            type="button"
            onClick={loadWindow}
            className="lp-btn lp-btn--ghost min-h-[44px]"
            disabled={loading || isAnySaving}
          >
            Oppdater
          </button>
        </div>
      </div>

      {showAgreementNotice ? (
        <div className="mt-4 rounded-2xl bg-white/70 p-4 text-sm text-[rgb(var(--lp-muted))]">{showAgreementNotice}</div>
      ) : null}

      {loading ? (
        <div className="mt-4 text-sm text-[rgb(var(--lp-muted))]">Henter lunsjplan …</div>
      ) : msg ? (
        <div className="mt-4 rounded-2xl border border-[rgb(var(--lp-border))] bg-white/70 p-4 text-sm text-[rgb(var(--lp-muted))]">
          {msg}
        </div>
      ) : !isAgreementActive ? (
        <div className="mt-4 rounded-2xl bg-white/70 p-5 text-sm text-[rgb(var(--lp-muted))]">
          <div className="text-base font-semibold text-[rgb(var(--lp-fg))]">{agreementStatusMessage || "Ingen aktiv avtale"}</div>
        </div>
      ) : !visibleDays.length ? (
        <div className="mt-4 rounded-2xl border border-[rgb(var(--lp-border))] bg-white/70 p-4 text-sm text-[rgb(var(--lp-muted))]">
          Ingen uke er tilgjengelig akkurat nå.
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {visibleDays.map((day) => {
              const dateKey = String(day.date).trim();
              const saving = Boolean(savingByDate[dateKey]);
              const disabled = saving || day.isLocked || !day.isEnabled;
              const inlineErr = dayMsg[dateKey] ?? null;

              const choices = effectiveChoices(day);
              const active = currentIsActive(day);

              const orderedKey = active ? (day.selectedChoiceKey ?? null) : null;
              const pendingKey = pendingChoiceByDate[dateKey] ?? null;

              const openKey = openVariantForDate[dateKey] ?? null;
              const variantKey: "salatbar" | "paasmurt" | null = openKey ? openKey : null;
              const showVariant = Boolean(variantKey) && !disabled;
              const currentVariantValue = variantKey ? getVariant(dateKey) : "";

              const orderedLabel = orderedKey ? choiceLabel(day, orderedKey) : null;
              const orderedVariant = active ? variantValueForDisplay(day) : null;

              return (
                <div
                  key={dateKey}
                  className={cx(
                    "rounded-[18px] bg-[rgb(var(--lp-surface))] p-4 shadow-[0_1px_2px_rgba(32,33,36,0.06)]",
                    saving ? "opacity-90" : ""
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-[rgb(var(--lp-fg))]">
                        {weekdayLabel(day.weekday)}
                        <span className="ml-2 text-sm font-normal text-[rgb(var(--lp-muted))]">{formatDateNO(dateKey)}</span>
                      </div>

                      <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
                        <span className="font-medium text-[rgb(var(--lp-fg))]">{day.menuTitle ?? "Meny"}</span>
                        <span className="text-[rgb(var(--lp-muted))]">
                          {" "}
                          · {day.menuDescription ? day.menuDescription : "Kommer"}
                        </span>
                      </div>

                      <div className="mt-2 text-sm">
                        {active && orderedLabel ? (
                          <span className="text-[rgb(var(--lp-fg))] font-semibold">
                            ✅ Bestilt: {orderedLabel}
                            {orderedVariant ? (
                              <span className="font-normal text-[rgb(var(--lp-muted))]"> ({orderedVariant})</span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-[rgb(var(--lp-muted))]">Ikke bestilt</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={cx(
                          "inline-flex min-h-[24px] items-center justify-center rounded-full px-3 text-xs font-semibold",
                          !day.isEnabled
                            ? "bg-neutral-200 text-neutral-500"
                            : day.tier === "LUXUS"
                            ? "bg-amber-100 text-amber-900"
                            : day.tier === "BASIS"
                            ? "bg-slate-200 text-slate-900"
                            : "bg-neutral-200 text-neutral-500"
                        )}
                      >
                        {day.isEnabled && day.tier ? tierLabel(day.tier) : "Ikke i avtalen"}
                      </span>

                      {day.isEnabled ? <StatusChip day={day} /> : null}

                      <div className="flex items-center gap-2">
                        {active ? (
                          <LpButton
                            variant="secondary"
                            disabled={disabled}
                            onClick={() => onClickAvbestill(day)}
                            title={disabled ? lockLabel(day) : "Avbestill lunsj"}
                          >
                            Avbestill
                          </LpButton>
                        ) : null}

                        <span className="text-sm text-[rgb(var(--lp-muted))] whitespace-nowrap">
                          {saving
                            ? "Lagrer…"
                            : disabled
                            ? `🔒 ${lockLabel(day)}`
                            : active
                            ? "Bestilt"
                            : "Velg meny for å bestille"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {inlineErr ? (
                    <div className="mt-3 text-sm text-[rgb(var(--lp-fg))]">
                      <span className="text-[rgb(var(--lp-muted))]">⚠︎ </span>
                      <span>{inlineErr}</span>
                    </div>
                  ) : null}

                  <div className="mt-4">
                    {choices.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {choices.map((c) => {
                          const keyLower = String(c.key).toLowerCase();
                          const isOrdered = Boolean(orderedKey && orderedKey === c.key);
                          const isPending = Boolean(pendingKey && pendingKey === keyLower && !isOrdered);

                          return (
                            <button
                              key={c.key}
                              type="button"
                              disabled={disabled}
                              onClick={() => onSelectChoice(day, c.key)}
                              className={cx(
                                "min-h-[44px] rounded-full border px-4 py-2 text-sm transition whitespace-nowrap",
                                "focus:outline-none focus:ring-2 focus:ring-offset-2",
                                disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-white active:brightness-[0.99]",
                                isOrdered
                                  ? "bg-[rgb(var(--lp-surface))] text-[rgb(var(--lp-fg))] font-semibold border-transparent lp-active-ring"
                                  : isPending
                                  ? "bg-white/90 text-[rgb(var(--lp-fg))] border-transparent ring-2 ring-[#2563eb]"
                                  : "border-[rgb(var(--lp-border))] bg-white/80 text-[rgb(var(--lp-muted))]"
                              )}
                              title={
                                disabled
                                  ? lockLabel(day)
                                  : isOrdered
                                  ? "Bestilt"
                                  : needsVariant(keyLower)
                                  ? "Trykk og velg variant"
                                  : active
                                  ? "Klikk for å endre"
                                  : "Klikk for å bestille"
                              }
                            >
                              {isOrdered ? `✓ ${c.label ?? c.key}` : c.label ?? c.key}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}

                    {showVariant && variantKey ? (
                      <div className="mt-3 rounded-2xl border border-[rgb(var(--lp-border))] bg-white/70 p-3">
                        <div className="text-xs text-[rgb(var(--lp-muted))] mb-2">
                          Velg variant for{" "}
                          <span className="font-semibold text-[rgb(var(--lp-fg))]">{titleForChoiceKey(variantKey)}</span>
                        </div>

                        <select
                          value={currentVariantValue}
                          onChange={(e) => onVariantSelected(day, variantKey, e.target.value)}
                          className="min-h-[48px] w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 text-sm text-[rgb(var(--lp-fg))] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[rgba(var(--lp-ring),0.25)]"
                          disabled={disabled}
                        >
                          <option value="">{`Velg ${titleForChoiceKey(variantKey).toLowerCase()}-variant`}</option>
                          {SUBCHOICES[variantKey].map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>

                        <div className="mt-2 text-xs text-[rgb(var(--lp-muted))]">Velges og registreres automatisk.</div>
                      </div>
                    ) : null}
                  </div>

                  {receiptText(day, saving) ? (
                    <div className="mt-4 text-xs text-[rgb(var(--lp-muted))]">{receiptText(day, saving)}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}
