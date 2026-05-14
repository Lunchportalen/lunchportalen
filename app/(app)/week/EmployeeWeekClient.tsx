"use client";

import { ClockIcon, Loader2 } from "lucide-react";
import Link from "next/link";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

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
import { ALLERGEN_DISPLAY_LABELS, displayAllergens } from "@/lib/cms/menuDayContract";

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
  "bg-gradient-to-r from-[#f5c518] to-[#ffd43b] text-neutral-950 shadow-[0_16px_40px_rgba(245,197,24,0.32)]";
const SECONDARY_CTA = "border border-black/10 bg-white text-neutral-900 shadow-[0_10px_26px_rgba(24,20,16,0.06)]";
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
    <div className="rounded-2xl bg-[#faf7ef] px-4 py-4 text-center ring-1 ring-black/5">
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
  return (tier === "BASIS" ? BASIS_CATEGORY_LABELS : LUXUS_CATEGORY_LABELS).map((label) => ({
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

function ReadOnlyPreviewHint({ className = "" }: { className?: string }) {
  return <p className={`mt-1 text-xs font-medium text-neutral-500 ${className}`}>Kun forhåndsvisning</p>;
}

function selectedChoiceLabel(day: DayRow) {
  if (!day.selectedChoiceKey) return null;
  const selected = day.allowedChoices.find((c) => c.key.toLowerCase() === day.selectedChoiceKey?.toLowerCase());
  return selected?.label ?? day.selectedChoiceKey;
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
  const p = parseStoredSelection(stored ?? null);
  if (!p) return "";
  return `${p.categoryKey}\u001f${p.itemKey ?? ""}\u001f${p.itemTitle ?? ""}`;
}

function categoriesItemsSignature(cats: DayCategory[]): string {
  return cats.map((c) => `${c.key}:${c.items.length}`).join("|");
}

function variantPickRequired(cat: DayCategory | undefined): boolean {
  return Boolean(cat?.items?.length && cat!.items!.length >= 2);
}

function tierChipMatchesSummary(summary: string | null, choiceLabel: string): boolean {
  if (!summary || !choiceLabel) return false;
  const s = summary.toLowerCase();
  const c = choiceLabel.toLowerCase();
  return s === c || s.startsWith(`${c} ·`);
}

function effectiveSelectedChoice(day: DayRow, stored: WeekChoiceStored): string | null {
  const parsed = parseStoredSelection(stored ?? null);
  const explicit = String(parsed?.categoryKey ?? "").trim();
  if (explicit) return explicit;
  const available = day.categories.filter((c) => c.available);
  return available.length === 1 ? available[0]!.key : null;
}

function choiceRequired(day: DayRow) {
  return day.categories.filter((c) => c.available).length > 1;
}

function variantPickSatisfied(day: DayRow, stored: WeekChoiceStored): boolean {
  const ck = effectiveSelectedChoice(day, stored);
  if (!ck) return true;
  const cat = day.categories.find((c) => c.key.toLowerCase() === ck.toLowerCase());
  if (!variantPickRequired(cat)) return true;
  return Boolean(parseStoredSelection(stored)?.itemKey?.trim());
}

function normalizeSelectionForDay(day: DayRow, prevRaw: WeekChoiceStored): WeekChoiceStored | null {
  const parsed = parseStoredSelection(prevRaw ?? null);
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
  const p = parseStoredSelection(stored ?? null);
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
  const selectedKey = effectiveSelectedChoice(day, storedChoice);
  const selectedCat = selectedKey
    ? day.categories.find((c) => c.key.toLowerCase() === selectedKey.toLowerCase())
    : undefined;
  const showExpandedPanel = Boolean(selectedCat && selectedCat.available && day.isEnabled && !disabled);

  const itemCount = selectedCat?.items?.length ?? 0;
  const hasCategoryHeadline =
    !!(selectedCat && (String(selectedCat.title ?? "").trim() !== "" || String(selectedCat.description ?? "").trim() !== ""));
  const isSelectableItems = selectedCat !== undefined && (itemCount >= 2 || itemCount === 1);
  const parsed = parseStoredSelection(storedChoice ?? null);
  const selectedItemKey = parsed?.itemKey ?? null;

  /** Rett opp presedens — én menylinje må være tittel eller beskrivelse, ikke falsk «info» ved undefined. */
  const showInfoCard =
    !!selectedCat && itemCount === 0 && (String(selectedCat.title ?? "").trim() !== "" || String(selectedCat.description ?? "").trim() !== "");
  const showEmptyMenuPlaceholder = !!selectedCat && itemCount === 0 && !hasCategoryHeadline;

  let sectionHeading = "";
  if (selectedCat) {
    sectionHeading =
      itemCount >= 2 || itemCount === 1
        ? `Velg variant for ${selectedCat.label}`
        : `Detaljer for ${selectedCat.label}`;
  }

  const titleDomId = selectedCat ? `week-items-title-${selectedCat.key}` : "week-items-title";

  return (
    <>
      <div className="week-day__categories" aria-label="Velg kategori">
        {day.categories.map((cat) => {
          const isSelected = Boolean(selectedKey && selectedKey.toLowerCase() === cat.key.toLowerCase());
          return (
            <button
              key={cat.key}
              type="button"
              className={`week-category-card ${isSelected ? "is-selected" : ""}`}
              onClick={() => onSelectCategory(cat.key)}
              disabled={disabled || !cat.available || !day.isEnabled}
              aria-pressed={isSelected}
              title={!cat.available ? "Ikke tilgjengelig" : undefined}
            >
              <span className="week-category-card__label">{cat.label}</span>
              {!cat.available ? <span className="week-category-card__empty">Ikke tilgjengelig</span> : null}
            </button>
          );
        })}
      </div>
      {showExpandedPanel && selectedCat ? (
        <div
          className={`ds-week-items-section${isSelectableItems ? "" : " ds-week-items-section--details"}`}
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
                    disabled={disabled || !day.isEnabled || !selectedCat.available}
                    onClick={() => onSelectItem(selectedCat.key, it.key, it.title)}
                    className={`ds-week-item-btn${it.isVegetarian ? " ds-week-item-btn--vegetarian" : ""}${isItemSelected ? " ds-week-item-btn--selected" : ""}`}
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
      ) : null}
    </>
  );
}

function DayMenuSummary({
  day,
  storedChoice,
  compact = false,
}: {
  day: DayRow;
  storedChoice?: WeekChoiceStored;
  compact?: boolean;
}) {
  if (isNoTierForDay(day)) {
    return (
      <div className={compact ? "mt-3" : "mt-4"}>
        <NoTierForDayNotice />
      </div>
    );
  }
  const choices = getTierCategories(day);
  const chipSummary = selectedChoiceSummaryLabel(day, storedChoice ?? null);
  const highlightLine = choiceHighlightLine(day, storedChoice ?? null);

  return (
    <div className={`${compact ? "mt-3" : "mt-4"} text-center md:text-center`}>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <TierPill tier={day.tier} />
        {highlightLine.mode === "valgt_body" ? (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-950 ring-1 ring-emerald-200">
            Valgt: {highlightLine.body}
          </span>
        ) : highlightLine.mode === "variant_pending" ? (
          <span className="inline-flex min-h-[32px] items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-neutral-950 ring-1 ring-amber-200/80">
            Velg variant for {highlightLine.categoryLabel}
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
                tierChipMatchesSummary(chipSummary, choice)
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
  storedChoice: WeekChoiceStored;
  weekdayLabel: string;
  statusLabel: ReturnType<typeof statusLabelForDay>;
  onRequestOrder: () => void;
  onRequestCancel: () => void;
  onSelectCategory: (choiceKey: string) => void;
  onSelectItem: (categoryKey: string, itemKey: string, itemTitle: string) => void;
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
  storedChoice,
  statusLabel,
  onRequestOrder,
  onRequestCancel,
  onSelectCategory,
  onSelectItem,
  insightRecommended,
  insightPreferredMotion,
  readOnlyPreview,
}: RowBase) {
  const ordered = day.orderStatus === "ACTIVE";
  const cutoffClosed = day.isLocked && day.lockReason === "CUTOFF";
  const companyClosed = day.isLocked && day.lockReason === "COMPANY";
  const notInAgreement = !day.isEnabled;
  const noTierForDay = isNoTierForDay(day);
  const canClick = canOrderDay(day, canAct, globalBusy);
  const canOrderClick = canOrderWithChoice(day, canAct, globalBusy, storedChoice);
  const primaryTitle = primaryOrderButtonTitle(day, storedChoice, readOnlyPreview);

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
          <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
            <div className="text-base font-semibold capitalize text-neutral-900">
              {formatMenuDateNO(day.date)}
            </div>
            <TierPill tier={day.tier} />
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
        <p className="text-sm font-semibold text-neutral-900">{noTierForDay ? "Ikke tilgjengelig" : day.menuTitle ?? "Menyen er ikke publisert ennå."}</p>
        {day.menuDescription ? (
          <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{day.menuDescription}</p>
        ) : null}
        {day.allergens.length > 0 ? (
          <p className="mt-2 text-xs text-neutral-600">
            <span className="font-semibold">Allergener: </span>
            {day.allergens.join(", ")}
          </p>
        ) : null}
        {noTierForDay ? null : (
          <WeekCategoryCards
            day={day}
            storedChoice={storedChoice}
            onSelectCategory={onSelectCategory}
            onSelectItem={onSelectItem}
            disabled={readOnlyPreview || globalBusy}
          />
        )}
        <DayMenuSummary day={day} storedChoice={storedChoice} />
      </div>

      <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center md:justify-start">
        {noTierForDay ? (
          <span className="text-center text-sm text-neutral-500">Denne dagen er ikke tilgjengelig for bestilling. Kontakt firmaadmin.</span>
        ) : notInAgreement ? (
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
              disabled={readOnlyPreview || !canOrderClick}
              aria-disabled={readOnlyPreview || !canOrderClick}
              title={primaryTitle}
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
    storedChoice,
    statusLabel,
    isSelected,
    onSelectDay,
    onRequestOrder,
    onRequestCancel,
    onSelectCategory,
    onSelectItem,
    insightRecommended,
    insightPreferredMotion,
    readOnlyPreview,
  }: MobileCardProps) {
    const ordered = day.orderStatus === "ACTIVE";
    const cutoffClosed = day.isLocked && day.lockReason === "CUTOFF";
    const companyClosed = day.isLocked && day.lockReason === "COMPANY";
    const notInAgreement = !day.isEnabled;
    const noTierForDay = isNoTierForDay(day);
    const canClick = canOrderDay(day, canAct, globalBusy);
    const canOrderClick = canOrderWithChoice(day, canAct, globalBusy, storedChoice);
    const categories = getTierCategories(day);
    const highlightLine = choiceHighlightLine(day, storedChoice ?? null);
    const mobileChoiceLine =
      highlightLine.mode === "variant_pending"
        ? `Velg variant for ${highlightLine.categoryLabel}`
        : highlightLine.mode === "valgt_body"
          ? `Valgt: ${highlightLine.body}`
          : undefined;
    const displayStatus = orderStatusLabel(day);
    const primaryTitle = primaryOrderButtonTitle(day, storedChoice, readOnlyPreview);

    return (
      <div
        role="group"
        aria-label={formatMenuDateNO(day.date)}
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
            <TierPill tier={day.tier} />
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
            {mobileChoiceLine ? (
              <p className="mt-1 text-sm font-medium text-neutral-600">{mobileChoiceLine}</p>
            ) : null}
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
            {noTierForDay ? (
              <NoTierForDayNotice />
            ) : day.categories.length ? (
              <WeekCategoryCards
                day={day}
                storedChoice={storedChoice}
                onSelectCategory={onSelectCategory}
                onSelectItem={onSelectItem}
                disabled={readOnlyPreview || globalBusy}
              />
            ) : categories.length ? (
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
          {noTierForDay ? (
            <span className="text-center text-sm text-neutral-500">Denne dagen er ikke tilgjengelig for bestilling. Kontakt firmaadmin.</span>
          ) : notInAgreement ? (
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
                disabled={readOnlyPreview || !canOrderClick}
                aria-disabled={readOnlyPreview || !canOrderClick}
        title={primaryTitle}
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
    categoriesItemsSignature(prev.day.categories) === categoriesItemsSignature(next.day.categories) &&
    choiceComparable(prev.storedChoice) === choiceComparable(next.storedChoice) &&
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
  storedChoice: WeekChoiceStored,
  onRequestOrder: () => void,
  onRequestCancel: () => void,
  readOnlyPreview?: boolean,
) {
  const ordered = day.orderStatus === "ACTIVE";
  const cutoffClosed = day.isLocked && day.lockReason === "CUTOFF";
  const companyClosed = day.isLocked && day.lockReason === "COMPANY";
  const notInAgreement = !day.isEnabled;
  const noTierForDay = isNoTierForDay(day);
  const canClick = canOrderDay(day, canAct, globalBusy);
  const canOrderClick = canOrderWithChoice(day, canAct, globalBusy, storedChoice);
  const primaryTitle = primaryOrderButtonTitle(day, storedChoice, readOnlyPreview);

  if (noTierForDay) {
    return <p className="text-center text-sm text-neutral-500">Denne dagen er ikke tilgjengelig for bestilling. Kontakt firmaadmin.</p>;
  }
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
                disabled={readOnlyPreview || !canOrderClick}
                aria-disabled={readOnlyPreview || !canOrderClick}
                title={primaryTitle}
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
  const [selectedChoices, setSelectedChoices] = useState<Record<string, WeekChoiceStored | null>>({});
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
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const navSourceRef = useRef<"init" | "tap" | "io">("init");
  const selectedDateRef = useRef<string | null>(null);
  const ioRef = useRef<IntersectionObserver | null>(null);
  const lastScrollYRef = useRef(0);
  /** Under programmatisk scroll (init/tap): ikke la IO overskrive valgt dag midlertidig. */
  const suppressIoUntilRef = useRef(0);

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
    setSelectedChoices({});
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
          const serverHydrated =
            day.orderStatus === "ACTIVE" && day.selectedChoiceKey
              ? {
                  categoryKey: String(day.selectedChoiceKey).trim(),
                  itemKey: day.selectedItemKey ? String(day.selectedItemKey).trim() : null,
                  itemTitle: day.selectedItemTitleSnapshot ? String(day.selectedItemTitleSnapshot).trim() : null,
                }
              : null;
          const serverCat = day.selectedChoiceKey ? String(day.selectedChoiceKey).trim() : "";
          const rawFallback = serverHydrated ?? prevChoice ?? (serverCat ? { categoryKey: serverCat, itemKey: null, itemTitle: null } : null);
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

  const selectDayFromTap = useCallback((date: string) => {
    navSourceRef.current = "tap";
    safeVibrate(10);
    setSelectedDate(date);
  }, []);

  const selectCategory = useCallback((date: string, choiceKey: string) => {
    setSelectedChoices((prev) => ({
      ...prev,
      [date]: { categoryKey: choiceKey, itemKey: null, itemTitle: null },
    }));
  }, []);

  const selectItemForDay = useCallback((date: string, categoryKey: string, itemKey: string, itemTitle: string) => {
    setSelectedChoices((prev) => ({
      ...prev,
      [date]: { categoryKey, itemKey, itemTitle },
    }));
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
        const day = days.find((d) => d.date === date);
        const choiceKey = day ? effectiveSelectedChoice(day, selectedChoices[date]) : null;
        if (wantsLunch && day && choiceRequired(day) && !effectiveSelectedChoice(day, selectedChoices[date])) {
          setErrorBanner({ code: "CHOICE_REQUIRED", message: "Velg en kategori før du bestiller." });
          return false;
        }
        if (wantsLunch && day && !variantPickSatisfied(day, selectedChoices[date])) {
          setErrorBanner({ code: "VARIANT_REQUIRED", message: "Velg variant før du bestiller." });
          return false;
        }
        const pick = parseStoredSelection(selectedChoices[date] ?? null);
        const itemKeyForOrder =
          wantsLunch && typeof pick?.itemKey === "string" && pick.itemKey.trim().length ? pick.itemKey.trim() : null;
        const body = buildOrderWriteBody(date, wantsLunch, choiceKey, itemKeyForOrder);

        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-rid": rid },
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
    [days, loadWindow, readOnlyPreview, selectedChoices, showErrorBanner, showSuccessToast],
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

      {/* Kanonisk /week-header. Logo er allerede i global nav-header
          (HeaderShell). Selskaps-navn er dynamisk fra /api/order/window.
          Per-dag-status ("Fristen for dagens endring er passert") forblir
          ved valgt-dag-kortet. FASE 10B.1. */}
      <header className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-800">
          Ansattflate
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-neutral-950 md:text-5xl">
          Bestill eller avbestill lunsj
        </h1>
        {companyName ? (
          <p className="mx-auto mt-3 max-w-md text-base leading-7 text-neutral-600">
            {companyName} · Endringsfrist kl. 08:00
          </p>
        ) : (
          <p className="mx-auto mt-3 max-w-md text-base leading-7 text-neutral-600">
            Endringsfrist kl. 08:00
          </p>
        )}
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
        {/* Hver dag plasseres i fast ukedagskolonne (Man-Fre), mens uke-start
            styrer rad. Tomme celler for passerte dager rendres ikke; CSS Grid
            lar hullene stå slik at denne uke og neste uke leses som egne
            rader. Inline grid-placement er dynamisk basert på dato.
            FASE 10A.4. */}
        {sortedDays.map((day, index) => {
          const active = activeDay?.date === day.date;
          const weekday = (formatWeekdayNO(day.date) || day.weekday).slice(0, 3);
          return (
            <button
              key={day.date}
              type="button"
              style={selectorGridPosition(day, selectorWeekRows, index)}
              onClick={() => selectDayFromTap(day.date)}
              className={`min-h-[52px] min-w-0 rounded-2xl px-2 py-3 text-center ring-1 transition-transform active:scale-[0.98] ${
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
              className="min-h-[52px] min-w-0 rounded-2xl bg-neutral-50/60 px-2 py-3 text-center select-none"
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
            storedChoice={selectedChoices[activeDay.date] ?? null}
            weekdayLabel={formatWeekdayNO(activeDay.date) || activeDay.weekday}
            statusLabel={statusLabelForDay(activeDay)}
            isSelected
            onSelectDay={() => selectDayFromTap(activeDay.date)}
            onRequestOrder={() => requestOrder(activeDay.date)}
            onRequestCancel={() => requestCancel(activeDay.date)}
            onSelectCategory={(choiceKey) => selectCategory(activeDay.date, choiceKey)}
            onSelectItem={(categoryKey, itemKey, itemTitle) => selectItemForDay(activeDay.date, categoryKey, itemKey, itemTitle)}
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
                    {formatMenuDateNO(day.date)}
                  </span>
                  <span className="mt-1 inline-flex">
                    <TierPill tier={day.tier} />
                  </span>
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
          className={`ds-week-sticky-safe-bottom fixed bottom-0 left-0 right-0 z-40 border-t border-black/10 bg-white/95 px-4 pt-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm motion-safe:transition-[transform,opacity] motion-safe:duration-200 motion-safe:ease-out ${
            stickyBarHidden ? "pointer-events-none translate-y-full opacity-0" : "translate-y-0 opacity-100"
          }`}
        >
          <div className="mx-auto max-w-lg">
            <p className="mb-2 text-center text-xs font-medium text-neutral-600">{selectedDayLabel(selectedDay)}</p>
            {stickyCtaForDay(
              selectedDay,
              canAct,
              globalBusy,
              busyDate === selectedDay.date,
              selectedChoices[selectedDay.date] ?? null,
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
