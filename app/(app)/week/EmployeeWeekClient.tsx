"use client";

import { CheckIcon, ClockIcon, Loader2, MinusIcon } from "lucide-react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { formatDateNO, formatMenuDateNO, formatWeekdayNO } from "@/lib/date/format";
import { addDaysISO, isIsoDate, startOfWeekISO } from "@/lib/date/oslo";
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
import WeekAllergenProfileCard from "@/components/employee/WeekAllergenProfileCard";
import { ALLERGEN_DISPLAY_LABELS, displayAllergens } from "@/lib/cms/menuDayContract";
import { buildOrderedMealDisplayLine } from "@/lib/employee/orderedMealDisplay";

const API_ORDER = "/api/order";

/** STEG 8 — dekorativt livssyklus-ikon (1em, currentColor, aria-hidden). */
const DS_WEEK_ICON_STROKE = 2;

type DsWeekIconVariant = "clock" | "minus" | "check";

function DsWeekIcon({ variant }: { variant: DsWeekIconVariant }) {
  const iconProps = {
    className: "ds-week-icon",
    "aria-hidden": true as const,
    strokeWidth: DS_WEEK_ICON_STROKE,
  };
  if (variant === "clock") return <ClockIcon {...iconProps} />;
  if (variant === "minus") return <MinusIcon {...iconProps} />;
  return <CheckIcon {...iconProps} />;
}

function safeVibrate(ms: number) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator && typeof navigator.vibrate === "function") {
      navigator.vibrate(ms);
    }
  } catch {
    /* ignore */
  }
}

export type DayRow = {
  date: string;
  weekday: string;
  tier: "BASIS" | "LUXUS" | "ENTERPRISE" | null;
  planTier: "BASIS" | "LUXUS" | "ENTERPRISE" | null;
  allowedChoices: MealChoice[];
  categories: DayCategory[];
  selectedChoiceKey: string | null;
  /** Persistert menyvariant (kun når aktiv bestilling og menuDay.items >= 2 for kategori). */
  selectedItemKey: string | null;
  selectedItemTitleSnapshot: string | null;
  isLocked: boolean;
  isEnabled: boolean;
  lockReason?: string | null;
  orderStatus: "ACTIVE" | "CANCELLED" | null;
  wantsLunch: boolean;
  menuTitle?: string | null;
  menuDescription: string | null;
  allergens: string[];
  menuImages: string[];
  reason?: "NO_TIER_FOR_DAY" | string | null;
};

type MealChoice = {
  key: string;
  label: string;
};

export type DayChoiceSelection = {
  categoryKey: string;
  itemKey: string | null;
  itemTitle: string | null;
};

type WeekChoiceStored = string | DayChoiceSelection | null | undefined;

type DayCategoryItemApi = {
  key: string;
  title: string;
  description?: string;
  allergens: string[];
  isVegetarian: boolean;
};

type DayCategory = {
  key: string;
  category: "paasmurt" | "salat" | "sushi" | "pokebowl" | "thai" | "varmrett" | null;
  label: string;
  title: string | null;
  description: string | null;
  allergens: string[];
  available: boolean;
  /** Underkategorier fra Sanity menuDay.items (FASE 10C). */
  items: DayCategoryItemApi[];
};

type WindowPayload = {
  ok?: boolean;
  /** Til mapDay → DayRow. Ingen employer-priser (`unit_price`) i denne kanalen. */
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
type PreviewMode = "basis" | "luxus" | "mixed" | "enterprise";
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

function isDayCutoffClosed(day: DayRow | undefined): boolean {
  return Boolean(day?.isLocked && day.lockReason === "CUTOFF");
}

function orderErrorKey(json: Record<string, unknown> | null): string {
  if (!json || typeof json !== "object") return "";
  if (typeof json.error === "string" && json.error.trim()) return json.error.trim();
  if (typeof json.code === "string" && json.code.trim()) return json.code.trim();
  return "";
}

function handleOrderError(
  status: number,
  json: Record<string, unknown> | null,
  setErrorBanner: (state: ErrorBannerState) => void,
): void {
  const errorKey = orderErrorKey(json);
  if (status === 409 && errorKey === "menu_not_published") {
    setErrorBanner({ code: errorKey, message: "Menyen for valgt dag er ikke publisert ennå" });
    return;
  }
  if (status === 409 && errorKey === "menu_items_missing") {
    setErrorBanner({ code: errorKey, message: "Menyen er ikke ferdig klargjort — prøv igjen om litt" });
    return;
  }
  if (status === 422 && errorKey === "data_integrity") {
    setErrorBanner({ code: errorKey, message: "Teknisk feil — support er varslet" });
    Sentry.captureMessage("Order data_integrity", {
      level: "warning",
      tags: { error_code: String(json?.code ?? "NOT_NULL_VIOLATION") },
    });
    return;
  }
  if (status === 422 && errorKey === "provider_unresolvable") {
    setErrorBanner({ code: errorKey, message: "Konfigurasjonsfeil for valgt dag — kontakt support" });
    return;
  }
  setErrorBanner({ code: errorKey || null, message: "Noe gikk galt — prøv igjen" });
}

function asOrderStatus(v: unknown): "ACTIVE" | "CANCELLED" | null {
  const s = String(v ?? "").toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "CANCELLED" || s === "CANCELED") return "CANCELLED";
  return null;
}

function asTier(v: unknown): "BASIS" | "LUXUS" | "ENTERPRISE" | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "BASIS" || s === "LUXUS" || s === "ENTERPRISE") return s;
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

function mapCategoryItem(raw: unknown): DayCategoryItemApi | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const key = String(o.key ?? "").trim();
  if (!key) return null;
  const title = String(o.title ?? key).trim() || key;
  const allergens = Array.isArray(o.allergens) ? (o.allergens as unknown[]).map((x) => String(x)) : [];
  let description: string | undefined;
  if (typeof o.description === "string") {
    const d = o.description.trim();
    if (d) description = d;
  }
  return {
    key,
    title,
    ...(description !== undefined ? { description } : {}),
    allergens,
    isVegetarian: o.isVegetarian === true,
  };
}

function mapCategory(raw: unknown): DayCategory | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const key = String(c.key ?? "").trim();
  if (!key) return null;
  const categoryRaw = String(c.category ?? "").trim();
  const category =
    categoryRaw === "paasmurt" ||
    categoryRaw === "salat" ||
    categoryRaw === "sushi" ||
    categoryRaw === "pokebowl" ||
    categoryRaw === "thai" ||
    categoryRaw === "varmrett"
      ? categoryRaw
      : null;
  const itemsRaw = Array.isArray(c.items) ? (c.items as unknown[]).map(mapCategoryItem).filter(Boolean) : [];
  const items = itemsRaw as DayCategoryItemApi[];
  return {
    key,
    category,
    label: String(c.label ?? key).trim() || key,
    title: c.title != null ? String(c.title).trim() || null : null,
    description: c.description != null ? String(c.description).trim() || null : null,
    allergens: Array.isArray(c.allergens) ? (c.allergens as unknown[]).map((x) => String(x)) : [],
    available: c.available !== false,
    items,
  };
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
    planTier: asTier(d.planTier ?? d.tier),
    allowedChoices: Array.isArray(d.allowedChoices) ? (d.allowedChoices as unknown[]).map(mapChoice).filter(Boolean) as MealChoice[] : [],
    categories: Array.isArray(d.categories) ? (d.categories as unknown[]).map(mapCategory).filter(Boolean) as DayCategory[] : [],
    selectedChoiceKey: d.selectedChoiceKey != null ? String(d.selectedChoiceKey).trim() || null : null,
    selectedItemKey:
      d.selectedItemKey != null && String(d.selectedItemKey).trim().length ? String(d.selectedItemKey).trim() : null,
    selectedItemTitleSnapshot:
      d.selectedItemTitleSnapshot != null && String(d.selectedItemTitleSnapshot).trim().length
        ? String(d.selectedItemTitleSnapshot).trim()
        : null,
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
    reason: d.reason != null ? String(d.reason) : null,
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

const BTN_TOUCH =
  "motion-safe:transition-transform motion-safe:duration-150 motion-safe:active:scale-[0.95] transition-colors duration-100 active:bg-gray-100/90";

const CARD_TRANSFORM =
  "motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:scale-[1.01] motion-safe:active:scale-[0.97] will-change-transform";

const BASIS_CATEGORY_LABELS = ["Salatboks", "Påsmurt", "Varmmat"];
const LUXUS_CATEGORY_LABELS = ["Salatboks", "Påsmurt", "Sushi", "Pokebowl", "Thaimat", "Varmmat"];
const PRIMARY_CTA =
  "bg-gradient-to-r from-accent to-accent-gradient-end text-neutral-950 shadow-accent";
