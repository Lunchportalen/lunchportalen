"use client";

import { Loader2 } from "lucide-react";
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

function clientRid() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function asOrderStatus(v: unknown): "ACTIVE" | "CANCELLED" | null {
  const s = String(v ?? "").toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "CANCELLED" || s === "CANCELED") return "CANCELLED";
  return null;
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

/** Deterministisk status — samme rekkefølge som API-låser (CUTOFF / firma / avtale). */
function statusLabelForDay(day: DayRow): "Ikke bestilt" | "Bestilt" | "Avbestilt" | "Stengt" {
  const notInAgreement = !day.isEnabled;
  const companyClosed = day.isLocked && day.lockReason === "COMPANY";
  const cutoffClosed = day.isLocked && day.lockReason === "CUTOFF";
  if (notInAgreement || companyClosed || cutoffClosed) return "Stengt";
  if (day.orderStatus === "ACTIVE") return "Bestilt";
  if (day.orderStatus === "CANCELLED") return "Avbestilt";
  return "Ikke bestilt";
}

function badgeClassForStatus(s: ReturnType<typeof statusLabelForDay>) {
  if (s === "Bestilt") return "bg-emerald-50 text-emerald-900 ring-emerald-200";
  if (s === "Avbestilt") return "bg-amber-50 text-amber-950 ring-amber-200";
  if (s === "Stengt") return "bg-neutral-100 text-neutral-700 ring-black/10";
  return "bg-white text-neutral-700 ring-black/15";
}

