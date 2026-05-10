"use client";

import { ClockIcon, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { formatDateNO, formatWeekdayNO } from "@/lib/date/format";
import { addDaysISO } from "@/lib/date/oslo";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import {
  findRecommendedDateInWindow,
  getTopWeekdayKey,
  getWeekdayOrderCount,
  pickDefaultDateFromPatterns,
  readOrderPatterns,
  recordSuccessfulOrder,
  shouldShowHabitNudge,
  weekdayKeyFromDateISO,
} from "@/lib/week/orderPatternsClient";

const API_ORDER = "/api/order";

function safeVibrate(ms: number) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator && typeof navigator.vibrate === "function") {
      navigator.vibrate(ms);
    }
  } catch {
    /* ignore */
  }
}

type DayRow = {
  date: string;
  weekday: string;
  tier: "BASIS" | "LUXUS" | null;
  allowedChoices: MealChoice[];
  selectedChoiceKey: string | null;
  isLocked: boolean;
  isEnabled: boolean;
  lockReason?: string | null;
  orderStatus: "ACTIVE" | "CANCELLED" | null;
  wantsLunch: boolean;
  menuTitle?: string | null;
  menuDescription: string | null;
  allergens: string[];
  menuImages: string[];
};

type MealChoice = {
  key: string;
  label: string;
};

type WindowPayload = {
  ok?: boolean;
  days?: unknown[];
  agreement?: { status?: string; message?: string | null; delivery_days?: string[] };
  company?: { name?: string };
  /** Serverfasit — ikke utled bestillbarhet i klient utenom dette + dag-rader. */
  serverOsloDate?: string;
  weekOrderingAllowed?: boolean;
  todayCutoffStatus?: "PAST" | "TODAY_OPEN" | "TODAY_LOCKED" | "FUTURE_OPEN";
  orderingUrgencyHint?: boolean;
  /** Sanity meny-fetch krasjet — skal ikke forveksles med tom publisert meny. */
  menuSanityFetchFailed?: boolean;
  error?: string;
  message?: string;
};

type ConfirmPayload = { date: string; action: "order" | "cancel" };
type PreviewMode = "basis" | "luxus" | "mixed";
type ErrorBannerState = { message: string; code: string | null };

function clientRid() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function readApiError(json: Record<string, unknown> | null): { code: string | null; message: string } {
  if (!json || typeof json !== "object") return { code: null, message: "" };
  const message =
    typeof json.message === "string" && json.message.trim()
      ? json.message.trim()
      : typeof json.error === "string" && json.error.trim()
        ? json.error.trim()
        : "";
  const code =
    typeof json.error === "string" && json.error.trim()
      ? json.error.trim()
      : typeof json.code === "string" && json.code.trim()
        ? json.code.trim()
        : null;
  return { code, message };
}

function isCutoffApiError(code: string | null, message: string): boolean {
  const c = String(code ?? "").toUpperCase();
  const m = String(message ?? "").toUpperCase();
  return c === "CUTOFF_PASSED" || c === "LOCKED" || m.includes("BESTILLINGSFRISTEN") || m.includes("FRISTEN");
}

function asOrderStatus(v: unknown): "ACTIVE" | "CANCELLED" | null {
  const s = String(v ?? "").toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "CANCELLED" || s === "CANCELED") return "CANCELLED";
  return null;
}

function asTier(v: unknown): "BASIS" | "LUXUS" | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "BASIS" || s === "LUXUS") return s;
  return null;
}

function mapChoice(raw: unknown): MealChoice | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const key = String(c.key ?? "").trim();
  if (!key) return null;
  const label = String(c.label ?? key).trim();
  return { key, label: label || key };
}

function mapDay(raw: unknown): DayRow | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const date = String(d.date ?? "").trim();
  if (!date) return null;
  const status = asOrderStatus(d.orderStatus ?? d.status);
  const wants =
    typeof d.wantsLunch === "boolean"
      ? Boolean(d.wantsLunch)
      : typeof d.wants_lunch === "boolean"
        ? Boolean(d.wants_lunch)
        : status === "ACTIVE";

  return {
    date,
    weekday: String(d.weekday ?? ""),
    tier: asTier(d.tier),
    allowedChoices: Array.isArray(d.allowedChoices) ? (d.allowedChoices as unknown[]).map(mapChoice).filter(Boolean) as MealChoice[] : [],
    selectedChoiceKey: d.selectedChoiceKey != null ? String(d.selectedChoiceKey).trim() || null : null,
    isLocked: Boolean(d.isLocked),
    isEnabled: Boolean(d.isEnabled),
    lockReason: (d.lockReason as string | null | undefined) ?? null,
    orderStatus: status,
    wantsLunch: status === "ACTIVE" ? true : status === "CANCELLED" ? false : wants,
    menuTitle: d.menuTitle != null ? String(d.menuTitle) : null,
    menuDescription: d.menuDescription != null ? String(d.menuDescription) : null,
    allergens: Array.isArray(d.allergens) ? (d.allergens as unknown[]).map((x) => String(x)) : [],
    menuImages: Array.isArray((d as any).menuImages)
      ? ((d as any).menuImages as unknown[]).map((x) => String(x)).filter(Boolean)
      : (d as any).menuImage
        ? [String((d as any).menuImage)]
        : [],
  };
}

function unwrapWindow(json: unknown): WindowPayload | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (o.ok !== true) return null;
  if ("data" in o && o.data && typeof o.data === "object") {
    return o.data as WindowPayload;
  }
  if ("days" in o) return o as WindowPayload;
  return null;
}

function parseWeekMetaFromWindowJson(raw: unknown): { thisWeekStart: string | null; canSeeNextWeek: boolean } {
  if (!raw || typeof raw !== "object") return { thisWeekStart: null, canSeeNextWeek: false };
  const o = raw as Record<string, unknown>;
  const data = o.data && typeof o.data === "object" ? (o.data as Record<string, unknown>) : null;
  const week = data?.week && typeof data.week === "object" ? (data.week as Record<string, unknown>) : null;
  return {
    thisWeekStart: week?.thisWeekStart != null ? String(week.thisWeekStart).slice(0, 10) : null,
    canSeeNextWeek: week?.canSeeNextWeek === true,
  };
}

/** Neste ukes start (mandag) relativt til API sitt thisWeekStart — deterministisk, samme som addDaysISO(..., 7). */
function getNextWeekStartISO(thisWeekStartISO: string): string {
  return addDaysISO(thisWeekStartISO, 7);
}

const BTN_TOUCH =
  "motion-safe:transition-transform motion-safe:duration-150 motion-safe:active:scale-[0.95] transition-colors duration-100 active:bg-gray-100/90";

const CARD_TRANSFORM =
  "motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:scale-[1.01] motion-safe:active:scale-[0.97] will-change-transform";

const BASIS_CATEGORY_LABELS = ["Salatbar", "Påsmurt", "Varmmat"];
const LUXUS_CATEGORY_LABELS = ["Salatbar", "Påsmurt", "Sushi", "Pokebowl", "Thaimat", "Varmmat"];
const PRIMARY_CTA =
  "bg-gradient-to-r from-[#f5c518] to-[#ffd43b] text-neutral-950 shadow-[0_16px_40px_rgba(245,197,24,0.32)]";
const SECONDARY_CTA = "border border-black/10 bg-white text-neutral-900 shadow-[0_10px_26px_rgba(24,20,16,0.06)]";

/** Deterministisk status — samme rekkefølge som API-låser (CUTOFF / firma / avtale). */
function statusLabelForDay(day: DayRow): "Kan bestilles" | "Bestilt" | "Avbestilt" | "Stengt" | "Ikke tilgjengelig" {
  const notInAgreement = !day.isEnabled;
  const companyClosed = day.isLocked && day.lockReason === "COMPANY";
  const cutoffClosed = day.isLocked && day.lockReason === "CUTOFF";
  if (notInAgreement) return "Ikke tilgjengelig";
  if (day.orderStatus === "ACTIVE") return "Bestilt";
  if (day.orderStatus === "CANCELLED") return "Avbestilt";
  if (companyClosed || cutoffClosed) return "Stengt";
  return "Kan bestilles";
}