const SECONDARY_CTA = "border border-black/10 bg-white text-neutral-900 shadow-secondary";
const WEEKDAY_GRID_COLUMN: Record<string, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
};

function fallbackSelectorGridPosition(index: number) {
  return {
    gridColumnStart: (index % 5) + 1,
    gridRowStart: Math.floor(index / 5) + 1,
  };
}

function selectorGridPosition(
  day: DayRow,
  weekRows: string[],
  fallbackIndex: number,
) {
  if (!isIsoDate(day.date)) return fallbackSelectorGridPosition(fallbackIndex);
  const weekdayKey = weekdayKeyFromDateISO(day.date);
  const gridColumnStart = weekdayKey ? WEEKDAY_GRID_COLUMN[weekdayKey] : undefined;
  const weekStart = startOfWeekISO(day.date);
  const weekIndex = weekRows.indexOf(weekStart);
  if (!gridColumnStart || weekIndex < 0) {
    return fallbackSelectorGridPosition(fallbackIndex);
  }
  return {
    gridColumnStart,
    gridRowStart: weekIndex + 1,
  };
}

export function isCalendarUpcoming(day: DayRow, osloToday: string | null): boolean {
  if (!osloToday) return true;
  if (day.date < osloToday) return false;
  if (day.date === osloToday && day.isLocked && day.lockReason === "CUTOFF") return false;
  return true;
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
    <span className={`ds-week-status-pill is-cutoff ${className}`.trim()}>
      Frist passert 08:00
    </span>
  );
}

export function tierChoiceLimit(tier: DayRow["tier"]) {
  if (tier === "LUXUS" || tier === "ENTERPRISE") return 6;
  if (tier === "BASIS") return 3;
  return 0;
}

function tierLabel(day: DayRow) {
  const limit = tierChoiceLimit(day.tier);
  if (day.tier === "ENTERPRISE") return `Enterprise - ${limit} valg`;
  if (day.tier === "LUXUS") return `Luxus - ${limit} valg`;
  if (day.tier === "BASIS") return `Basis - ${limit} valg`;
  return "Ikke tilgjengelig";
}

function tierPillText(tier: DayRow["tier"]) {
  if (tier === "ENTERPRISE") return "Enterprise";
  if (tier === "LUXUS") return "Luxus";
  if (tier === "BASIS") return "Basis";
  return "Ikke tilgjengelig";
}

export function tierPillClass(tier: DayRow["tier"]) {
  if (tier === "ENTERPRISE") return "ds-tier-pill is-enterprise";
  if (tier === "LUXUS") return "ds-tier-pill is-luxus";
  if (tier === "BASIS") return "ds-tier-pill is-basis";
  return "ds-tier-pill is-unavailable";
}

function TierPill({ tier }: { tier: DayRow["tier"] }) {
  return <span className={tierPillClass(tier)}>{tierPillText(tier)}</span>;
}

function isNoTierForDay(day: DayRow) {
  return day.reason === "NO_TIER_FOR_DAY";
}

function NoTierForDayNotice() {
  return (
    <div className="ds-week-surface ds-week-surface--inset text-left">
      <p className="text-sm font-semibold text-neutral-900">Denne dagen er ikke tilgjengelig for bestilling.</p>
      <p className="mt-1 text-sm text-neutral-600">Kontakt firmaadmin.</p>
    </div>
  );
}

export function buildOrderWriteBody(date: string, wantsLunch: boolean, choiceKey?: string | null, itemKey?: string | null) {
  const ik = typeof itemKey === "string" && itemKey.trim().length ? itemKey.trim() : null;
  return {
    date,
    action: wantsLunch ? "set" : "cancel",
    ...(wantsLunch && choiceKey ? { choice_key: choiceKey } : {}),
    ...(wantsLunch && choiceKey && ik ? { itemKey: ik } : {}),
  };
}

function fallbackCategoryLabels(day: DayRow) {
  if (day.tier === "LUXUS" || day.tier === "ENTERPRISE") return LUXUS_CATEGORY_LABELS;
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
  return formatMenuDateNO(day.date);
}

export function orderStatusLabel(day: DayRow) {
  if (!day.isEnabled) return "Ikke tilgjengelig";
  if (day.orderStatus === "ACTIVE") return "Bestilt";
  if (day.orderStatus === "CANCELLED") return "Avbestilt";
  if (day.isLocked && day.lockReason === "CUTOFF") return "Frist passert";
  if (day.isLocked) return "Ikke tilgjengelig";
  return "Ikke bestilt";
}

export function statusPresentation(day: DayRow): { label: string; className: string } {
  const label = orderStatusLabel(day);
  const base = "ds-week-status-pill";

  if (label === "Bestilt") {
    return { label, className: `${base} is-ordered` };
  }
  if (label === "Ikke bestilt") {
    return { label: "Ikke bestilt", className: `${base} is-open` };
  }
  if (label === "Avbestilt") {
    return { label, className: `${base} is-cancelled` };
  }
  return { label, className: `${base} is-locked` };
}

function canOrderDay(day: DayRow, canAct: boolean, globalBusy: boolean) {
  return canAct && day.isEnabled && !day.isLocked && !globalBusy;
}

function previewTierForDay(mode: PreviewMode, index: number): DayRow["tier"] {
  if (mode === "enterprise") return "ENTERPRISE";
  if (mode === "luxus") return "LUXUS";
  if (mode === "mixed") return index < 3 ? "BASIS" : "LUXUS";
  return "BASIS";
}

function choicesForTier(tier: DayRow["tier"]): MealChoice[] {
  if (!tier) return [];
  return (tier === "BASIS" ? BASIS_CATEGORY_LABELS : LUXUS_CATEGORY_LABELS).map((label) => ({
    key: label.toLowerCase().replace(/\s+/g, "-"),
    label,
  }));
}

const PREVIEW_ISO_DATES_DEFAULT = ["2026-05-04", "2026-05-05", "2026-05-06", "2026-05-07", "2026-05-08"] as const;