/** Under primær-CTA: tydeliggjør frist (samme semantikk som CUTOFF-lås fra API). */
function CutoffSafetyHint({ day, className = "" }: { day: DayRow; className?: string }) {
  const cutoffClosed = day.isLocked && day.lockReason === "CUTOFF";
  const isBeforeCutoff = !cutoffClosed;
  return (
    <p className={`mt-1 text-xs text-gray-500 ${className}`}>
      {isBeforeCutoff ? "Kan endres frem til kl. 08:00" : "Frist er passert"}
    </p>
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
}: RowBase) {
  const ordered = day.orderStatus === "ACTIVE";
  const cutoffClosed = day.isLocked && day.lockReason === "CUTOFF";
  const companyClosed = day.isLocked && day.lockReason === "COMPANY";
  const notInAgreement = !day.isEnabled;
  const canClick = canAct && day.isEnabled && !day.isLocked && !globalBusy;

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
          <div className="mt-2">
            <span
              className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${badgeClassForStatus(statusLabel)}`}
            >
              {statusLabel}
            </span>
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

      <div className="mt-3 border-t border-black/5 pt-3 text-left">
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
        <p className="text-sm font-semibold text-neutral-900">{day.menuTitle ?? ""}</p>
        {day.menuDescription ? (
          <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{day.menuDescription}</p>
        ) : null}
        {day.allergens.length > 0 ? (
          <p className="mt-2 text-xs text-neutral-600">
            <span className="font-semibold">Allergener: </span>
            {day.allergens.join(", ")}
          </p>
        ) : null}
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
              disabled={!canClick}
              onClick={onRequestCancel}
              className={`flex min-h-[48px] items-center justify-center rounded-full border border-black/15 bg-white px-4 text-sm font-semibold text-neutral-900 disabled:pointer-events-none disabled:opacity-50 ${BTN_TOUCH}`}
            >
              {busyThis ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Behandler…
                </>
              ) : (
                "Avbestill"
              )}
            </button>
            <CutoffSafetyHint day={day} className="text-center md:text-left" />
          </div>
        ) : (
          <div className="flex w-full flex-col sm:w-full md:w-auto">
            <button
              type="button"
              disabled={!canClick}
              onClick={onRequestOrder}
              className={`flex min-h-[48px] items-center justify-center rounded-full bg-neutral-900 px-6 text-sm font-semibold text-white disabled:pointer-events-none disabled:opacity-50 ${BTN_TOUCH}`}
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
            <CutoffSafetyHint day={day} className="text-center md:text-left" />
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
  }: MobileCardProps) {
    const ordered = day.orderStatus === "ACTIVE";
    const cutoffClosed = day.isLocked && day.lockReason === "CUTOFF";
    const companyClosed = day.isLocked && day.lockReason === "COMPANY";
    const notInAgreement = !day.isEnabled;
    const canClick = canAct && day.isEnabled && !day.isLocked && !globalBusy;

    return (
      <div
        role="group"
        aria-label={`${weekdayLabel} ${formatDateNO(day.date)}`}
        className={`rounded-2xl border bg-white/95 p-4 text-center shadow-sm transition-colors duration-100 active:bg-gray-100/80 ${CARD_TRANSFORM} ${
          isSelected
            ? "motion-safe:scale-[1.02] border-pink-500/40 ring-2 ring-pink-500/30"
            : `border-black/10${insightPreferredMotion ? " motion-safe:ring-1 motion-safe:ring-neutral-300/60 motion-safe:animate-pulse" : ""}`
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
          className="cursor-pointer rounded-xl outline-none transition-colors duration-100 active:bg-gray-100/70 focus-visible:ring-2 focus-visible:ring-pink-500/40"
        >
          <div className="text-base font-semibold capitalize text-neutral-900">
            {weekdayLabel} · {formatDateNO(day.date)}
          </div>
          <div className="mt-2 flex justify-center">
            <span
              className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${badgeClassForStatus(statusLabel)}`}
            >
              {statusLabel}
            </span>
          </div>
          {insightRecommended ? (
            <div className="mt-2 space-y-0.5 text-center">
              <span className="inline-flex rounded-full bg-pink-50 px-2.5 py-0.5 text-[11px] font-semibold text-pink-950 ring-1 ring-pink-200">
                Anbefalt for deg
              </span>
              <p className="text-[11px] text-neutral-600">Du bestiller ofte denne dagen</p>
              <p className="text-[10px] text-neutral-400">Basert på dine tidligere bestillinger</p>
            </div>
          ) : null}

          <div className="mt-3 border-t border-black/5 pt-3 text-center">
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
            <p className="text-sm font-semibold text-neutral-900">{day.menuTitle ?? ""}</p>
            {day.menuDescription ? (
              <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{day.menuDescription}</p>
            ) : null}
            {day.allergens.length > 0 ? (
              <p className="mt-2 text-xs text-neutral-600">
                <span className="font-semibold">Allergener: </span>
                {day.allergens.join(", ")}
              </p>
            ) : null}
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
                disabled={!canClick}
                onClick={onRequestCancel}
                className={`flex min-h-[48px] items-center justify-center rounded-full border border-black/15 bg-white px-4 text-sm font-semibold text-neutral-900 disabled:pointer-events-none disabled:opacity-50 ${BTN_TOUCH}`}
              >
                {busyThis ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Behandler…
                  </>
                ) : (
                  "Avbestill"
                )}
              </button>
              <CutoffSafetyHint day={day} className="text-center" />
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={!canClick}
                onClick={onRequestOrder}
                className={`flex min-h-[48px] items-center justify-center rounded-full bg-neutral-900 px-6 text-sm font-semibold text-white disabled:pointer-events-none disabled:opacity-50 ${BTN_TOUCH}`}
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
              <CutoffSafetyHint day={day} className="text-center" />
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
    prev.insightPreferredMotion === next.insightPreferredMotion,
);

function stickyCtaForDay(
  day: DayRow,
  canAct: boolean,
  globalBusy: boolean,
  busyThis: boolean,
  onRequestOrder: () => void,
  onRequestCancel: () => void,
) {
  const ordered = day.orderStatus === "ACTIVE";
  const cutoffClosed = day.isLocked && day.lockReason === "CUTOFF";
  const companyClosed = day.isLocked && day.lockReason === "COMPANY";
  const notInAgreement = !day.isEnabled;
  const canClick = canAct && day.isEnabled && !day.isLocked && !globalBusy;

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
          disabled={!canClick}
          onClick={onRequestCancel}
          className={`flex min-h-[48px] w-full items-center justify-center rounded-full border border-black/15 bg-white px-4 text-sm font-semibold text-neutral-900 disabled:pointer-events-none disabled:opacity-50 ${BTN_TOUCH}`}
        >
          {busyThis ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Behandler…
            </>
          ) : (
            "Avbestill"
          )}
        </button>
        <CutoffSafetyHint day={day} className="text-center" />
      </>
    );
  }
  return (
    <>
      <button
        type="button"
        disabled={!canClick}
        onClick={onRequestOrder}
        className={`flex min-h-[48px] w-full items-center justify-center rounded-full bg-neutral-900 px-6 text-sm font-semibold text-white disabled:pointer-events-none disabled:opacity-50 ${BTN_TOUCH}`}
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
      <CutoffSafetyHint day={day} className="text-center" />
    </>
  );
}

export default function EmployeeWeekClient({ canAct, billingHoldReason }: Props) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [days, setDays] = useState<DayRow[]>([]);
  const [agreementMessage, setAgreementMessage] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmPayload | null>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [contentVisible, setContentVisible] = useState(false);
  const [stickyBarHidden, setStickyBarHidden] = useState(false);
  /** Server-side etterspørselssignal (firma-scope) — kun informasjon. */
  const [demandHintLine, setDemandHintLine] = useState<string | null>(null);
  const [serverOsloDate, setServerOsloDate] = useState<string | null>(null);
  const [weekOrderingAllowed, setWeekOrderingAllowed] = useState(false);
  const [todayCutoffStatus, setTodayCutoffStatus] = useState<
    "PAST" | "TODAY_OPEN" | "TODAY_LOCKED" | "FUTURE_OPEN" | null
  >(null);
  const [orderingUrgencyHint, setOrderingUrgencyHint] = useState(false);
  const [menuSanityFetchFailed, setMenuSanityFetchFailed] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
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
  }, [loading, forbidden, loadError, days.length]);

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
            setErrorBanner("Sesjonen er utløpt eller du har ikke tilgang. Last siden på nytt.");
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
          setErrorBanner("Noe gikk galt. Prøv igjen.");
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
        setErrorBanner("Noe gikk galt. Prøv igjen.");
      }
      return false;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWindow();
    return () => abortRef.current?.abort();
  }, [loadWindow]);

  useEffect(() => {
    return () => {
      const st = successTimerRef.current;
      successTimerRef.current = null;
      if (st) clearTimeout(st);
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
    if (loading || sortedDays.length === 0 || !recommendedDate) return;
    const key = sortedDays.map((d) => d.date).join("|");
    if (predictedPrefetchKeyRef.current === key) return;
    predictedPrefetchKeyRef.current = key;
    void fetch(`${API_ORDER}/window?weeks=1`, { cache: "no-store" }).catch(() => {});
    if (prefetchGateRef.current.can) {
      void fetch(`${API_ORDER}/window?weeks=2`, { cache: "no-store" }).catch(() => {});
    }
  }, [loading, sortedDays, recommendedDate]);

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
  }, [selectedDate, days.length, loading]);

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
    if (loading) return;
    const g = prefetchGateRef.current;
    if (!g.can || !g.weekStart) return;
    if (prefetchDoneKeyRef.current === g.weekStart) return;
    prefetchDoneKeyRef.current = g.weekStart;
    void getNextWeekStartISO(g.weekStart);
    void fetch(`${API_ORDER}/window?weeks=2`, { cache: "no-store" }).catch(() => {});
  }, [days, loading]);

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

  const postSetDayInner = useCallback(
    async (date: string, wantsLunch: boolean): Promise<boolean> => {
      const rid = clientRid();
      setErrorBanner(null);

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
          const serverMsg =
            json && typeof json === "object" && typeof (json as { message?: unknown }).message === "string"
              ? String((json as { message: string }).message).trim()
              : "";
          setErrorBanner(serverMsg || "Noe gikk galt. Prøv igjen.");
          return false;
        }
        const refreshed = await loadWindow({ silent: true });
        if (!refreshed) {
          setErrorBanner("Noe gikk galt. Prøv igjen.");
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
        setErrorBanner("Noe gikk galt. Prøv igjen.");
        return false;
      }
    },
    [loadWindow, showSuccessToast],
  );

  const handleConfirmSubmit = useCallback(async () => {
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
  }, [confirm, guardedAction, postSetDayInner]);

  const requestOrder = useCallback((date: string) => {
    setErrorBanner(null);
    setConfirm({ date, action: "order" });
  }, []);

  const requestCancel = useCallback((date: string) => {
    setErrorBanner(null);
    setConfirm({ date, action: "cancel" });
  }, []);

  const blocked = !canAct || !weekOrderingAllowed;
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

  return (
    <div
      className={`mx-auto w-full max-w-lg px-4 py-6 motion-safe:transition-opacity motion-safe:duration-300 md:max-w-2xl ${isMobile ? "pb-32" : ""} ${contentVisible ? "opacity-100" : "opacity-0"}`}
    >
      <WeekConfirmModal
        open={Boolean(confirm)}
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

      {companyName ? <p className="mb-3 text-center text-sm text-neutral-600">{companyName}</p> : null}

      {menuSanityFetchFailed ? (
        <div
          className="mb-3 rounded-2xl bg-amber-50 px-3 py-2 text-center text-sm text-amber-950 ring-1 ring-amber-200"
          role="status"
        >
          Menytekst kunne ikke lastes akkurat nå. Ordrestatus og bestilling/avbestilling vises som vanlig.
        </div>
      ) : null}

      {patterns.streakCount >= 2 ? (
        <p className="mb-2 text-center text-xs font-medium text-neutral-700" aria-live="polite">
          🔥 {patterns.streakCount} uker på rad
        </p>
      ) : null}

      {showHabitNudge ? (
        <p className="mb-2 text-center text-xs text-neutral-500">Du pleier å bestille denne dagen</p>
      ) : null}

      {demandHintLine ? (
        <p className="mb-2 text-center text-xs text-neutral-500">{demandHintLine}</p>
      ) : null}

      {todayCutoffStatus === "TODAY_OPEN" ? (
        <div className="mb-3 text-center">
          <p className="text-xs text-neutral-500">Frist i dag kl. 08:00</p>
          {orderingUrgencyHint ? (
            <p className="mt-1 text-xs font-medium text-amber-900/90">Bestill før kl. 08:00</p>
          ) : null}
        </div>
      ) : todayCutoffStatus === "TODAY_LOCKED" ? (
        <div className="mb-3 text-center">
          <p className="text-xs font-medium text-neutral-600">Stengt for bestilling</p>
          <p className="mt-1 text-xs text-neutral-500">Neste mulighet i morgen</p>
        </div>
      ) : null}

      {errorBanner ? (
        <div className="mb-4 rounded-2xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-900 ring-1 ring-rose-200">
          {errorBanner}
        </div>
      ) : null}

      {!isMobile ? (
        <ul className="flex flex-col gap-4">
          {sortedDays.map((day) => {
            const weekdayLabel = formatWeekdayNO(day.date) || day.weekday;
            const statusLabel = statusLabelForDay(day);
            const insightRec = Boolean(recommendedDate && day.date === recommendedDate && preferredWeekday);
            const insightPulse =
              Boolean(
                preferredWeekday &&
                  String(day.weekday).toLowerCase() === preferredWeekday &&
                  day.isEnabled &&
                  !insightRec,
              );
            return (
              <WeekDayRowDesktop
                key={day.date}
                day={day}
                canAct={canAct}
                globalBusy={globalBusy}
                busyThis={busyDate === day.date}
                weekdayLabel={weekdayLabel}
                statusLabel={statusLabel}
                onRequestOrder={() => requestOrder(day.date)}
                onRequestCancel={() => requestCancel(day.date)}
                insightRecommended={insightRec}
                insightPreferredMotion={insightPulse}
              />
            );
          })}
        </ul>
      ) : (
        <>
          <div
            ref={carouselRef}
            className={`-mx-4 flex snap-x snap-mandatory overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [-ms-overflow-style:none] md:mx-0 [&::-webkit-scrollbar]:hidden ${globalBusy ? "pointer-events-none opacity-[0.92]" : ""}`}
            style={{
              WebkitOverflowScrolling: "touch",
              scrollBehavior: "smooth",
            }}
            aria-label="Dager"
          >
            {sortedDays.map((day) => {
              const weekdayLabel = formatWeekdayNO(day.date) || day.weekday;
              const statusLabel = statusLabelForDay(day);
              const insightRec = Boolean(recommendedDate && day.date === recommendedDate && preferredWeekday);
              const insightPulse =
                Boolean(
                  preferredWeekday &&
                    String(day.weekday).toLowerCase() === preferredWeekday &&
                    day.isEnabled &&
                    !insightRec,
                );
              return (
                <div
                  key={day.date}
                  data-date={day.date}
                  data-day-slide=""
                  className="w-full min-w-full shrink-0 snap-center snap-always px-4"
                >
                  <WeekDayCardMobile
                    day={day}
                    canAct={canAct}
                    globalBusy={globalBusy}
                    busyThis={busyDate === day.date}
                    weekdayLabel={weekdayLabel}
                    statusLabel={statusLabel}
                    isSelected={selectedDate === day.date}
                    onSelectDay={() => selectDayFromTap(day.date)}
                    onRequestOrder={() => requestOrder(day.date)}
                    onRequestCancel={() => requestCancel(day.date)}
                    insightRecommended={insightRec}
                    insightPreferredMotion={insightPulse}
                  />
                </div>
              );
            })}
          </div>

          {selectedDay ? (
            <div
              className={`fixed bottom-0 left-0 right-0 z-40 border-t border-black/10 bg-white/95 px-4 pt-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm motion-safe:transition-[transform,opacity] motion-safe:duration-200 motion-safe:ease-out ${
                stickyBarHidden ? "pointer-events-none translate-y-full opacity-0" : "translate-y-0 opacity-100"
              }`}
              style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
            >
              <div className="mx-auto max-w-lg">
                <p className="mb-2 text-center text-xs font-medium text-neutral-600">
                  {formatWeekdayNO(selectedDay.date) || selectedDay.weekday} · {formatDateNO(selectedDay.date)}
                </p>
                {stickyCtaForDay(
                  selectedDay,
                  canAct,
                  globalBusy,
                  busyDate === selectedDay.date,
                  () => requestOrder(selectedDay.date),
                  () => requestCancel(selectedDay.date),
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