function badgeClassForStatus(s: ReturnType<typeof statusLabelForDay>) {
  if (s === "Bestilt") return "bg-emerald-50 text-emerald-900 ring-emerald-200";
  if (s === "Avbestilt") return "bg-amber-50 text-amber-950 ring-amber-200";
  if (s === "Stengt") return "bg-neutral-100 text-neutral-700 ring-black/10";
  if (s === "Ikke tilgjengelig") return "bg-stone-100 text-stone-700 ring-black/10";
  return "bg-[#fff7dc] text-neutral-900 ring-amber-200";
}

/** Under primær-CTA: tydeliggjør frist (samme semantikk som CUTOFF-lås fra API). */
function CutoffSafetyHint({ day, className = "" }: { day: DayRow; className?: string }) {
  const cutoffClosed = day.isLocked && day.lockReason === "CUTOFF";
  const isBeforeCutoff = !cutoffClosed;
  return (
    <p className={`mt-1 text-xs text-gray-500 ${className}`}>
      {isBeforeCutoff ? "Kan endres frem til kl. 08:00" : "Fristen for dagens endring er passert."}
    </p>
  );
}

function CutoffPassedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-950 ring-1 ring-amber-200 ${className}`}
    >
      Frist passert 08:00
    </span>
  );
}

function tierChoiceLimit(tier: DayRow["tier"]) {
  if (tier === "LUXUS") return 6;
  if (tier === "BASIS") return 3;
  return 0;
}

function tierLabel(day: DayRow) {
  const limit = tierChoiceLimit(day.tier);
  if (day.tier === "LUXUS") return `Luxus - ${limit} valg`;
  if (day.tier === "BASIS") return `Basis - ${limit} valg`;
  return "Ikke tilgjengelig";
}

function fallbackCategoryLabels(day: DayRow) {
  if (day.tier === "LUXUS") return LUXUS_CATEGORY_LABELS;
  if (day.tier === "BASIS") return BASIS_CATEGORY_LABELS;
  return [];
}

function isReadableChoiceLabel(choice: MealChoice) {
  const label = choice.label.trim();
  if (!label) return false;
  if (label.toLowerCase() === choice.key.trim().toLowerCase()) return false;
  if (/^[A-Z0-9_ -]+$/.test(label) && label.includes("_")) return false;
  return true;
}

function getTierCategories(day: DayRow) {
  const limit = tierChoiceLimit(day.tier);
  if (!limit) return [];
  const readable = day.allowedChoices.filter(isReadableChoiceLabel).slice(0, limit).map((choice) => choice.label.trim());
  if (readable.length === limit) return readable;
  return fallbackCategoryLabels(day);
}

function selectedDayLabel(day: DayRow) {
  const weekday = formatWeekdayNO(day.date) || day.weekday;
  return `${weekday} ${formatDateNO(day.date)}`.trim();
}

function orderStatusLabel(day: DayRow) {
  if (!day.isEnabled) return "Ikke tilgjengelig";
  if (day.orderStatus === "ACTIVE") return "Bestilt";
  if (day.isLocked && day.lockReason === "CUTOFF") return "Frist passert";
  if (day.isLocked) return "Ikke tilgjengelig";
  return "Ikke bestilt";
}

function canOrderDay(day: DayRow, canAct: boolean, globalBusy: boolean) {
  return canAct && day.isEnabled && !day.isLocked && !globalBusy;
}

function previewTierForDay(mode: PreviewMode, index: number): DayRow["tier"] {
  if (mode === "luxus") return "LUXUS";
  if (mode === "mixed") return index < 3 ? "BASIS" : "LUXUS";
  return "BASIS";
}

function choicesForTier(tier: DayRow["tier"]): MealChoice[] {
  if (!tier) return [];
  return (tier === "LUXUS" ? LUXUS_CATEGORY_LABELS : BASIS_CATEGORY_LABELS).map((label) => ({
    key: label.toLowerCase().replace(/\s+/g, "-"),
    label,
  }));
}

function buildPreviewDays(mode: PreviewMode = "basis"): DayRow[] {
  const dates = ["2026-05-04", "2026-05-05", "2026-05-06", "2026-05-07", "2026-05-08"];
  return dates.map((date, index) => {
    const tier = previewTierForDay(mode, index);
    return {
      date,
      weekday: formatWeekdayNO(date),
      tier,
      allowedChoices: choicesForTier(tier),
      selectedChoiceKey: null,
      isLocked: false,
      isEnabled: true,
      lockReason: null,
      orderStatus: null,
      wantsLunch: false,
      menuTitle: null,
      menuDescription: null,
      allergens: [],
      menuImages: [],
    };
  });
}

function ReadOnlyPreviewHint({ className = "" }: { className?: string }) {
  return <p className={`mt-1 text-xs font-medium text-neutral-500 ${className}`}>Kun forhåndsvisning</p>;
}

function selectedChoiceLabel(day: DayRow) {
  if (!day.selectedChoiceKey) return null;
  const selected = day.allowedChoices.find((c) => c.key.toLowerCase() === day.selectedChoiceKey?.toLowerCase());
  return selected?.label ?? day.selectedChoiceKey;
}

function DayMenuSummary({ day, compact = false }: { day: DayRow; compact?: boolean }) {
  const choices = getTierCategories(day);
  const selected = selectedChoiceLabel(day);

  return (
    <div className={`${compact ? "mt-3" : "mt-4"} text-center`}>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="inline-flex items-center rounded-full bg-[#fff3c8] px-3 py-1 text-xs font-semibold text-neutral-950 ring-1 ring-amber-200">
          {tierLabel(day)}
        </span>
        {selected ? (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-950 ring-1 ring-emerald-200">
            Valgt: {selected}
          </span>
        ) : null}
      </div>

      {choices.length ? (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {choices.map((choice) => (
            <span
              key={choice}
              className={[
                "rounded-full px-3 py-1 text-xs font-medium ring-1",
                selected && choice.toLowerCase() === selected.toLowerCase()
                  ? "bg-neutral-950 text-white ring-neutral-950"
                  : "bg-white/80 text-neutral-800 ring-black/10",
              ].join(" ")}
            >
              {choice}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-2xl bg-white/70 px-3 py-2 text-sm text-neutral-600 ring-1 ring-black/10">
          Menyen er ikke publisert ennå.
        </p>
      )}
    </div>
  );
}

function WeekLoadingSkeleton({ mobileLayout }: { mobileLayout: boolean }) {
  return (
    <ul className={`flex flex-col gap-4 ${mobileLayout ? "pb-32" : ""}`} aria-busy="true" aria-label="Laster ukeplan">
      {[0, 1, 2, 3, 4].map((i) => (
        <li
          key={i}
          className="animate-pulse rounded-2xl border border-black/10 bg-white/90 p-4 text-center shadow-sm md:text-left"
        >
          <div className="mx-auto mb-2 h-6 w-24 rounded bg-gray-200 md:mx-0" />
          <div className="mb-2 h-4 w-full rounded bg-gray-200" />
          <div className="mb-2 h-4 w-full rounded bg-gray-200" />
          <div className="h-10 w-full rounded bg-gray-200" />
        </li>
      ))}
    </ul>
  );
}

type Props = {
  canAct: boolean;
  billingHoldReason?: string | null;
  previewMode?: PreviewMode;
  readOnlyPreview?: boolean;
};

function WeekConfirmModal({
  open,
  title,
  onCancel,
  onConfirm,
  confirming,
  quickMotion,
}: {
  open: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirming: boolean;
  /** Raskere overgang når brukeren ofte bestiller samme ukedag — fortsatt eksplisitt trykk. */
  quickMotion?: boolean;
}) {
  if (!open) return null;
  const shell = quickMotion
    ? "motion-safe:transition-opacity motion-safe:duration-100 motion-safe:ease-out"
    : "motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-out";
  const panel = quickMotion
    ? "motion-safe:transition-transform motion-safe:duration-100 motion-safe:ease-out"
    : "motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out";
  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center ${shell}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="week-confirm-title"
    >
      <div className={`w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl ring-1 ring-black/10 sm:p-6 ${panel}`}>
        <p id="week-confirm-title" className="text-center text-base font-semibold text-neutral-900">
          {title}
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            disabled={confirming}
            onClick={onCancel}
            className={`flex min-h-[48px] flex-1 items-center justify-center rounded-full border border-black/15 bg-white px-4 text-sm font-semibold text-neutral-900 disabled:opacity-50 ${BTN_TOUCH}`}
          >
            Avbryt
          </button>
          <button
            type="button"
            disabled={confirming}
            onClick={onConfirm}
            className={`flex min-h-[48px] flex-1 items-center justify-center rounded-full bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-50 ${BTN_TOUCH}`}
          >
            {confirming ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                <span>Behandler…</span>
              </span>
            ) : (
              "Bekreft"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

type RowBase = {
  day: DayRow;
  canAct: boolean;
  globalBusy: boolean;
  busyThis: boolean;
  weekdayLabel: string;
  statusLabel: ReturnType<typeof statusLabelForDay>;
  onRequestOrder: () => void;
  onRequestCancel: () => void;
  /** Prediktiv markering — kun UI, ingen auto-handling. */
  insightRecommended?: boolean;
  insightPreferredMotion?: boolean;
  readOnlyPreview?: boolean;
};

function WeekDayRowDesktop({
  day,
  canAct,
  globalBusy,
  busyThis,
  weekdayLabel,
  statusLabel,
  onRequestOrder,
  onRequestCancel,
  insightRecommended,
  insightPreferredMotion,
    readOnlyPreview,
}: RowBase) {
  const ordered = day.orderStatus === "ACTIVE";
  const cutoffClosed = day.isLocked && day.lockReason === "CUTOFF";
  const companyClosed = day.isLocked && day.lockReason === "COMPANY";
  const notInAgreement = !day.isEnabled;
  const canClick = canOrderDay(day, canAct, globalBusy);

  return (
    <li
      className={`rounded-2xl border border-black/10 bg-white/90 p-4 text-center shadow-sm md:text-left ${CARD_TRANSFORM} ${
        insightPreferredMotion
          ? "motion-safe:ring-1 motion-safe:ring-neutral-300/60 motion-safe:animate-pulse"
          : ""
      }`}
    >
      <div className="flex flex-col items-center gap-1 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-base font-semibold capitalize text-neutral-900">
            {weekdayLabel} · {formatDateNO(day.date)}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 md:justify-start">
            <span
              className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${badgeClassForStatus(statusLabel)}`}
            >
              {statusLabel}
            </span>
            {cutoffClosed ? <CutoffPassedBadge /> : null}
          </div>
          {insightRecommended ? (
            <div className="mt-2 max-w-md space-y-0.5 text-center md:text-left">
              <span className="inline-flex rounded-full bg-pink-50 px-2.5 py-0.5 text-[11px] font-semibold text-pink-950 ring-1 ring-pink-200">
                Anbefalt for deg
              </span>
              <p className="text-[11px] text-neutral-600">Du bestiller ofte denne dagen</p>
              <p className="text-[10px] text-neutral-400">Basert på dine tidligere bestillinger</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 border-t border-black/5 pt-3 text-center md:text-left">
        {day.menuImages.length ? (
          <div className="mb-2 flex flex-wrap justify-center gap-2 md:justify-start">
            {day.menuImages.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt=""
                className="h-24 max-w-full rounded-lg object-cover ring-1 ring-black/10"
              />
            ))}
          </div>
        ) : null}
        <p className="text-sm font-semibold text-neutral-900">{day.menuTitle ?? "Menyen er ikke publisert ennå."}</p>
        {day.menuDescription ? (
          <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{day.menuDescription}</p>
        ) : null}
        {day.allergens.length > 0 ? (
          <p className="mt-2 text-xs text-neutral-600">
            <span className="font-semibold">Allergener: </span>
            {day.allergens.join(", ")}
          </p>
        ) : null}
        <DayMenuSummary day={day} />
      </div>

      <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center md:justify-start">
        {notInAgreement ? (
          <span className="text-center text-sm text-neutral-500">Ikke leveringsdag i avtalen.</span>
        ) : cutoffClosed ? (
          <div className="flex w-full flex-col sm:w-full md:w-auto">
            <button
              type="button"
              disabled
              className={`min-h-[48px] w-full cursor-not-allowed rounded-full border border-black/10 bg-neutral-50 px-4 text-sm font-semibold text-neutral-500 sm:w-auto ${BTN_TOUCH}`}
            >
              Frist passert kl. 08:00
            </button>
            <CutoffSafetyHint day={day} className="text-center md:text-left" />
          </div>
        ) : companyClosed ? (
          <span className="text-center text-sm text-neutral-600">Bestilling stengt for firma</span>
        ) : ordered ? (
          <div className="flex w-full flex-col sm:w-full md:w-auto">
            <button
              type="button"
              disabled={readOnlyPreview || !canClick}
              aria-disabled={readOnlyPreview || !canClick}
              title={readOnlyPreview ? "Kun forhåndsvisning" : undefined}
              onClick={readOnlyPreview ? undefined : onRequestCancel}
              className={`flex min-h-[54px] items-center justify-center rounded-full px-4 text-sm font-bold disabled:pointer-events-none disabled:opacity-50 ${SECONDARY_CTA} ${BTN_TOUCH}`}
            >
              {busyThis ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Behandler…
                </>
              ) : (
                "Avbestill lunsj"
              )}
            </button>
            {readOnlyPreview ? <ReadOnlyPreviewHint className="text-center md:text-left" /> : <CutoffSafetyHint day={day} className="text-center md:text-left" />}
          </div>
        ) : (
          <div className="flex w-full flex-col sm:w-full md:w-auto">
            <button
              type="button"
              disabled={readOnlyPreview || !canClick}
              aria-disabled={readOnlyPreview || !canClick}
              title={readOnlyPreview ? "Kun forhåndsvisning" : undefined}
              onClick={readOnlyPreview ? undefined : onRequestOrder}
              className={`flex min-h-[54px] items-center justify-center rounded-full px-6 text-sm font-bold disabled:pointer-events-none disabled:opacity-50 ${PRIMARY_CTA} ${BTN_TOUCH}`}
            >
              {busyThis ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Behandler…
                </>
              ) : (
            "Bestill lunsj"
              )}
            </button>
            {readOnlyPreview ? <ReadOnlyPreviewHint className="text-center md:text-left" /> : <CutoffSafetyHint day={day} className="text-center md:text-left" />}
          </div>
        )}
      </div>
    </li>
  );
}