function buildPreviewDayRows(mode: PreviewMode, dates: readonly string[]): DayRow[] {
  return dates.map((date, index) => {
    const tier = previewTierForDay(mode, index);
    return {
      date,
      weekday: formatWeekdayNO(date),
      tier,
      planTier: tier,
      allowedChoices: choicesForTier(tier),
      categories: choicesForTier(tier).map((choice) => ({
        key: choice.key,
        category: null,
        label: choice.label,
        title: null,
        description: null,
        allergens: [],
        available: true,
        items: [],
      })),
      selectedChoiceKey: null,
      selectedItemKey: null,
      selectedItemTitleSnapshot: null,
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

function buildPreviewDays(mode: PreviewMode = "basis"): DayRow[] {
  return buildPreviewDayRows(mode, PREVIEW_ISO_DATES_DEFAULT);
}

function ReadOnlyPreviewHint({ className = "" }: { className?: string }) {
  return <p className={`mt-1 text-xs font-medium text-neutral-500 ${className}`}>Kun forhåndsvisning</p>;
}

function selectedChoiceLabel(day: DayRow) {
  if (!day.selectedChoiceKey) return null;
  const selected = day.allowedChoices.find((c) => c.key.toLowerCase() === day.selectedChoiceKey?.toLowerCase());
  return selected?.label ?? day.selectedChoiceKey;
}

/** ACTIVE order line — «Kategori – variant» (CMS items / snapshot, not raw slug). */
export function orderedMealDisplayLine(day: DayRow): string | null {
  return buildOrderedMealDisplayLine(day);
}

function OrderedMealStatusLine({ day, className = "" }: { day: DayRow; className?: string }) {
  const body = orderedMealDisplayLine(day);
  if (day.orderStatus !== "ACTIVE" || !body) return null;
  return (
    <p className={`ds-ordered-meal-line ${className}`.trim()} role="status">
      <span className="sr-only">Bestilt:</span>
      <span className="ds-ordered-meal-line__body">{body}</span>
    </p>
  );
}

function parseStoredSelection(stored: WeekChoiceStored): DayChoiceSelection | null {
  if (stored == null) return null;
  if (typeof stored === "string") {
    const ck = stored.trim();
    return ck ? { categoryKey: ck, itemKey: null, itemTitle: null } : null;
  }
  if (typeof stored === "object" && typeof (stored as DayChoiceSelection).categoryKey === "string") {
    const s = stored as DayChoiceSelection;
    const ck = s.categoryKey.trim();
    if (!ck) return null;
    const ik =
      s.itemKey != null && String(s.itemKey).trim().length ? String(s.itemKey).trim() : null;
    const it =
      s.itemTitle != null && String(s.itemTitle).trim().length ? String(s.itemTitle).trim() : null;
    return { categoryKey: ck, itemKey: ik, itemTitle: it };
  }
  return null;
}

function choiceComparable(stored: WeekChoiceStored): string {
  if (stored === null) return "";
  const p = parseStoredSelection(stored);
  if (!p) return "";
  return `${p.categoryKey}\u001f${p.itemKey ?? ""}\u001f${p.itemTitle ?? ""}`;
}

function categoriesItemsSignature(cats: DayCategory[]): string {
  return cats.map((c) => `${c.key}:${c.items.length}`).join("|");
}

function variantPickRequired(cat: DayCategory | undefined): boolean {
  return Boolean(cat?.items?.length && cat!.items!.length >= 2);
}

function effectiveSelectedChoice(day: DayRow, stored: WeekChoiceStored): string | null {
  if (stored === null) return null;
  const parsed = parseStoredSelection(stored);
  const explicit = String(parsed?.categoryKey ?? "").trim();
  if (explicit) return explicit;
  const available = day.categories.filter((c) => c.available);
  return available.length === 1 ? available[0]!.key : null;
}

function choiceRequired(day: DayRow) {
  return day.categories.filter((c) => c.available).length > 1;
}

function singleCategoryItemDefault(cat: DayCategory | undefined): DayChoiceSelection | null {
  if (!cat?.items?.length || cat.items.length !== 1) return null;
  const it = cat.items[0]!;
  const ik = String(it.key ?? "").trim();
  if (!ik) return null;
  return {
    categoryKey: cat.key,
    itemKey: ik,
    itemTitle: String(it.title ?? "").trim() || null,
  };
}

function variantPickSatisfied(day: DayRow, stored: WeekChoiceStored): boolean {
  const ck = effectiveSelectedChoice(day, stored);
  if (!ck) return true;
  const cat = day.categories.find((c) => c.key.toLowerCase() === ck.toLowerCase());
  if (!variantPickRequired(cat)) return true;
  return Boolean(parseStoredSelection(stored)?.itemKey?.trim());
}

function normalizeSelectionForDay(day: DayRow, prevRaw: WeekChoiceStored): WeekChoiceStored | null {
  if (prevRaw === null) return null;
  const parsed = parseStoredSelection(prevRaw);
  const avail = day.categories.filter((c) => c.available);
  const singleAuto = avail.length === 1 ? avail[0]!.key : null;

  if (!parsed?.categoryKey) {
    return singleAuto ? { categoryKey: singleAuto, itemKey: null, itemTitle: null } : null;
  }
  const cat = day.categories.find((c) => c.key.toLowerCase() === parsed.categoryKey.toLowerCase());
  if (!cat || !cat.available) {
    return singleAuto ? { categoryKey: singleAuto, itemKey: null, itemTitle: null } : null;
  }
  if (parsed.itemKey) {
    const ik = parsed.itemKey.toLowerCase();
    const still = cat.items.some((i) => i.key.toLowerCase() === ik);
    if (!still) return { categoryKey: cat.key, itemKey: null, itemTitle: null };
  }
  return parsed;
}

function canOrderWithChoice(day: DayRow, canAct: boolean, globalBusy: boolean, stored: WeekChoiceStored) {
  const chosen =
    !choiceRequired(day) || Boolean(effectiveSelectedChoice(day, stored));
  return canOrderDay(day, canAct, globalBusy) && chosen && variantPickSatisfied(day, stored);
}

function selectedChoiceSummaryLabel(day: DayRow, stored: WeekChoiceStored): string | null {
  const ck = effectiveSelectedChoice(day, stored);
  if (!ck) return null;
  const cat = day.categories.find((c) => c.key.toLowerCase() === ck.toLowerCase());
  const p = parseStoredSelection(stored);
  const lab = cat?.label ?? ck;
  if (p?.itemTitle?.trim()) return `${lab} · ${p.itemTitle.trim()}`;
  return lab;
}

type ChoiceHighlightLine =
  | { mode: "none" }
  | { mode: "variant_pending"; categoryLabel: string }
  /** Full «Valgt: …» tekst uten prefiks «Valgt:» (brukes/emerald-chip). */
  | { mode: "valgt_body"; body: string };

function choiceHighlightLine(day: DayRow, stored: WeekChoiceStored): ChoiceHighlightLine {
  if (day.orderStatus === "ACTIVE") {
    const ordered = orderedMealDisplayLine(day);
    return ordered ? { mode: "valgt_body", body: ordered } : { mode: "none" };
  }
  const ck = effectiveSelectedChoice(day, stored);
  if (!ck) return { mode: "none" };
  const cat = day.categories.find((c) => c.key.toLowerCase() === ck.toLowerCase());
  if (!cat) return { mode: "none" };
  const p = parseStoredSelection(stored ?? null);
  if (variantPickRequired(cat) && !p?.itemKey?.trim()) {
    return { mode: "variant_pending", categoryLabel: cat.label };
  }
  const body = selectedChoiceSummaryLabel(day, stored);
  return body ? { mode: "valgt_body", body } : { mode: "none" };
}

function itemAriaLabel(title: string, allergens: readonly string[], isVegetarian: boolean): string {
  const allergensText = displayAllergens(allergens as string[]);
  const parts = [title.trim()];
  parts.push(allergensText ? `Inneholder ${allergensText}` : "Ingen oppregnede EU-allergener for varianten");
  if (isVegetarian) parts.push("Vegetar");
  return parts.join(". ").replace(/\s+/g, " ").trim();
}

function needsVariantHint(day: DayRow, stored: WeekChoiceStored): boolean {
  const ck = effectiveSelectedChoice(day, stored);
  if (!ck) return false;
  const cat = day.categories.find((c) => c.key.toLowerCase() === ck.toLowerCase());
  return Boolean(variantPickRequired(cat) && !parseStoredSelection(stored)?.itemKey);
}

function primaryOrderButtonTitle(day: DayRow, stored: WeekChoiceStored, readOnlyPreview: boolean | undefined): string | undefined {
  if (readOnlyPreview) return "Kun forhåndsvisning";
  if (choiceRequired(day) && !effectiveSelectedChoice(day, stored)) return "Velg en kategori først";
  if (needsVariantHint(day, stored)) return "Velg variant før bestilling";
  return undefined;
}

export function WeekCategoryCards({
  day,
  storedChoice,
  onSelectCategory,
  onSelectItem,
  disabled,
}: {
  day: DayRow;
  storedChoice: WeekChoiceStored;
  onSelectCategory: (choiceKey: string) => void;
  onSelectItem: (categoryKey: string, itemKey: string, itemTitle: string) => void;
  disabled?: boolean;
}) {
  if (isNoTierForDay(day)) return null;
  if (!day.categories.length) return null;
  const cutoffClosed = day.isLocked && day.lockReason === "CUTOFF";
  const selectedKey = effectiveSelectedChoice(day, storedChoice);
  const orderedChoiceKey =
    day.orderStatus === "ACTIVE" && day.selectedChoiceKey
      ? String(day.selectedChoiceKey).trim().toLowerCase()
      : null;
  const selectedCat = selectedKey
    ? day.categories.find((c) => c.key.toLowerCase() === selectedKey.toLowerCase())
    : undefined;
  const isPendingSelection = Boolean(
    selectedKey && selectedCat && (!orderedChoiceKey || selectedCat.key.toLowerCase() !== orderedChoiceKey),
  );
  const showExpandedPanel = Boolean(
    selectedCat && selectedCat.available && day.isEnabled && !disabled && isPendingSelection,
  );

  const itemCount = selectedCat?.items?.length ?? 0;
  const hasCategoryHeadline =
    !!(selectedCat && (String(selectedCat.title ?? "").trim() !== "" || String(selectedCat.description ?? "").trim() !== ""));
  const isSelectableItems = selectedCat !== undefined && itemCount >= 2;
  const parsed = parseStoredSelection(storedChoice ?? null);
  const selectedItemKey = parsed?.itemKey ?? null;

  /** Rett opp presedens — én menylinje må være tittel eller beskrivelse, ikke falsk «info» ved undefined. */
  const showInfoCard =
    !!selectedCat && itemCount === 0 && (String(selectedCat.title ?? "").trim() !== "" || String(selectedCat.description ?? "").trim() !== "");
  const showEmptyMenuPlaceholder = !!selectedCat && itemCount === 0 && !hasCategoryHeadline;

  let sectionHeading = "";
  if (selectedCat) {
    sectionHeading =
      itemCount >= 2 ? `Velg variant for ${selectedCat.label}` : `Detaljer for ${selectedCat.label}`;
  }

  const titleDomId = selectedCat ? `week-items-title-${selectedCat.key}` : "week-items-title";

  const expandSection =
    showExpandedPanel && selectedCat ? (
      <div
        key={selectedCat.key}
        className={`ds-week-items-section ds-week-items-section--inline${isSelectableItems ? "" : " ds-week-items-section--details"}`}
        role={isSelectableItems ? "radiogroup" : "region"}
        aria-labelledby={titleDomId}
      >
        <p id={titleDomId} className="ds-week-items-section__title">
          {sectionHeading}
        </p>
        {isSelectableItems ? (
          <div className="ds-week-items-grid">
            {selectedCat.items.map((it) => {
              const isItemSelected = Boolean(
                selectedItemKey && String(it.key).toLowerCase() === String(selectedItemKey).toLowerCase(),
              );
              return (
                <button
                  key={it.key}
                  type="button"
                  role="radio"
                  aria-checked={isItemSelected}
                  aria-pressed={isItemSelected}
                  disabled={disabled || !day.isEnabled || !selectedCat.available}
                  onClick={() => onSelectItem(selectedCat.key, it.key, it.title)}
                  className={`ds-week-surface ds-week-surface--slot ds-week-item-btn${it.isVegetarian ? " ds-week-item-btn--vegetarian" : ""}${isItemSelected ? " is-selected ds-week-item-btn--selected" : ""}`}
                  aria-label={itemAriaLabel(it.title, it.allergens, it.isVegetarian)}
                >
                  <span className="ds-week-item-btn__title">{it.title}</span>
                  <span className="ds-week-item-btn__meta">
                    {(it.allergens ?? []).map((slug) => (
                      <span key={slug} className="ds-allergen-badge ds-allergen-badge--warning">
                        <span aria-hidden="true">
                          ⚠{" "}
                        </span>
                        {ALLERGEN_DISPLAY_LABELS[slug] ?? slug}
                      </span>
                    ))}
                    {it.isVegetarian ? (
                      <span className="ds-vegetarian-badge">
                        <span aria-hidden="true">🌿 </span>
                        Vegetar
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        ) : itemCount === 1 && selectedCat ? (
          <div className="ds-week-info-card" role="region" aria-labelledby={titleDomId}>
            <p id={titleDomId} className="ds-week-items-section__title">
              {sectionHeading}
            </p>
            {(() => {
              const it = selectedCat.items[0]!;
              return (
                <>
                  <h3 className="ds-week-info-card__title">{it.title}</h3>
                  {it.description ? (
                    <p className="ds-week-info-card__desc">{String(it.description).trim()}</p>
                  ) : null}
                  {(it.allergens ?? []).length > 0 || it.isVegetarian ? (
                    <div className="ds-week-info-card__meta">
                      {(it.allergens ?? []).map((slug) => (
                        <span key={slug} className="ds-allergen-badge ds-allergen-badge--warning">
                          <span aria-hidden="true">⚠ </span>
                          {ALLERGEN_DISPLAY_LABELS[slug] ?? slug}
                        </span>
                      ))}
                      {it.isVegetarian ? (
                        <span className="ds-vegetarian-badge">
                          <span aria-hidden="true">🌿 </span>
                          Vegetar
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </>
              );
            })()}
          </div>
        ) : showInfoCard ? (
          <div className="ds-week-info-card">
            {selectedCat.title ? (
              <h3 className="ds-week-info-card__title">{String(selectedCat.title).trim()}</h3>
            ) : (
              <h3 className="ds-week-info-card__title">{selectedCat.label}</h3>
            )}
            {selectedCat.description ? (
              <p className="ds-week-info-card__desc">{String(selectedCat.description).trim()}</p>
            ) : null}
            {selectedCat.allergens.length > 0 ? (
              <div className="ds-week-info-card__meta">
                {(selectedCat.allergens ?? []).map((slug) => (
                  <span key={slug} className="ds-allergen-badge ds-allergen-badge--warning">
                    <span aria-hidden="true">⚠ </span>
                    {ALLERGEN_DISPLAY_LABELS[String(slug)] ?? String(slug)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : showEmptyMenuPlaceholder ? (
          <p className="ds-week-info-card__placeholder" role="status">
            Ingen meny lagt inn enda for {selectedCat.label}.
          </p>
        ) : null}
      </div>
    ) : null;

  return (
    <div className="week-day__categories" aria-label="Velg kategori">
      {day.categories.map((cat) => {
        const keyLower = cat.key.toLowerCase();
        const isOrdered = Boolean(orderedChoiceKey && orderedChoiceKey === keyLower);
        const isSelected = Boolean(selectedKey && selectedKey.toLowerCase() === keyLower);
        const isPendingCat = isSelected && !isOrdered;
        const slotLocked = cutoffClosed;
        const slotUnavailable = !cat.available;
        const slotDisabled = Boolean(disabled || slotUnavailable || !day.isEnabled || slotLocked);
        return (
          <Fragment key={cat.key}>
            <button
              type="button"
              className={[
                "ds-week-surface ds-week-surface--slot week-category-card",
                isOrdered ? "is-ordered" : "",
                isPendingCat ? "is-selected" : "",
                slotLocked ? "is-locked" : "",
                slotUnavailable ? "is-unavailable" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectCategory(cat.key)}
              disabled={slotDisabled}
              aria-disabled={slotLocked && !slotUnavailable ? true : undefined}
              aria-pressed={isOrdered || isPendingCat}
              aria-label={
                slotLocked
                  ? `${cat.label}, frist passert`
                  : slotUnavailable
                    ? `${cat.label}, ikke tilgjengelig`
                    : isOrdered
                      ? `${cat.label}, bestilt`
                      : isPendingCat
                        ? `${cat.label}, valgt`
                        : cat.label
              }
              title={
                slotUnavailable ? "Ikke tilgjengelig" : slotLocked ? "Frist passert" : isOrdered ? "Bestilt" : undefined
              }
            >
              <span className="week-category-card__label">{cat.label}</span>
              {slotLocked ? (
                <span className="week-category-card__state-label">
                  <ClockIcon className="week-category-card__state-icon" aria-hidden />
                  Frist passert
                </span>
              ) : slotUnavailable ? (
                <span className="week-category-card__state-label">Ikke tilgjengelig</span>
              ) : null}
            </button>
            {isPendingCat ? expandSection : null}
          </Fragment>
        );
      })}
    </div>
  );
}

function WeekLoadingSkeleton({ mobileLayout }: { mobileLayout: boolean }) {
  return (
    <ul className="flex flex-col gap-4" aria-busy="true" aria-label="Laster ukeplan">
      {[0, 1, 2, 3, 4].map((i) => (
        <li
          key={i}
          className="animate-pulse rounded-2xl border border-black/10 bg-white/90 p-4 text-left shadow-sm"
        >
          <div className="mb-2 h-6 w-24 rounded bg-gray-200" />
          <div className="mb-2 h-4 w-full rounded bg-gray-200" />
          <div className="mb-2 h-4 w-full rounded bg-gray-200" />
          <div className="h-10 w-full rounded bg-gray-200" />
        </li>
      ))}
    </ul>
  );
}

function resolvePreviewRowsForStaticPreview(
  readOnlyPreview: boolean,
  previewMode: PreviewMode,
  previewHarness: { calendarDates?: string[]; osloToday?: string } | null | undefined,
): DayRow[] {
  if (!readOnlyPreview) return [];
  const raw = previewHarness?.calendarDates ?? [];
  const hd = raw.filter((d) => typeof d === "string" && isIsoDate(d.trim()));
  if (hd.length > 0) return buildPreviewDayRows(previewMode, hd);
  return buildPreviewDays(previewMode);
}

type Props = {
  canAct: boolean;
  billingHoldReason?: string | null;
  previewMode?: PreviewMode;
  readOnlyPreview?: boolean;
  /**
   * Begrenset til readOnlyPreview: overstyr hvilke datoer kalender-demo bruker
   * og hvilken dato «Oslo today» markers som (stabile Vitest/UI-harness).
   */
  previewHarness?: { calendarDates: string[]; osloToday: string } | null;
};

/** Livssyklus-tilstand for dag (STEG 7.1 — presentasjon, ikke bestillingslogikk). */
export type WeekDayLifecycleState = "available" | "ordered" | "locked" | "unavailable";

export function weekDayLifecycleState(
  day: Pick<DayRow, "reason" | "isEnabled" | "isLocked" | "lockReason" | "orderStatus">,
): WeekDayLifecycleState {
  if (day.reason === "NO_TIER_FOR_DAY" || !day.isEnabled) return "unavailable";
  if (day.isLocked && day.lockReason === "CUTOFF") return "locked";
  if (day.orderStatus === "ACTIVE") return "ordered";
  return "available";
}

/** Eksportert for klassenavnkontrakttester på /week-kalenderen (FASE 12A + STEG 7.1). */
export function weekCalendarDayPillClassNames(
  active: boolean,
  isToday: boolean,
  lifecycle: WeekDayLifecycleState = "available",
): string {
  const base = ["ds-week-calendar-day-pill"];
  base.push(active ? "ds-week-calendar-day-pill--selected" : "ds-week-calendar-day-pill--idle");
  if (isToday) base.push("ds-week-calendar-day-pill--today");
  if (lifecycle === "ordered") base.push("ds-week-calendar-day-pill--ordered");
  if (lifecycle === "locked") base.push("ds-week-calendar-day-pill--locked");
  if (lifecycle === "unavailable") base.push("ds-week-calendar-day-pill--unavailable");
  return base.join(" ");
}

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
      className={`fixed inset-0 z-modal flex items-end justify-center bg-black/40 p-4 sm:items-center ${shell}`}
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
            className={`flex min-h-touch flex-1 items-center justify-center rounded-full border border-black/15 bg-white px-4 text-sm font-semibold text-neutral-900 disabled:opacity-50 ${BTN_TOUCH}`}
          >
            Avbryt
          </button>
          <button
            type="button"
            disabled={confirming}
            onClick={onConfirm}
            className={`flex min-h-touch flex-1 items-center justify-center rounded-full bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-50 ${BTN_TOUCH}`}
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
  storedChoice: WeekChoiceStored;
  onRequestOrder: () => void;
  onRequestCancel: () => void;
  onSelectCategory: (choiceKey: string) => void;
  onSelectItem: (categoryKey: string, itemKey: string, itemTitle: string) => void;
  /** Prediktiv markering — kun UI, ingen auto-handling. */
  insightRecommended?: boolean;
  insightPreferredMotion?: boolean;
  readOnlyPreview?: boolean;
};

type MobileCardProps = RowBase & {
  isSelected: boolean;
  onSelectDay: () => void;
  /** STEG 7.2 — efemær disclosure for ordered dag (før cutoff). */
  orderedPickerExpanded: boolean;
  onToggleOrderedPicker: () => void;
};

const WeekDayCardMobile = memo(
  function WeekDayCardMobile({
    day,
    canAct,
    globalBusy,
    busyThis,
    storedChoice,
    isSelected,
    onSelectDay,
    onRequestOrder,
    onRequestCancel,
    onSelectCategory,
    onSelectItem,
    insightRecommended,
    insightPreferredMotion,
    readOnlyPreview,
    orderedPickerExpanded,
    onToggleOrderedPicker,
  }: MobileCardProps) {
    const ordered = day.orderStatus === "ACTIVE";
    const lifecycle = weekDayLifecycleState(day);
    const mealLine = orderedMealDisplayLine(day);
    const orderedEditableCollapse = lifecycle === "ordered" && ordered && Boolean(mealLine);
    const orderedLockedCollapse = lifecycle === "locked" && ordered && Boolean(mealLine);
    const showOrderedCollapse = orderedEditableCollapse || orderedLockedCollapse;
    const showOrderedPicker =
      !showOrderedCollapse || (orderedEditableCollapse && orderedPickerExpanded);
    const orderedPickerId = `week-ordered-picker-${day.date}`;
    const cutoffClosed = day.isLocked && day.lockReason === "CUTOFF";
    const companyClosed = day.isLocked && day.lockReason === "COMPANY";
    const notInAgreement = !day.isEnabled;
    const noTierForDay = isNoTierForDay(day);
    const canClick = canOrderDay(day, canAct, globalBusy);
    const canOrderClick = canOrderWithChoice(day, canAct, globalBusy, storedChoice);
    const primaryTitle = primaryOrderButtonTitle(day, storedChoice, readOnlyPreview);
    const categories = getTierCategories(day);
    const highlightLine = choiceHighlightLine(day, storedChoice ?? null);
    const mobileChoiceLine =
      highlightLine.mode === "variant_pending"
        ? `Velg variant for ${highlightLine.categoryLabel}`
        : highlightLine.mode === "valgt_body" && day.orderStatus !== "ACTIVE"
          ? `Valgt: ${highlightLine.body}`
          : undefined;
    const status = statusPresentation(day);

    return (
      <div
        role="group"
        aria-label={formatMenuDateNO(day.date)}
        className={`ds-week-surface ds-week-surface--panel bg-white/85 transition-colors duration-100 active:bg-white ${CARD_TRANSFORM} ${
          isSelected
            ? "motion-safe:scale-[1.01] ring-neutral-900/15"
            : `${insightPreferredMotion ? " motion-safe:ring-1 motion-safe:ring-neutral-300/60 motion-safe:animate-pulse" : ""}`
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
          className="cursor-pointer rounded-card outline-none transition-colors duration-100 active:bg-bg-soft focus-visible:ring-2 focus-visible:ring-neutral-900/40"
        >
          <div className="flex flex-wrap items-center justify-start gap-2">
            <TierPill tier={day.tier} />
            <span className={status.className}>{status.label}</span>
            {cutoffClosed ? <CutoffPassedBadge /> : null}
            {readOnlyPreview ? (
              <span className="ds-week-status-pill is-preview">Forhåndsvisning</span>
            ) : null}
          </div>

          <div className="mt-5">
            <h2 className="text-2xl font-bold capitalize tracking-[-0.03em] text-neutral-950">
              {selectedDayLabel(day)}
            </h2>
            {mobileChoiceLine ? (
              <p className="mt-1 text-sm font-medium text-neutral-600">{mobileChoiceLine}</p>
            ) : null}
          </div>
        </div>

        {showOrderedCollapse ? (
          <div className="ds-week-ordered-collapse mt-3">
            <p className="ds-week-ordered-collapse__summary" role="status">
              <span className="ds-week-ordered-collapse__label">Bestilt:</span>{" "}
              <span className="ds-week-ordered-collapse__meal">{mealLine}</span>
            </p>
            {orderedLockedCollapse ? (
              <p className="ds-week-ordered-collapse__locked-note">
                <DsWeekIcon variant="clock" />
                <span className="ds-week-ordered-collapse__locked-note__label">Frist passert</span>
                <span className="sr-only">Bestillingen kan ikke endres etter kl. 08:00.</span>
              </p>
            ) : null}
            {orderedEditableCollapse ? (
              <button
                type="button"
                className="ds-week-ordered-collapse__edit"
                aria-expanded={orderedPickerExpanded}
                aria-controls={orderedPickerId}
                aria-label={`Endre bestilling: ${mealLine}`}
                onClick={onToggleOrderedPicker}
              >
                Endre
              </button>
            ) : null}
          </div>
        ) : (
          <OrderedMealStatusLine day={day} className="mt-3" />
        )}
        {insightRecommended ? (
            <div className="mt-2 space-y-0.5 text-left">
              <span className="ds-week-insight-pill">
                Anbefalt for deg
              </span>
              <p className="text-[11px] text-neutral-600">Du bestiller ofte denne dagen</p>
              <p className="text-[10px] text-neutral-400">Basert på dine tidligere bestillinger</p>
            </div>
          ) : null}

          <div className="mt-5">
            {day.menuImages.length ? (
              <div className="mb-2 flex flex-wrap justify-start gap-2">
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
            {noTierForDay ? (
              <NoTierForDayNotice />
            ) : day.categories.length ? (
              showOrderedPicker ? (
                <div
                  id={orderedPickerId}
                  className={`week-ordered-picker-region${orderedEditableCollapse && orderedPickerExpanded ? " week-ordered-picker-region--open" : ""}`}
                  hidden={showOrderedCollapse && !orderedPickerExpanded}
                >
                  <WeekCategoryCards
                    day={day}
                    storedChoice={storedChoice}
                    onSelectCategory={onSelectCategory}
                    onSelectItem={onSelectItem}
                    disabled={readOnlyPreview || globalBusy}
                  />
                </div>
              ) : null
            ) : categories.length ? (
              <div className="space-y-2 text-left">
                {categories.map((category) => (
                  <div
                    key={category}
                    className="ds-week-surface ds-week-surface--inset is-row flex min-h-touch items-center gap-3 text-sm font-semibold text-neutral-900"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm ring-1 ring-black/5">
                      {category.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">{category}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ds-week-surface ds-week-surface--inset text-left">
                <p className="text-sm font-semibold text-neutral-900">Menyen er ikke publisert ennå.</p>
                <p className="mt-1 text-sm text-neutral-600">Denne dagen er ikke klar for bestilling.</p>
              </div>
            )}
          </div>

        <div className="mt-4 flex flex-col items-stretch gap-2">
          {noTierForDay ? (
            <span className="text-left text-sm text-neutral-500">Denne dagen er ikke tilgjengelig for bestilling. Kontakt firmaadmin.</span>
          ) : notInAgreement ? (
            <span className="text-left text-sm text-neutral-500">Ikke leveringsdag i avtalen.</span>
          ) : cutoffClosed ? (
            <>
              <button
                type="button"
                disabled
                className={`min-h-touch w-full cursor-not-allowed rounded-full border border-black/10 bg-neutral-50 px-4 text-sm font-semibold text-neutral-500 ${BTN_TOUCH}`}
              >
                Frist passert kl. 08:00
              </button>
              <CutoffSafetyHint day={day} />
            </>
          ) : companyClosed ? (
            <span className="text-left text-sm text-neutral-600">Bestilling stengt for firma</span>
          ) : ordered ? (
            <>
              <button
                type="button"
                disabled={readOnlyPreview || !canClick}
                aria-disabled={readOnlyPreview || !canClick}
                title={readOnlyPreview ? "Kun forhåndsvisning" : undefined}
                onClick={readOnlyPreview ? undefined : onRequestCancel}
                className={`flex min-h-cta items-center justify-center rounded-full px-4 text-sm font-bold disabled:pointer-events-none disabled:opacity-50 ${SECONDARY_CTA} ${BTN_TOUCH}`}
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
              {readOnlyPreview ? <ReadOnlyPreviewHint /> : <CutoffSafetyHint day={day} />}
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={readOnlyPreview || !canOrderClick}
                aria-disabled={readOnlyPreview || !canOrderClick}
                title={primaryTitle}
                onClick={readOnlyPreview ? undefined : onRequestOrder}
                className={`flex min-h-cta w-full items-center justify-center rounded-full px-6 text-sm font-bold disabled:pointer-events-none disabled:opacity-50 ${PRIMARY_CTA} ${BTN_TOUCH}`}
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
              {readOnlyPreview ? <ReadOnlyPreviewHint /> : <CutoffSafetyHint day={day} />}
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
    categoriesItemsSignature(prev.day.categories) === categoriesItemsSignature(next.day.categories) &&
    choiceComparable(prev.storedChoice) === choiceComparable(next.storedChoice) &&
    prev.isSelected === next.isSelected &&
    prev.globalBusy === next.globalBusy &&
    prev.busyThis === next.busyThis &&
    prev.canAct === next.canAct &&
    prev.insightRecommended === next.insightRecommended &&
    prev.insightPreferredMotion === next.insightPreferredMotion &&
    prev.readOnlyPreview === next.readOnlyPreview &&
    prev.orderedPickerExpanded === next.orderedPickerExpanded,
);

export default function EmployeeWeekClient({
  canAct,
  billingHoldReason,
  previewMode = "basis",
  readOnlyPreview = false,
  previewHarness = null,
}: Props) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const previewHarnessCalendarKey = (previewHarness?.calendarDates ?? []).join("|");

  const previewRowsResolved = useMemo(
    () => resolvePreviewRowsForStaticPreview(readOnlyPreview, previewMode, previewHarness),
    [readOnlyPreview, previewMode, previewHarnessCalendarKey],
  );

  const [days, setDays] = useState<DayRow[]>(() =>
    resolvePreviewRowsForStaticPreview(readOnlyPreview, previewMode, previewHarness),
  );
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
  const [selectedChoices, setSelectedChoices] = useState<Record<string, WeekChoiceStored | null>>({});
  /** STEG 7.2 — efemær «Endre»-disclosure per dag (default kollapset). */
  const [orderedPickerExpanded, setOrderedPickerExpanded] = useState<Record<string, boolean>>({});
  const [contentVisible, setContentVisible] = useState(false);
  /** Server-side etterspørselssignal (firma-scope) — kun informasjon. */
  const [demandHintLine, setDemandHintLine] = useState<string | null>(null);
  const [serverOsloDate, setServerOsloDate] = useState<string | null>(() =>
    readOnlyPreview
      ? (previewHarness?.osloToday ??
        resolvePreviewRowsForStaticPreview(true, previewMode, previewHarness)[0]?.date ??
        PREVIEW_ISO_DATES_DEFAULT[0])
      : null,
  );
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
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const navSourceRef = useRef<"init" | "tap" | "io">("init");
  const selectedDateRef = useRef<string | null>(null);
  const ioRef = useRef<IntersectionObserver | null>(null);
  /** Under programmatisk scroll (init/tap): ikke la IO overskrive valgt dag midlertidig. */
  const suppressIoUntilRef = useRef(0);
  const idemKeyRef = useRef<string | null>(null);
  const idemScopeRef = useRef<string | null>(null);

  const resetIdemKey = useCallback(() => {
    idemKeyRef.current = null;
    idemScopeRef.current = null;
  }, []);

  const ensureIdemKey = useCallback((scope: string): string => {
    if (idemScopeRef.current !== scope || !idemKeyRef.current) {
      idemScopeRef.current = scope;
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        idemKeyRef.current = crypto.randomUUID();
      } else {
        idemKeyRef.current = `idem-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
      }
    }
    return idemKeyRef.current;
  }, []);

  const [patternTick, setPatternTick] = useState(0);
  const patterns = useMemo(() => {
    void patternTick;
    return readOrderPatterns();
  }, [patternTick]);

  const sortedDays = useMemo(() => [...days].sort((a, b) => a.date.localeCompare(b.date)), [days]);
  const selectorWeekRows = useMemo(() => {
    const rows: string[] = [];
    for (const day of sortedDays) {
      if (!isIsoDate(day.date)) continue;
      const weekStart = startOfWeekISO(day.date);
      if (!rows.includes(weekStart)) rows.push(weekStart);
    }
    return rows;
  }, [sortedDays]);
  const placeholderCells = useMemo(() => {
    const haveDates = new Set(sortedDays.map((d) => d.date));
    const placeholders: Array<{
      date: string;
      weekdayKey: string;
      weekStart: string;
    }> = [];
    for (const weekStart of selectorWeekRows) {
      for (let offset = 0; offset < 5; offset++) {
        const date = addDaysISO(weekStart, offset);
        if (haveDates.has(date)) continue;
        const weekdayKey = weekdayKeyFromDateISO(date);
        if (!weekdayKey) continue;
        placeholders.push({ date, weekdayKey, weekStart });
      }
    }
    return placeholders;
  }, [sortedDays, selectorWeekRows]);

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
    setDays(previewRowsResolved);
    setCompanyName("Lunchportalen demo");
    setLoadError(null);
    setForbidden(false);
    setLoading(false);
    setServerOsloDate(previewHarness?.osloToday ?? previewRowsResolved[0]?.date ?? PREVIEW_ISO_DATES_DEFAULT[0]);
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
    setSelectedChoices({});
    navSourceRef.current = "init";
    setSelectedDate(previewRowsResolved[0]?.date ?? null);
  }, [previewRowsResolved, readOnlyPreview, previewHarness?.osloToday]);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    resetIdemKey();
  }, [selectedChoices, resetIdemKey]);

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
      // weeks=3 brukes som primær state-kilde. Server-side getVisibleWindow()
      // i lib/week/availability.ts avgjør om tredje uke faktisk inkluderes;
      // klienten ber alltid om maks, og server filtrerer. Fix fra FASE 10A.5.
      const res = await fetch(`${API_ORDER}/window?weeks=3`, { cache: "no-store", signal: ac.signal });
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
      setSelectedChoices((prev) => {
        const next: Record<string, WeekChoiceStored | null> = {};
        for (const day of mapped) {
          const prevChoice = prev[day.date];
          const hadKey = Object.prototype.hasOwnProperty.call(prev, day.date);
          const explicitCleared = hadKey && prevChoice === null;

          const serverHydrated =
            day.orderStatus === "ACTIVE" && day.selectedChoiceKey
              ? {
                  categoryKey: String(day.selectedChoiceKey).trim(),
                  itemKey: day.selectedItemKey ? String(day.selectedItemKey).trim() : null,
                  itemTitle: day.selectedItemTitleSnapshot ? String(day.selectedItemTitleSnapshot).trim() : null,
                }
              : null;
          const serverCat = day.selectedChoiceKey ? String(day.selectedChoiceKey).trim() : "";
          if (explicitCleared && !serverHydrated) {
            next[day.date] = null;
            continue;
          }
          const rawFallback =
            serverHydrated ?? (hadKey ? prevChoice : undefined) ?? (serverCat ? { categoryKey: serverCat, itemKey: null, itemTitle: null } : undefined);
          next[day.date] = normalizeSelectionForDay(day, rawFallback);
        }
        return next;
      });

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

  const selectDayFromTap = useCallback((date: string) => {
    navSourceRef.current = "tap";
    safeVibrate(10);
    setSelectedDate(date);
  }, []);

  const toggleOrderedPicker = useCallback((date: string) => {
    setOrderedPickerExpanded((prev) => ({
      ...prev,
      [date]: !prev[date],
    }));
  }, []);

  const collapseOrderedPicker = useCallback((date: string) => {
    setOrderedPickerExpanded((prev) => {
      if (prev[date] === false) return prev;
      return { ...prev, [date]: false };
    });
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
    async (date: string, wantsLunch: boolean, selectionOverride?: WeekChoiceStored): Promise<boolean> => {
      if (readOnlyPreview) return false;
      const rid = clientRid();
      setErrorBanner(null);
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }

      try {
        const day = days.find((d) => d.date === date);
        const storedForPost =
          selectionOverride !== undefined ? selectionOverride : (selectedChoices[date] ?? null);
        const choiceKey = day ? effectiveSelectedChoice(day, storedForPost) : null;
        if (wantsLunch && day && choiceRequired(day) && !effectiveSelectedChoice(day, storedForPost)) {
          setErrorBanner({ code: "CHOICE_REQUIRED", message: "Velg en kategori før du bestiller." });
          return false;
        }
        if (wantsLunch && day && !variantPickSatisfied(day, storedForPost)) {
          setErrorBanner({ code: "VARIANT_REQUIRED", message: "Velg variant før du bestiller." });
          return false;
        }
        const pick = parseStoredSelection(storedForPost ?? null);
        const itemKeyForOrder =
          wantsLunch && typeof pick?.itemKey === "string" && pick.itemKey.trim().length ? pick.itemKey.trim() : null;
        const body = buildOrderWriteBody(date, wantsLunch, choiceKey, itemKeyForOrder);
        const idemScope = `${date}:${wantsLunch ? "SET" : "CANCEL"}:${choiceKey ?? ""}:${itemKeyForOrder ?? ""}`;

        const res = await fetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-rid": rid,
            "Idempotency-Key": ensureIdemKey(idemScope),
          },
          cache: "no-store",
          body: JSON.stringify(body),
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
          if (apiError.code === "CHOICE_REQUIRED") {
            setErrorBanner({ code: apiError.code, message: "Velg en kategori før du bestiller." });
            return false;
          }
          if (apiError.code === "INVALID_CHOICE") {
            setErrorBanner({ code: apiError.code, message: "Valget er ikke tillatt for denne avtalen." });
            return false;
          }
          if (apiError.code === "ITEM_CHOICE_REQUIRED" || apiError.code === "INVALID_ITEM_CHOICE") {
            setErrorBanner({ code: apiError.code, message: apiError.message || "Velg variant før du bestiller." });
            return false;
          }
          if (apiError.code === "NO_TIER_FOR_DAY") {
            setErrorBanner({ code: apiError.code, message: "Denne dagen er ikke tilgjengelig" });
            return false;
          }
          if (apiError.code === "INVALID_DAY") {
            setErrorBanner({ code: apiError.code, message: "Ugyldig dato" });
            return false;
          }
          handleOrderError(res.status, json, setErrorBanner);
          return false;
        }
        resetIdemKey();
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
          collapseOrderedPicker(date);
        }
        safeVibrate(12);
        showSuccessToast(wantsLunch ? "Bestilling registrert ✔" : "Avbestilling registrert ✔");
        return true;
      } catch {
        showErrorBanner("");
        return false;
      }
    },
    [
      collapseOrderedPicker,
      days,
      ensureIdemKey,
      loadWindow,
      readOnlyPreview,
      resetIdemKey,
      selectedChoices,
      showErrorBanner,
      showSuccessToast,
    ],
  );

  const applyActiveOrderChange = useCallback(
    async (date: string, selection: DayChoiceSelection) => {
      const day = days.find((d) => d.date === date);
      if (!day || day.orderStatus !== "ACTIVE" || readOnlyPreview) return;
      if (!canOrderDay(day, true, Boolean(busyDate))) return;
      const orderedKey = day.selectedChoiceKey ? String(day.selectedChoiceKey).trim().toLowerCase() : "";
      if (orderedKey && orderedKey === selection.categoryKey.trim().toLowerCase()) {
        const sameItem =
          !selection.itemKey ||
          (day.selectedItemKey &&
            String(day.selectedItemKey).trim().toLowerCase() === selection.itemKey.trim().toLowerCase());
        if (sameItem) return;
      }
      if (!variantPickSatisfied(day, selection)) return;
      await guardedAction(date, async () => {
        setBusyDate(date);
        try {
          await postSetDayInner(date, true, selection);
        } finally {
          setBusyDate(null);
        }
      });
    },
    [busyDate, days, guardedAction, postSetDayInner, readOnlyPreview],
  );

  const selectCategory = useCallback(
    (date: string, choiceKey: string) => {
      const day = days.find((d) => d.date === date);
      const cat = day?.categories.find((c) => c.key.toLowerCase() === choiceKey.toLowerCase());
      const singleDefault = singleCategoryItemDefault(cat);
      const nextSelection: DayChoiceSelection = singleDefault ?? {
        categoryKey: choiceKey,
        itemKey: null,
        itemTitle: null,
      };

      setSelectedChoices((prev) => {
        if (!day) {
          return { ...prev, [date]: nextSelection };
        }
        const currentEff = effectiveSelectedChoice(day, prev[date]);
        if (currentEff && currentEff.toLowerCase() === choiceKey.toLowerCase()) {
          if (day.orderStatus === "ACTIVE") return prev;
          return { ...prev, [date]: null };
        }
        return { ...prev, [date]: nextSelection };
      });

      if (day?.orderStatus === "ACTIVE") {
        void applyActiveOrderChange(date, nextSelection);
      }
    },
    [applyActiveOrderChange, days],
  );

  const selectItemForDay = useCallback(
    (date: string, categoryKey: string, itemKey: string, itemTitle: string) => {
      const selection: DayChoiceSelection = { categoryKey, itemKey, itemTitle };
      setSelectedChoices((prev) => ({
        ...prev,
        [date]: selection,
      }));
      const day = days.find((d) => d.date === date);
      if (day?.orderStatus === "ACTIVE") {
        void applyActiveOrderChange(date, selection);
      }
    },
    [applyActiveOrderChange, days],
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
    const day = days.find((d) => d.date === date);
    if (isDayCutoffClosed(day)) return;
    if (day && choiceRequired(day) && !effectiveSelectedChoice(day, selectedChoices[date])) {
      setErrorBanner({ code: "CHOICE_REQUIRED", message: "Velg en kategori før du bestiller." });
      return;
    }
    if (day && !variantPickSatisfied(day, selectedChoices[date])) {
      setErrorBanner({ code: "VARIANT_REQUIRED", message: "Velg variant før du bestiller." });
      return;
    }
    setErrorBanner(null);
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    setConfirm({ date, action: "order" });
  }, [days, readOnlyPreview, selectedChoices]);

  const requestCancel = useCallback((date: string) => {
    if (readOnlyPreview) return;
    const day = days.find((d) => d.date === date);
    if (isDayCutoffClosed(day)) return;
    setErrorBanner(null);
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    setConfirm({ date, action: "cancel" });
  }, [days, readOnlyPreview]);

  const blocked = !readOnlyPreview && (!canAct || !weekOrderingAllowed);
  const globalBusy = busyDate !== null;

  const selectedDay = selectedDate ? days.find((d) => d.date === selectedDate) : undefined;

  if (loading) {
    return (
      <div className={`mx-auto w-full max-w-lg px-4 py-6 md:max-w-2xl`}>
        <WeekLoadingSkeleton mobileLayout={isMobile} />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-10 text-left">
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
      <div className="mx-auto w-full max-w-lg px-4 py-10 text-left">
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
      <div className="mx-auto w-full max-w-lg px-4 py-10 text-left">
        <div className="rounded-2xl bg-neutral-100 px-4 py-4 text-sm text-neutral-800 ring-1 ring-black/10">
          <p className="font-semibold">Ingen synlige dager akkurat nå</p>
          <p className="mt-2 text-neutral-600">
            Uken kunne ikke vises som forventet. Dette er ikke det samme som «ingen meny publisert» — prøv å hente på nytt.
          </p>
          <button
            type="button"
            onClick={() => void loadWindow()}
            className={`mt-4 inline-flex min-h-touch items-center justify-center rounded-full border border-neutral-300 bg-white px-5 text-sm font-semibold text-neutral-900 ${BTN_TOUCH}`}
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
  const upcomingDays = activeDay
    ? sortedDays.filter(
        (d) => isCalendarUpcoming(d, serverOsloDate) && d.date !== activeDay.date,
      )
    : sortedDays.filter((d) => isCalendarUpcoming(d, serverOsloDate));

  return (
    <div
      className={`mx-auto w-full px-4 py-6 motion-safe:transition-opacity motion-safe:duration-300 ${
        readOnlyPreview
          ? "max-w-week-mobile rounded-lg bg-bg shadow-soft ring-1 ring-black/5"
          : `min-h-dvh max-w-lg bg-bg md:max-w-2xl`
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

      {/* Kanonisk /week-header. Logo er allerede i global nav-header
          (HeaderShell). Selskaps-navn er dynamisk fra /api/order/window.
          Per-dag-status ("Fristen for dagens endring er passert") forblir
          ved valgt-dag-kortet. FASE 10B.1. */}
      <header className="mb-6 text-left">
        {readOnlyPreview ? (
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-800">Ansattflate</p>
        ) : null}
        <h1 className={`text-3xl font-semibold tracking-[-0.035em] text-neutral-950 md:text-5xl${readOnlyPreview ? " mt-2" : ""}`}>
          Bestill eller avbestill lunsj
        </h1>
        {companyName ? (
          <p className="mt-3 max-w-md text-base leading-7 text-neutral-600">
            {companyName} · Endringsfrist kl. 08:00
          </p>
        ) : (
          <p className="mt-3 max-w-md text-base leading-7 text-neutral-600">
            Endringsfrist kl. 08:00
          </p>
        )}
      </header>

      {!readOnlyPreview ? <WeekAllergenProfileCard /> : null}

      <div className="mb-5 space-y-2" aria-live="polite">
        {menuSanityFetchFailed ? (
          <div
            className="rounded-2xl bg-amber-50 px-3 py-2 text-left text-sm text-amber-950 ring-1 ring-amber-200"
            role="status"
          >
            Menytekst kunne ikke lastes akkurat nå. Ordrestatus og bestilling/avbestilling vises som vanlig.
          </div>
        ) : null}
        {!readOnlyPreview && patterns.streakCount >= 2 ? (
          <p className="text-left text-xs font-medium text-neutral-700">{patterns.streakCount} uker på rad</p>
        ) : null}
        {!readOnlyPreview && showHabitNudge ? (
          <p className="text-left text-xs text-neutral-500">Du pleier å bestille denne dagen</p>
        ) : null}
        {!readOnlyPreview && demandHintLine ? <p className="text-left text-xs text-neutral-500">{demandHintLine}</p> : null}
        {!readOnlyPreview && todayCutoffStatus === "TODAY_OPEN" && orderingUrgencyHint ? (
          <p className="text-left text-xs font-medium text-amber-900/90">Bestill før kl. 08:00</p>
        ) : !readOnlyPreview && todayCutoffStatus === "TODAY_LOCKED" ? (
          <p className="text-left text-xs font-medium text-neutral-600">Fristen for dagens endring er passert.</p>
        ) : null}
        {errorBanner ? (
          <div className="inline-flex w-full items-start gap-2 rounded-2xl bg-rose-50 px-3 py-2 text-left text-sm text-rose-900 ring-1 ring-rose-200">
            {errorBanner.code === "CUTOFF_PASSED" ? <ClockIcon className="h-4 w-4 shrink-0" aria-hidden /> : null}
            <span>{errorBanner.message}</span>
          </div>
        ) : null}
      </div>

      <nav className="mb-5 grid grid-cols-5 gap-2" aria-label="Velg dag">
        {/* Hver dag plasseres i fast ukedagskolonne (Man-Fre), mens uke-start
            styrer rad. Tomme celler for passerte dager rendres ikke; CSS Grid
            lar hullene stå slik at denne uke og neste uke leses som egne
            rader. Inline grid-placement er dynamisk basert på dato.
            FASE 10A.4. */}
        {sortedDays.map((day, index) => {
          const active = activeDay?.date === day.date;
          const isToday = Boolean(serverOsloDate && day.date === serverOsloDate);
          const lifecycle = weekDayLifecycleState(day);
          const weekday = (formatWeekdayNO(day.date) || day.weekday).slice(0, 3);
          return (
            <button
              key={day.date}
              type="button"
              data-lp-date={day.date}
              data-lp-lifecycle={lifecycle}
              aria-current={isToday ? "date" : undefined}
              style={selectorGridPosition(day, selectorWeekRows, index)}
              onClick={() => selectDayFromTap(day.date)}
              className={weekCalendarDayPillClassNames(active, isToday, lifecycle)}
              aria-pressed={active}
            >
              <span className="ds-week-calendar-day-pill__weekday">{weekday}</span>
              <span className="ds-week-calendar-day-pill__daynum">{formatDateNO(day.date).split(".")[0]}</span>
              {lifecycle === "ordered" ? (
                <span
                  className="ds-week-calendar-day-pill__state-mark ds-week-calendar-day-pill__state-mark--ordered"
                  aria-hidden="true"
                >
                  <DsWeekIcon variant="check" />
                </span>
              ) : null}
              {lifecycle === "locked" ? (
                <>
                  <span
                    className="ds-week-calendar-day-pill__state-mark ds-week-calendar-day-pill__state-mark--locked"
                    aria-hidden="true"
                  >
                    <DsWeekIcon variant="clock" />
                  </span>
                  <span className="sr-only">Frist passert</span>
                </>
              ) : null}
              {lifecycle === "unavailable" ? (
                <>
                  <span
                    className="ds-week-calendar-day-pill__state-mark ds-week-calendar-day-pill__state-mark--unavailable"
                    aria-hidden="true"
                  >
                    <DsWeekIcon variant="minus" />
                  </span>
                  <span className="sr-only">Ikke tilgjengelig</span>
                </>
              ) : null}
            </button>
          );
        })}
        {/* Placeholder-celler for dager som ikke er bestillbare
            (passerte eller utenfor synlig vindu). Dempet styling,
            ikke klikkbar. Gir visuell ukestruktur slik at hver rad
            leses som én komplett uke (Man-Fre). FASE 10A.6. */}
        {placeholderCells.map((cell) => {
          const gridColumnStart = WEEKDAY_GRID_COLUMN[cell.weekdayKey];
          const gridRowStart = selectorWeekRows.indexOf(cell.weekStart) + 1;
          if (!gridColumnStart || gridRowStart < 1) return null;
          const weekdayShort = (formatWeekdayNO(cell.date) || cell.weekdayKey).slice(0, 3);
          const dayNumber = parseInt(cell.date.slice(8, 10), 10);
          return (
            <div
              key={`placeholder-${cell.date}`}
              aria-hidden="true"
              style={{ gridColumnStart, gridRowStart }}
              className="min-h-calendar-pill min-w-0 rounded-2xl bg-neutral-50/60 px-2 py-3 text-center select-none"
            >
              <div className="text-xs uppercase tracking-wide text-neutral-400">
                {weekdayShort}
              </div>
              <div className="text-base font-medium text-neutral-400">
                {dayNumber}
              </div>
            </div>
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
            storedChoice={selectedChoices[activeDay.date]}
            isSelected
            onSelectDay={() => selectDayFromTap(activeDay.date)}
            onRequestOrder={() => requestOrder(activeDay.date)}
            onRequestCancel={() => requestCancel(activeDay.date)}
            onSelectCategory={(choiceKey) => selectCategory(activeDay.date, choiceKey)}
            onSelectItem={(categoryKey, itemKey, itemTitle) => selectItemForDay(activeDay.date, categoryKey, itemKey, itemTitle)}
            insightRecommended={Boolean(!readOnlyPreview && recommendedDate && activeDay.date === recommendedDate && preferredWeekday)}
            insightPreferredMotion={false}
            readOnlyPreview={readOnlyPreview}
            orderedPickerExpanded={Boolean(orderedPickerExpanded[activeDay.date])}
            onToggleOrderedPicker={() => toggleOrderedPicker(activeDay.date)}
          />
        </section>
      ) : null}

      {upcomingDays.length > 0 ? (
        <section className="pb-2">
          <h2 className="mb-3 text-left text-lg font-bold tracking-[-0.02em] text-neutral-950">Kommende dager</h2>
          <div className={`space-y-2 ${globalBusy ? "pointer-events-none opacity-[0.92]" : ""}`} aria-label="Kommende dager">
            {upcomingDays.map((day) => {
              const { label: statusLabel, className: statusClass } = statusPresentation(day);
              return (
                <button
                  key={day.date}
                  type="button"
                  data-date={day.date}
                  data-day-slide=""
                  onClick={() => selectDayFromTap(day.date)}
                  className="ds-week-surface ds-week-surface--row flex min-h-day w-full items-center justify-between gap-3 bg-white/75 text-left text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold capitalize text-neutral-950">
                      {formatMenuDateNO(day.date)}
                    </span>
                    <span className="mt-1 inline-flex">
                      <TierPill tier={day.tier} />
                    </span>
                  </span>
                  <span className={`${statusClass} shrink-0`}>{statusLabel}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

    </div>
  );
}