type MobileCardProps = RowBase & {
  isSelected: boolean;
  onSelectDay: () => void;
};

const WeekDayCardMobile = memo(
  function WeekDayCardMobile({
    day,
    canAct,
    globalBusy,
    busyThis,
    weekdayLabel,
    statusLabel,
    isSelected,
    onSelectDay,
    onRequestOrder,
    onRequestCancel,
    insightRecommended,
    insightPreferredMotion,
    readOnlyPreview,
  }: MobileCardProps) {
    const ordered = day.orderStatus === "ACTIVE";
    const cutoffClosed = day.isLocked && day.lockReason === "CUTOFF";
    const companyClosed = day.isLocked && day.lockReason === "COMPANY";
    const notInAgreement = !day.isEnabled;
    const canClick = canOrderDay(day, canAct, globalBusy);
    const categories = getTierCategories(day);
    const selected = selectedChoiceLabel(day);
    const displayStatus = orderStatusLabel(day);

    return (
      <div
        role="group"
        aria-label={`${weekdayLabel} ${formatDateNO(day.date)}`}
        className={`rounded-[2rem] bg-white/85 p-5 text-center shadow-[0_18px_60px_rgba(24,20,16,0.08)] ring-1 ring-black/5 transition-colors duration-100 active:bg-white ${CARD_TRANSFORM} ${
          isSelected
            ? "motion-safe:scale-[1.01] ring-[#f5c518]/45"
            : `${insightPreferredMotion ? " motion-safe:ring-1 motion-safe:ring-[#f5c518]/35 motion-safe:animate-pulse" : ""}`
        }`}
      >
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectDay();
            }
          }}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            onSelectDay();
          }}
          className="cursor-pointer rounded-[1.5rem] outline-none transition-colors duration-100 active:bg-[#faf7ef] focus-visible:ring-2 focus-visible:ring-[#f5c518]/50"
        >
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center rounded-full bg-[#fff6d6] px-3 py-1 text-xs font-bold text-neutral-950 ring-1 ring-[#f5c518]/45">
              {tierLabel(day)}
            </span>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ${badgeClassForStatus(statusLabel)}`}>
              {displayStatus}
            </span>
            {cutoffClosed ? <CutoffPassedBadge /> : null}
            {readOnlyPreview ? (
              <span className="inline-flex items-center rounded-full bg-neutral-950 px-3 py-1 text-xs font-bold text-white">
                Forhåndsvisning
              </span>
            ) : null}
          </div>

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Valgt dag</p>
            <h2 className="mt-1 text-2xl font-bold capitalize tracking-[-0.03em] text-neutral-950">
              {selectedDayLabel(day)}
            </h2>
            {selected ? <p className="mt-1 text-sm font-medium text-neutral-600">Valgt: {selected}</p> : null}
          </div>

          {insightRecommended ? (
            <div className="mt-2 space-y-0.5 text-center">
              <span className="inline-flex rounded-full bg-[#fff6d6] px-2.5 py-0.5 text-[11px] font-semibold text-neutral-950 ring-1 ring-[#f5c518]/40">
                Anbefalt for deg
              </span>
              <p className="text-[11px] text-neutral-600">Du bestiller ofte denne dagen</p>
              <p className="text-[10px] text-neutral-400">Basert på dine tidligere bestillinger</p>
            </div>
          ) : null}

          <div className="mt-5 text-center">
            {day.menuImages.length ? (
              <div className="mb-2 flex flex-wrap justify-center gap-2">
                {day.menuImages.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={src}
                    src={src}
                    alt=""
                    className="h-20 max-w-full rounded-lg object-cover ring-1 ring-black/10"
                  />
                ))}
              </div>
            ) : null}
            {categories.length ? (
              <div className="space-y-2 text-left">
                {categories.map((category) => (
                  <div
                    key={category}
                    className="flex min-h-[48px] items-center gap-3 rounded-2xl bg-[#faf7ef] px-4 text-sm font-semibold text-neutral-900 ring-1 ring-black/5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm ring-1 ring-black/5">
                      {category.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">{category}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-[#faf7ef] px-4 py-4 text-center ring-1 ring-black/5">
                <p className="text-sm font-semibold text-neutral-900">Menyen er ikke publisert ennå.</p>
                <p className="mt-1 text-sm text-neutral-600">Denne dagen er ikke klar for bestilling.</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col items-stretch gap-2">
          {notInAgreement ? (
            <span className="text-center text-sm text-neutral-500">Ikke leveringsdag i avtalen.</span>
          ) : cutoffClosed ? (
            <>
              <button
                type="button"
                disabled
                className={`min-h-[48px] w-full cursor-not-allowed rounded-full border border-black/10 bg-neutral-50 px-4 text-sm font-semibold text-neutral-500 ${BTN_TOUCH}`}
              >
                Frist passert kl. 08:00
              </button>
              <CutoffSafetyHint day={day} className="text-center" />
            </>
          ) : companyClosed ? (
            <span className="text-center text-sm text-neutral-600">Bestilling stengt for firma</span>
          ) : ordered ? (
            <>
              <button
                type="button"
                disabled={readOnlyPreview || !canClick}
                aria-disabled={readOnlyPreview || !canClick}
                title={readOnlyPreview ? "Kun forhåndsvisning" : undefined}
                onClick={readOnlyPreview ? undefined : onRequestCancel}
                className={`flex min-h-[54px] items-center justify-center rounded-full px-4 text-sm font-bold disabled:pointer-events-none disabled:opacity-50 ${SECONDARY_CTA} ${BTN_TOUCH}`}
              >
                {busyThis ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Behandler…
                  </>
                ) : (
                  "Avbestill lunsj"
                )}
              </button>
              {readOnlyPreview ? <ReadOnlyPreviewHint className="text-center" /> : <CutoffSafetyHint day={day} className="text-center" />}
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={readOnlyPreview || !canClick}
                aria-disabled={readOnlyPreview || !canClick}
                title={readOnlyPreview ? "Kun forhåndsvisning" : undefined}
                onClick={readOnlyPreview ? undefined : onRequestOrder}
                className={`flex min-h-[54px] items-center justify-center rounded-full px-6 text-sm font-bold disabled:pointer-events-none disabled:opacity-50 ${PRIMARY_CTA} ${BTN_TOUCH}`}
              >
                {busyThis ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Behandler…
                  </>
                ) : (
                  "Bestill lunsj"
                )}
              </button>
              {readOnlyPreview ? <ReadOnlyPreviewHint className="text-center" /> : <CutoffSafetyHint day={day} className="text-center" />}
            </>
          )}
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.day.date === next.day.date &&
    prev.day.isLocked === next.day.isLocked &&
    prev.day.isEnabled === next.day.isEnabled &&
    prev.day.lockReason === next.day.lockReason &&
    prev.day.orderStatus === next.day.orderStatus &&
    prev.day.wantsLunch === next.day.wantsLunch &&
    prev.day.menuTitle === next.day.menuTitle &&
    prev.day.menuDescription === next.day.menuDescription &&
    prev.day.menuImages.length === next.day.menuImages.length &&
    prev.day.allergens.length === next.day.allergens.length &&
    prev.isSelected === next.isSelected &&
    prev.globalBusy === next.globalBusy &&
    prev.busyThis === next.busyThis &&
    prev.canAct === next.canAct &&
    prev.weekdayLabel === next.weekdayLabel &&
    prev.statusLabel === next.statusLabel &&
    prev.insightRecommended === next.insightRecommended &&
    prev.insightPreferredMotion === next.insightPreferredMotion &&
    prev.readOnlyPreview === next.readOnlyPreview,
);

function stickyCtaForDay(
  day: DayRow,
  canAct: boolean,
  globalBusy: boolean,
  busyThis: boolean,
  onRequestOrder: () => void,
  onRequestCancel: () => void,
  readOnlyPreview?: boolean,
) {
  const ordered = day.orderStatus === "ACTIVE";
  const cutoffClosed = day.isLocked && day.lockReason === "CUTOFF";
  const companyClosed = day.isLocked && day.lockReason === "COMPANY";
  const notInAgreement = !day.isEnabled;
  const canClick = canOrderDay(day, canAct, globalBusy);

  if (notInAgreement) {
    return (
      <p className="text-center text-sm text-neutral-500">Ikke leveringsdag for valgt dag.</p>
    );
  }
  if (cutoffClosed) {
    return (
      <>
        <button
          type="button"
          disabled
          className={`flex min-h-[48px] w-full items-center justify-center rounded-full border border-black/10 bg-neutral-50 px-4 text-sm font-semibold text-neutral-500 ${BTN_TOUCH}`}
        >
          Frist passert kl. 08:00
        </button>
        <CutoffSafetyHint day={day} className="text-center" />
      </>
    );
  }
  if (companyClosed) {
    return <p className="text-center text-sm text-neutral-600">Bestilling stengt for firma</p>;
  }
  if (ordered) {
    return (
      <>
        <button
          type="button"
          disabled={readOnlyPreview || !canClick}
          aria-disabled={readOnlyPreview || !canClick}
          title={readOnlyPreview ? "Kun forhåndsvisning" : undefined}
          onClick={readOnlyPreview ? undefined : onRequestCancel}
          className={`flex min-h-[54px] w-full items-center justify-center rounded-full px-4 text-sm font-bold disabled:pointer-events-none disabled:opacity-50 ${SECONDARY_CTA} ${BTN_TOUCH}`}
        >
          {busyThis ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Behandler…
            </>
          ) : (
            "Avbestill lunsj"
          )}
        </button>
        {readOnlyPreview ? <ReadOnlyPreviewHint className="text-center" /> : <CutoffSafetyHint day={day} className="text-center" />}
      </>
    );
  }
  return (
    <>
      <button
        type="button"
        disabled={readOnlyPreview || !canClick}
        aria-disabled={readOnlyPreview || !canClick}
        title={readOnlyPreview ? "Kun forhåndsvisning" : undefined}
        onClick={readOnlyPreview ? undefined : onRequestOrder}
        className={`flex min-h-[54px] w-full items-center justify-center rounded-full px-6 text-sm font-bold disabled:pointer-events-none disabled:opacity-50 ${PRIMARY_CTA} ${BTN_TOUCH}`}
      >
        {busyThis ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Behandler…
          </>
        ) : (
          "Bestill lunsj"
        )}
      </button>
      {readOnlyPreview ? <ReadOnlyPreviewHint className="text-center" /> : <CutoffSafetyHint day={day} className="text-center" />}
    </>
  );
}

export default function EmployeeWeekClient({
  canAct,
  billingHoldReason,
  previewMode = "basis",
  readOnlyPreview = false,
}: Props) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const previewDays = useMemo(() => buildPreviewDays(previewMode), [previewMode]);
  const [days, setDays] = useState<DayRow[]>(() => (readOnlyPreview ? previewDays : []));
  const [agreementMessage, setAgreementMessage] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(readOnlyPreview ? "Lunchportalen demo" : null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(!readOnlyPreview);
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<ErrorBannerState | null>(null);
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmPayload | null>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [contentVisible, setContentVisible] = useState(false);
  const [stickyBarHidden, setStickyBarHidden] = useState(false);
  /** Server-side etterspørselssignal (firma-scope) — kun informasjon. */
  const [demandHintLine, setDemandHintLine] = useState<string | null>(null);
  const [serverOsloDate, setServerOsloDate] = useState<string | null>(readOnlyPreview ? previewDays[0]?.date ?? null : null);
  const [weekOrderingAllowed, setWeekOrderingAllowed] = useState(readOnlyPreview);
  const [todayCutoffStatus, setTodayCutoffStatus] = useState<
    "PAST" | "TODAY_OPEN" | "TODAY_LOCKED" | "FUTURE_OPEN" | null
  >(null);
  const [orderingUrgencyHint, setOrderingUrgencyHint] = useState(false);
  const [menuSanityFetchFailed, setMenuSanityFetchFailed] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Set<string>>(new Set());
  const fallbackRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchGateRef = useRef<{ weekStart: string | null; can: boolean }>({ weekStart: null, can: false });
  const prefetchDoneKeyRef = useRef<string | null>(null);
  const prefetchSelectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const navSourceRef = useRef<"init" | "tap" | "io">("init");
  const selectedDateRef = useRef<string | null>(null);
  const ioRef = useRef<IntersectionObserver | null>(null);
  const lastScrollYRef = useRef(0);
  /** Under programmatisk scroll (init/tap): ikke la IO overskrive valgt dag midlertidig. */
  const suppressIoUntilRef = useRef(0);
  const predictedPrefetchKeyRef = useRef<string | null>(null);

  const [patternTick, setPatternTick] = useState(0);
  const patterns = useMemo(() => {
    void patternTick;
    return readOrderPatterns();
  }, [patternTick]);

  const sortedDays = useMemo(() => [...days].sort((a, b) => a.date.localeCompare(b.date)), [days]);

  const preferredWeekday = useMemo(() => getTopWeekdayKey(patterns), [patterns]);
  const recommendedDate = useMemo(
    () => findRecommendedDateInWindow(sortedDays, preferredWeekday),
    [sortedDays, preferredWeekday],
  );
  const todayRowForNudge = useMemo(
    () => (serverOsloDate ? sortedDays.find((d) => d.date === serverOsloDate) : undefined),
    [sortedDays, serverOsloDate],
  );
  const showHabitNudge = useMemo(
    () => shouldShowHabitNudge(todayRowForNudge, patterns, preferredWeekday),
    [todayRowForNudge, patterns, preferredWeekday],
  );

  useEffect(() => {
    if (!readOnlyPreview) return;
    setDays(previewDays);
    setCompanyName("Lunchportalen demo");
    setLoadError(null);
    setForbidden(false);
    setLoading(false);
    setServerOsloDate(previewDays[0]?.date ?? null);
    setWeekOrderingAllowed(true);
    setTodayCutoffStatus(null);
    setOrderingUrgencyHint(false);
    setMenuSanityFetchFailed(false);
    setDemandHintLine(null);
    setErrorBanner(null);
    setToastSuccess(null);
    setConfirm(null);
    setBusyDate(null);
    setConfirmSubmitting(false);
    navSourceRef.current = "init";
    setSelectedDate(previewDays[0]?.date ?? null);
  }, [previewDays, readOnlyPreview]);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    if (readOnlyPreview) return;
    if (loading || forbidden || loadError || days.length === 0) return;
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/order/week-demand-hints", { cache: "no-store" });
        const j = (await res.json().catch(() => null)) as { ok?: boolean; data?: { hint?: string | null } } | null;
        if (!alive || !res.ok || !j || j.ok !== true || !j.data?.hint) return;
        setDemandHintLine(String(j.data.hint));
      } catch {
        /* valgfritt hint — ignorer */
      }
    })();
    return () => {
      alive = false;
    };
  }, [loading, forbidden, loadError, days.length, readOnlyPreview]);

  const guardedAction = useCallback(async (date: string, action: () => Promise<void>) => {
    if (inFlightRef.current.has(date)) return;
    inFlightRef.current.add(date);
    try {
      await action();
    } finally {
      inFlightRef.current.delete(date);
    }
  }, []);

  const loadWindow = useCallback(async (opts?: { silent?: boolean }): Promise<boolean> => {
    if (readOnlyPreview) return true;
    const silent = Boolean(opts?.silent);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    if (!silent) {
      setLoading(true);
      setLoadError(null);
      setForbidden(false);
      setMenuSanityFetchFailed(false);
    }

    try {
      const res = await fetch(`${API_ORDER}/window?weeks=1`, { cache: "no-store", signal: ac.signal });
      const raw = (await res.json().catch(() => null)) as unknown;
      const payload = unwrapWindow(raw);

      if (!res.ok || !payload) {
        if (res.status === 403) {
          if (!silent) {
            setForbidden(true);
            setLoadError(null);
            setDays([]);
            setServerOsloDate(null);
            setWeekOrderingAllowed(false);
            setTodayCutoffStatus(null);
            setOrderingUrgencyHint(false);
            setMenuSanityFetchFailed(false);
          } else {
            setErrorBanner({ code: null, message: "Sesjonen er utløpt eller du har ikke tilgang. Last siden på nytt." });
          }
          return false;
        }
        const msg =
          (raw && typeof raw === "object" && String((raw as any).message || "").trim()) ||
          "Kunne ikke hente ukeplanen.";
        if (!silent) {
          setLoadError(msg);
          setDays([]);
          setServerOsloDate(null);
          setWeekOrderingAllowed(false);
          setTodayCutoffStatus(null);
          setOrderingUrgencyHint(false);
          setMenuSanityFetchFailed(false);
        } else {
          setErrorBanner({ code: null, message: "Noe gikk galt – prøv igjen" });
        }
        return false;
      }

      setForbidden(false);

      const rawDays = Array.isArray(payload.days) ? payload.days : [];
      const mapped = rawDays.map(mapDay).filter(Boolean) as DayRow[];

      const meta = parseWeekMetaFromWindowJson(raw);
      if (!silent) {
        prefetchGateRef.current = {
          weekStart: meta.thisWeekStart ?? mapped[0]?.date ?? null,
          can: meta.canSeeNextWeek,
        };
      }

      setDays(mapped);
      setAgreementMessage(payload.agreement?.message ? String(payload.agreement.message) : null);
      setCompanyName(payload.company?.name ? String(payload.company.name) : null);

      const sod = payload.serverOsloDate != null ? String(payload.serverOsloDate).slice(0, 10) : "";
      setServerOsloDate(sod || null);
      setWeekOrderingAllowed(payload.weekOrderingAllowed === true);
      const tcs = payload.todayCutoffStatus;
      setTodayCutoffStatus(
        tcs === "PAST" || tcs === "TODAY_OPEN" || tcs === "TODAY_LOCKED" || tcs === "FUTURE_OPEN" ? tcs : null,
      );
      setOrderingUrgencyHint(payload.orderingUrgencyHint === true);
      setMenuSanityFetchFailed(payload.menuSanityFetchFailed === true);

      return true;
    } catch (e: any) {
      if (e?.name === "AbortError") return false;
      if (!silent) {
        setLoadError("Kunne ikke hente ukeplanen.");
        setDays([]);
        setServerOsloDate(null);
        setWeekOrderingAllowed(false);
        setTodayCutoffStatus(null);
        setOrderingUrgencyHint(false);
        setMenuSanityFetchFailed(false);
      } else {
        setErrorBanner({ code: null, message: "Noe gikk galt – prøv igjen" });
      }
      return false;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [readOnlyPreview]);

  useEffect(() => {
    if (readOnlyPreview) return;
    void loadWindow();
    return () => abortRef.current?.abort();
  }, [loadWindow, readOnlyPreview]);

  useEffect(() => {
    return () => {
      const st = successTimerRef.current;
      successTimerRef.current = null;
      if (st) clearTimeout(st);
      const et = errorTimerRef.current;
      errorTimerRef.current = null;
      if (et) clearTimeout(et);
      const fb = fallbackRefreshRef.current;
      fallbackRefreshRef.current = null;
      if (fb) clearTimeout(fb);
      const ps = prefetchSelectTimerRef.current;
      prefetchSelectTimerRef.current = null;
      if (ps) clearTimeout(ps);
    };
  }, []);

  /** Valgt mobil-dag som ble CUTOFF-låst (f.eks. etter 08:00) skal ikke henge igjen som aktiv. */
  useEffect(() => {
    if (!selectedDate) return;
    const d = days.find((x) => x.date === selectedDate);
    if (d && d.lockReason === "CUTOFF") {
      setSelectedDate(null);
    }
  }, [selectedDate, days]);

  useEffect(() => {
    if (days.length === 0) return;
    const ids = new Set(days.map((d) => d.date));
    if (!selectedDate || !ids.has(selectedDate)) {
      navSourceRef.current = "init";
      const next = pickDefaultDateFromPatterns(days, patterns);
      if (next) setSelectedDate(next);
    }
  }, [days, selectedDate, patterns]);

  /** Stille prefetch når anbefalt dag er kjent (samme kontrakt som øvrig /window). */
  useEffect(() => {
    if (readOnlyPreview) return;
    if (loading || sortedDays.length === 0 || !recommendedDate) return;
    const key = sortedDays.map((d) => d.date).join("|");
    if (predictedPrefetchKeyRef.current === key) return;
    predictedPrefetchKeyRef.current = key;
    void fetch(`${API_ORDER}/window?weeks=1`, { cache: "no-store" }).catch(() => {});
    if (prefetchGateRef.current.can) {
      void fetch(`${API_ORDER}/window?weeks=2`, { cache: "no-store" }).catch(() => {});
    }
  }, [loading, sortedDays, recommendedDate, readOnlyPreview]);

  /** Synk scroll-posisjon med valgt dag (init / tap — ikke under IO-styrt swipe). */
  useLayoutEffect(() => {
    if (!isMobile || loading || sortedDays.length === 0) return;
    const src = navSourceRef.current;
    if (src === "io") return;
    const root = carouselRef.current;
    if (!root || !selectedDate) return;
    const idx = sortedDays.findIndex((d) => d.date === selectedDate);
    if (idx < 0) return;
    const w = root.clientWidth;
    const target = idx * w;
    if (Math.abs(root.scrollLeft - target) < 2) {
      navSourceRef.current = "io";
      return;
    }
    if (src === "tap") suppressIoUntilRef.current = Date.now() + 420;
    else if (src === "init") suppressIoUntilRef.current = Date.now() + 200;
    root.scrollTo({ left: target, behavior: src === "tap" ? "smooth" : "auto" });
    navSourceRef.current = "io";
  }, [isMobile, loading, sortedDays, selectedDate]);

  /** Synk valgt dag fra horisontal snap (kun visuell → state). */
  useEffect(() => {
    if (!isMobile || loading || sortedDays.length === 0) return;
    const root = carouselRef.current;
    if (!root) return;

    ioRef.current?.disconnect();
    let raf = 0;

    const obs = new IntersectionObserver(
      (entries) => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          if (Date.now() < suppressIoUntilRef.current) return;
          const viable = entries.filter((e) => e.isIntersecting && e.intersectionRatio >= 0.58);
          if (viable.length === 0) return;
          viable.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          const el = viable[0]!.target as HTMLElement;
          const date = el.dataset.date;
          if (!date || date === selectedDateRef.current) return;
          navSourceRef.current = "io";
          safeVibrate(6);
          setSelectedDate(date);
        });
      },
      { root, rootMargin: "0px", threshold: [0.45, 0.55, 0.65, 0.75, 0.85, 0.95] },
    );

    ioRef.current = obs;
    root.querySelectorAll<HTMLElement>("[data-day-slide]").forEach((el) => obs.observe(el));

    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
      ioRef.current = null;
    };
  }, [isMobile, loading, sortedDays]);

  /** Prediktiv prefetch ved dagbytte (stille, ingen setState). */
  useEffect(() => {
    if (readOnlyPreview) return;
    if (!selectedDate || loading || days.length === 0) return;
    if (prefetchSelectTimerRef.current) clearTimeout(prefetchSelectTimerRef.current);
    prefetchSelectTimerRef.current = setTimeout(() => {
      prefetchSelectTimerRef.current = null;
      void fetch(`${API_ORDER}/window?weeks=1`, { cache: "no-store" }).catch(() => {});
      if (prefetchGateRef.current.can) {
        const ws = prefetchGateRef.current.weekStart;
        if (ws) void getNextWeekStartISO(ws);
        void fetch(`${API_ORDER}/window?weeks=2`, { cache: "no-store" }).catch(() => {});
      }
    }, 140);
    return () => {
      if (prefetchSelectTimerRef.current) clearTimeout(prefetchSelectTimerRef.current);
    };
  }, [selectedDate, days.length, loading, readOnlyPreview]);

  /** Sticky bar: skjul ved scroll ned, vis ved scroll opp (kun mobil). */
  useEffect(() => {
    if (!isMobile) {
      setStickyBarHidden(false);
      return;
    }
    lastScrollYRef.current = typeof window !== "undefined" ? window.scrollY : 0;
    const onScroll = () => {
      const y = window.scrollY;
      const d = y - lastScrollYRef.current;
      lastScrollYRef.current = y;
      if (d > 12) setStickyBarHidden(true);
      else if (d < -12) setStickyBarHidden(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMobile]);

  /** Innhold fade-in etter lasting (kun opacity). */
  useEffect(() => {
    if (loading) {
      setContentVisible(false);
      return;
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setContentVisible(true));
    });
    return () => cancelAnimationFrame(id);
  }, [loading]);

  /**
   * Prefetch neste uke: GET weeks=2 (kun når API sier canSeeNextWeek). Ingen setState — kun HTTP-varmstart.
   * getNextWeekStartISO brukes som deterministisk fasit for neste ukes start (samme som server nextWeekStart).
   */
  useEffect(() => {
    if (readOnlyPreview) return;
    if (loading) return;
    const g = prefetchGateRef.current;
    if (!g.can || !g.weekStart) return;
    if (prefetchDoneKeyRef.current === g.weekStart) return;
    prefetchDoneKeyRef.current = g.weekStart;
    void getNextWeekStartISO(g.weekStart);
    void fetch(`${API_ORDER}/window?weeks=2`, { cache: "no-store" }).catch(() => {});
  }, [days, loading, readOnlyPreview]);

  const selectDayFromTap = useCallback((date: string) => {
    navSourceRef.current = "tap";
    safeVibrate(10);
    setSelectedDate(date);
  }, []);

  const showSuccessToast = useCallback((msg: string) => {
    setToastSuccess(msg);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => {
      setToastSuccess(null);
      successTimerRef.current = null;
    }, 2000);
  }, []);

  const showErrorBanner = useCallback((message: string, code: string | null = null) => {
    const cutoff = isCutoffApiError(code, message);
    setErrorBanner({
      code: cutoff ? "CUTOFF_PASSED" : code,
      message: cutoff ? "Fristen har gått ut" : "Noe gikk galt – prøv igjen",
    });
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      setErrorBanner(null);
      errorTimerRef.current = null;
    }, 5000);
  }, []);

  const postSetDayInner = useCallback(
    async (date: string, wantsLunch: boolean): Promise<boolean> => {
      if (readOnlyPreview) return false;
      const rid = clientRid();
      setErrorBanner(null);
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }

      try {
        const res = await fetch(`${API_ORDER}/set-day`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-rid": rid },
          cache: "no-store",
          body: JSON.stringify({ date, wants_lunch: wantsLunch }),
        });

        const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        const orderId = json && typeof json.orderId === "string" ? json.orderId.trim() : "";
        const st = json && (json.status === "active" || json.status === "cancelled") ? json.status : null;
        const ok =
          res.ok &&
          json &&
          json.ok === true &&
          orderId.length > 0 &&
          st !== null;
        if (!ok) {
          const apiError = readApiError(json);
          showErrorBanner(apiError.message, apiError.code);
          return false;
        }
        const refreshed = await loadWindow({ silent: true });
        if (!refreshed) {
          showErrorBanner("");
          return false;
        }
        if (fallbackRefreshRef.current) clearTimeout(fallbackRefreshRef.current);
        fallbackRefreshRef.current = setTimeout(() => {
          fallbackRefreshRef.current = null;
          void loadWindow({ silent: true });
        }, 1500);
        if (wantsLunch) {
          const wk = weekdayKeyFromDateISO(date);
          recordSuccessfulOrder(date, wk);
          setPatternTick((t) => t + 1);
        }
        safeVibrate(12);
        showSuccessToast(wantsLunch ? "Bestilling registrert ✔" : "Avbestilling registrert ✔");
        return true;
      } catch {
        showErrorBanner("");
        return false;
      }
    },
    [loadWindow, readOnlyPreview, showErrorBanner, showSuccessToast],
  );

  const handleConfirmSubmit = useCallback(async () => {
    if (readOnlyPreview) return;
    if (!confirm) return;
    safeVibrate(10);
    const { date, action } = confirm;
    await guardedAction(date, async () => {
      setConfirmSubmitting(true);
      setBusyDate(date);
      try {
        const ok = await postSetDayInner(date, action === "order");
        if (ok) setConfirm(null);
      } finally {
        setBusyDate(null);
        setConfirmSubmitting(false);
      }
    });
  }, [confirm, guardedAction, postSetDayInner, readOnlyPreview]);

  const requestOrder = useCallback((date: string) => {
    if (readOnlyPreview) return;
    setErrorBanner(null);
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    setConfirm({ date, action: "order" });
  }, [readOnlyPreview]);

  const requestCancel = useCallback((date: string) => {
    if (readOnlyPreview) return;
    setErrorBanner(null);
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    setConfirm({ date, action: "cancel" });
  }, [readOnlyPreview]);

  const blocked = !readOnlyPreview && (!canAct || !weekOrderingAllowed);
  const globalBusy = busyDate !== null;

  const selectedDay = selectedDate ? days.find((d) => d.date === selectedDate) : undefined;

  if (loading) {
    return (
      <div className={`mx-auto w-full max-w-lg px-4 py-6 md:max-w-2xl ${isMobile ? "pb-32" : ""}`}>
        <WeekLoadingSkeleton mobileLayout={isMobile} />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-10 text-center">
        <div className="rounded-2xl bg-neutral-100 px-4 py-4 text-sm text-neutral-800 ring-1 ring-black/10">
          <p className="font-semibold">Ingen tilgang til ukeplan</p>
          <p className="mt-2 text-neutral-600">
            Du er logget inn med en rolle eller et scope som ikke kan hente denne visningen, eller sesjonen er utløpt.
          </p>
          <p className="mt-4">
            <Link
              href="/login?next=/week"
              className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-4"
            >
              Logg inn på nytt
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-10">
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-900 ring-1 ring-rose-200">{loadError}</div>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-10 text-center">
        <div className="rounded-2xl bg-neutral-100 px-4 py-4 text-sm text-neutral-800 ring-1 ring-black/10">
          <p className="font-semibold">Bestilling er ikke tilgjengelig</p>
          <p className="mt-2 text-neutral-600">
            {!canAct
              ? billingHoldReason || "Firmaet tillater ikke bestilling akkurat nå."
              : agreementMessage || "Avtalen er ikke aktiv. Kontakt firmadministrator."}
          </p>
        </div>
      </div>
    );
  }

  if (sortedDays.length === 0) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-10 text-center">
        <div className="rounded-2xl bg-neutral-100 px-4 py-4 text-sm text-neutral-800 ring-1 ring-black/10">
          <p className="font-semibold">Ingen synlige dager akkurat nå</p>
          <p className="mt-2 text-neutral-600">
            Uken kunne ikke vises som forventet. Dette er ikke det samme som «ingen meny publisert» — prøv å hente på nytt.
          </p>
          <button
            type="button"
            onClick={() => void loadWindow()}
            className={`mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full border border-neutral-300 bg-white px-5 text-sm font-semibold text-neutral-900 ${BTN_TOUCH}`}
          >
            Prøv igjen
          </button>
        </div>
      </div>
    );
  }

  const confirmTitle =
    confirm?.action === "order" ? "Bekrefter du bestilling?" : "Bekrefter du avbestilling?";

  const quickConfirmMotion =
    Boolean(confirm?.action === "order" && confirm?.date && getWeekdayOrderCount(patterns, confirm.date) >= 3);

  const todayDay = (serverOsloDate ? sortedDays.find((d) => d.date === serverOsloDate) : undefined) ?? sortedDays[0];
  const activeDay = selectedDay ?? todayDay;
  const upcomingDays = activeDay ? sortedDays.filter((d) => d.date !== activeDay.date) : sortedDays;

  return (
    <div
      className={`mx-auto w-full px-4 py-6 motion-safe:transition-opacity motion-safe:duration-300 ${
        readOnlyPreview
          ? "max-w-[430px] rounded-[2rem] bg-[#fbf8f1] shadow-[0_18px_60px_rgba(24,20,16,0.08)] ring-1 ring-black/5"
          : `min-h-dvh max-w-lg bg-[#fbf8f1] md:max-w-2xl ${isMobile ? "pb-32" : ""}`
      } ${contentVisible ? "opacity-100" : "opacity-0"}`}
    >
      <WeekConfirmModal
        open={!readOnlyPreview && Boolean(confirm)}
        title={confirm ? confirmTitle : ""}
        onCancel={() => {
          if (confirmSubmitting) return;
          setConfirm(null);
        }}
        onConfirm={() => void handleConfirmSubmit()}
        confirming={confirmSubmitting}
        quickMotion={quickConfirmMotion}
      />

      {toastSuccess ? (
        <div
          className="motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:ease-out fixed bottom-24 left-4 right-4 z-50 mx-auto max-w-md -translate-y-1 rounded-2xl bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-950 opacity-100 ring-1 ring-emerald-200 md:bottom-auto md:left-1/2 md:right-auto md:top-24 md:w-full md:-translate-x-1/2 md:-translate-y-1"
          role="status"
        >
          {toastSuccess}
        </div>
      ) : null}

      <header className="mb-6 text-center">
        <Link href="/" className="inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5c518]/60">
          <Image
            src="/brand/LP-logo-uten-bakgrunn.png"
            alt="Lunchportalen"
            width={180}
            height={64}
            priority
            className="h-12 w-auto object-contain"
          />
        </Link>
        {companyName ? <p className="mt-2 text-sm font-medium text-neutral-600">{companyName}</p> : null}
        <h1 className="mt-5 text-4xl font-bold tracking-[-0.05em] text-neutral-950">
          Bestill eller avbestill lunsj
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-base leading-7 text-neutral-600">
          Frist for å endre bestilling er 08:00.
        </p>
      </header>

      <div className="mb-5 space-y-2" aria-live="polite">
        {menuSanityFetchFailed ? (
          <div
            className="rounded-2xl bg-amber-50 px-3 py-2 text-center text-sm text-amber-950 ring-1 ring-amber-200"
            role="status"
          >
            Menytekst kunne ikke lastes akkurat nå. Ordrestatus og bestilling/avbestilling vises som vanlig.
          </div>
        ) : null}
        {!readOnlyPreview && patterns.streakCount >= 2 ? (
          <p className="text-center text-xs font-medium text-neutral-700">{patterns.streakCount} uker på rad</p>
        ) : null}
        {!readOnlyPreview && showHabitNudge ? (
          <p className="text-center text-xs text-neutral-500">Du pleier å bestille denne dagen</p>
        ) : null}
        {!readOnlyPreview && demandHintLine ? <p className="text-center text-xs text-neutral-500">{demandHintLine}</p> : null}
        {!readOnlyPreview && todayCutoffStatus === "TODAY_OPEN" && orderingUrgencyHint ? (
          <p className="text-center text-xs font-medium text-amber-900/90">Bestill før kl. 08:00</p>
        ) : !readOnlyPreview && todayCutoffStatus === "TODAY_LOCKED" ? (
          <p className="text-center text-xs font-medium text-neutral-600">Fristen for dagens endring er passert.</p>
        ) : null}
        {errorBanner ? (
          <div className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-900 ring-1 ring-rose-200">
            {errorBanner.code === "CUTOFF_PASSED" ? <ClockIcon className="h-4 w-4 shrink-0" aria-hidden /> : null}
            <span>{errorBanner.message}</span>
          </div>
        ) : null}
      </div>

      <nav className="mb-5 grid grid-cols-5 gap-2" aria-label="Velg dag">
        {sortedDays.slice(0, 5).map((day) => {
          const active = activeDay?.date === day.date;
          const weekday = (formatWeekdayNO(day.date) || day.weekday).slice(0, 3);
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => selectDayFromTap(day.date)}
              className={`min-w-0 rounded-2xl px-2 py-3 text-center ring-1 transition-transform active:scale-[0.98] ${
                active
                  ? "bg-[#fff6d6] text-neutral-950 ring-[#f5c518] shadow-[0_10px_30px_rgba(245,197,24,0.2)]"
                  : "bg-white/80 text-neutral-700 ring-black/5"
              }`}
              aria-pressed={active}
            >
              <span className="block truncate text-xs font-bold capitalize">{weekday}</span>
              <span className="mt-1 block text-[11px] font-medium text-neutral-500">{formatDateNO(day.date).split(".")[0]}</span>
            </button>
          );
        })}
      </nav>

      {activeDay ? (
        <section className="mb-7">
          <WeekDayCardMobile
            day={activeDay}
            canAct={canAct}
            globalBusy={globalBusy}
            busyThis={busyDate === activeDay.date}
            weekdayLabel={formatWeekdayNO(activeDay.date) || activeDay.weekday}
            statusLabel={statusLabelForDay(activeDay)}
            isSelected
            onSelectDay={() => selectDayFromTap(activeDay.date)}
            onRequestOrder={() => requestOrder(activeDay.date)}
            onRequestCancel={() => requestCancel(activeDay.date)}
            insightRecommended={Boolean(!readOnlyPreview && recommendedDate && activeDay.date === recommendedDate && preferredWeekday)}
            insightPreferredMotion={false}
            readOnlyPreview={readOnlyPreview}
          />
        </section>
      ) : null}

      <section className="pb-2">
        <h2 className="mb-3 text-center text-lg font-bold tracking-[-0.02em] text-neutral-950">Kommende menyer</h2>
        <div className={`space-y-2 ${globalBusy ? "pointer-events-none opacity-[0.92]" : ""}`} aria-label="Kommende dager">
          {upcomingDays.map((day) => {
            const weekdayLabel = formatWeekdayNO(day.date) || day.weekday;
            const status = orderStatusLabel(day);
            return (
              <button
                key={day.date}
                type="button"
                data-date={day.date}
                data-day-slide=""
                onClick={() => selectDayFromTap(day.date)}
                className="flex min-h-[58px] w-full items-center justify-between gap-3 rounded-2xl bg-white/75 px-4 text-left text-sm ring-1 ring-black/5 transition-transform active:scale-[0.99]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold capitalize text-neutral-950">
                    {weekdayLabel} {formatDateNO(day.date)}
                  </span>
                  <span className="mt-0.5 block truncate text-xs font-medium text-neutral-600">{tierLabel(day)}</span>
                </span>
                <span className="shrink-0 rounded-full bg-[#faf7ef] px-3 py-1 text-xs font-bold text-neutral-700 ring-1 ring-black/5">
                  {status}
                </span>
              </button>
            );
          })}
          {upcomingDays.length === 0 ? (
            <div className="rounded-2xl bg-white/80 px-4 py-4 text-center text-sm text-neutral-600 ring-1 ring-black/10">
              Ingen flere menyer tilgjengelig denne uken.
            </div>
          ) : null}
        </div>
      </section>

      {!readOnlyPreview && selectedDay ? (
        <div
          className={`fixed bottom-0 left-0 right-0 z-40 border-t border-black/10 bg-white/95 px-4 pt-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm motion-safe:transition-[transform,opacity] motion-safe:duration-200 motion-safe:ease-out ${
            stickyBarHidden ? "pointer-events-none translate-y-full opacity-0" : "translate-y-0 opacity-100"
          }`}
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto max-w-lg">
            <p className="mb-2 text-center text-xs font-medium text-neutral-600">{selectedDayLabel(selectedDay)}</p>
            {stickyCtaForDay(
              selectedDay,
              canAct,
              globalBusy,
              busyDate === selectedDay.date,
              () => requestOrder(selectedDay.date),
              () => requestCancel(selectedDay.date),
              readOnlyPreview,
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
