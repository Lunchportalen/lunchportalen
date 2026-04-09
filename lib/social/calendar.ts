/**
 * 3-ukers rullerende innholdskalender (21 dager × 1 slot, maks 2 poster/dag ved utvidelse).
 * Ren logikk — persistens håndteres i UI.
 */

import type { Industry } from "@/lib/ai/industry";
import { detectIndustry } from "@/lib/ai/industry";
import type { Role } from "@/lib/ai/role";
import { detectRole } from "@/lib/ai/role";
import type { SocialProductRef } from "@/lib/ai/socialStrategy";
import type { B2bArchetype, B2bCtaLine, B2bValuePillar } from "@/lib/social/b2bLeadMessaging";
import { contentHashForCalendar, generateCalendarSlotContent } from "@/lib/social/calendarContent";
import type { CalendarInsights } from "@/lib/social/calendarLearning";
import { leadSourceIdFromPostId } from "@/lib/social/leadSource";
import type { Location } from "@/lib/social/location";
import { growthEconomicsRankMap } from "@/lib/social/productEconomicsGrowth";

export type CalendarPostStatus = "planned" | "ready" | "published" | "cancelled";

export type CalendarPostPerformance = {
  likes?: number;
  clicks: number;
  /** Lead / demo-signal (samme konverteringstrakt, sporbart separat) */
  leads?: number;
  demoBookings?: number;
  conversions: number;
  revenue: number;
  /** Klikk attribuert til CMS-bilde (superadmin / vekstmotor) */
  imageClicks?: number;
  /** Konverteringer attribuert til CMS-bilde */
  imageConversions?: number;
  /** Video: visninger (superadmin / attributt) */
  videoViews?: number;
  /** Video: beholdt hook-vindu (~3 sek) */
  videoHookRetained?: number;
  /** Video: konverteringer sporbart mot video (valgfritt, additivt) */
  videoAttributedConversions?: number;
  /** Video: fullførte avspillinger (superadmin / attributt) */
  videoCompletions?: number;
  /** Eksplisitt hook-retention % (0–100); ellers avledes fra videoHookRetained/videoViews */
  hookRetentionRatePct?: number;
  /** Eksplisitt drop-off % (0–100); ellers avledes */
  videoDropOffRatePct?: number;
  /** Eksplisitt fullføringsrate % (0–100); ellers avledes fra videoCompletions/videoViews */
  videoCompletionRatePct?: number;
};

/** Siste demo knyttet til innlegget (klient-lag / utvidelse til DB). */
export type DemoBookingRecord = {
  leadSourceId: string;
  companySize?: string;
  industry?: string;
  /** Valgfritt lead-løpenummer før CRM */
  leadId?: string;
  /** Målrolle på innlegget da demo ble booket */
  targetRole?: Role;
  bookedAt: number;
};

/** Bilde fra `media_items` (ingen duplikat av CMS-modellen). */
export type SocialMediaAttachment = {
  itemId: string | null;
  imageUrl: string | null;
  alt?: string;
  source?: string;
};

export type CalendarPost = {
  id: string;
  productId: string;
  /** YYYY-MM-DD (lokal dag for slot) */
  slotDay: string;
  scheduledAt: number;
  status: CalendarPostStatus;
  contentHash?: string;
  hook?: string;
  caption?: string;
  hashtags?: string[];
  /** Sporbar lead-kilde for ?src= (f.eks. post_cal_…) */
  leadSourceId?: string;
  b2bArchetype?: B2bArchetype;
  b2bValuePillar?: B2bValuePillar;
  b2bCta?: B2bCtaLine;
  /** Segment fra produkttekst / eksplisitt valg — alltid en av Industry (fallback office). */
  industry?: Industry;
  /** Målrolle for budskap / lead-segment (fallback office). */
  targetRole?: Role;
  lastDemoBooked?: DemoBookingRecord;
  /** CMS-bundet mål-by */
  location?: Location;
  /** Klikk registrert, ingen konvertering — kandidat for retargeting */
  retargeting?: boolean;
  performance?: CalendarPostPerformance;
  /** CMS media library (valgfritt) — fylles server-side (mediaAdapter). */
  socialMedia?: SocialMediaAttachment;
  /** Autonomi: prioritert i UI / planlegger (valgfritt). */
  autonomyPriority?: boolean;
  /** Forsterkning: dempet av policy (reversibel). */
  reinforcementDeprioritized?: boolean;
  /** Sporingslenke (server redirect + events). */
  link?: string;
  /** A/B-variantgruppe (persistert på `social_posts.variant_group_id`). */
  variant_group_id?: string;
  publishedAt?: number;
  lastError?: string;
};

export const CALENDAR_DAYS = 21;
export const MAX_POSTS_PER_DAY = 2;
/** Minimum tid mellom to poster samme kalenderdag (sikkerhet mot spam). */
export const MIN_HOURS_BETWEEN_POSTS = 7;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function dayKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function startOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function noonLocalMsForDayKey(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return Date.now();
  return new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
}

/** 21 påfølgende dager fra i dag (lokal). */
export function rollingDayKeys(): string[] {
  const start = startOfTodayLocal();
  const keys: string[] = [];
  for (let i = 0; i < CALENDAR_DAYS; i++) {
    const x = new Date(start);
    x.setDate(x.getDate() + i);
    keys.push(dayKeyLocal(x));
  }
  return keys;
}

export function newCalendarId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `cal_${crypto.randomUUID()}`;
  }
  return `cal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function isQualityProduct(p: SocialProductRef): boolean {
  const name = String(p.name ?? "").trim();
  const url = String(p.url ?? "").trim();
  return name.length >= 2 && url.length >= 2 && url !== "#";
}

function aggregateRevenueByIndustry(posts: CalendarPost[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of posts) {
    if (p.status !== "published") continue;
    const ind = p.industry ?? "office";
    const r = p.performance?.revenue ?? 0;
    if (r <= 0) continue;
    m.set(ind, (m.get(ind) ?? 0) + r);
  }
  return m;
}

function aggregateRevenueByIndustryRoleCombo(posts: CalendarPost[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of posts) {
    if (p.status !== "published") continue;
    const r = p.performance?.revenue ?? 0;
    if (r <= 0) continue;
    const key = `${p.industry ?? "office"}_${p.targetRole ?? "office"}`;
    m.set(key, (m.get(key) ?? 0) + r);
  }
  return m;
}

function revenueLeaderRatio(m: Map<string, number>): { key: string | null; ratio: number } {
  if (m.size === 0) return { key: null, ratio: 1 };
  const sorted = [...m.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  if (!top) return { key: null, ratio: 1 };
  const second = sorted[1]?.[1] ?? 0;
  const ratio = second > 0 ? top[1] / second : top[1] > 0 ? 10 : 1;
  return { key: top[0], ratio };
}

/**
 * Når ledende bransje har ≥2,5× tilskrevet omsetning vs neste, boost produkter som matcher det segmentet.
 */
function productIndustryBoostMultiplier(product: SocialProductRef, posts: CalendarPost[]): number {
  const { key, ratio } = revenueLeaderRatio(aggregateRevenueByIndustry(posts));
  if (!key || ratio < 2.5) return 1;
  const detected = detectIndustry(`${product.name} ${product.url}`);
  return detected === key ? 1.75 : 1;
}

/** Når ledende bransje+rolle-kombo har ≥2,5× omsetning vs neste, boost matchende produkttekst. */
function productIndustryRoleComboBoostMultiplier(product: SocialProductRef, posts: CalendarPost[]): number {
  const { key, ratio } = revenueLeaderRatio(aggregateRevenueByIndustryRoleCombo(posts));
  if (!key || ratio < 2.5) return 1;
  const ctx = `${product.name} ${product.url}`;
  const combo = `${detectIndustry(ctx)}_${detectRole(ctx)}`;
  return combo === key ? 1.75 : 1;
}

/** Poeng for produktvalg — høyere er bedre. */
export function productScoreMap(
  insights: CalendarInsights | null,
  products: SocialProductRef[],
  postsForIndustryBoost?: CalendarPost[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of products) {
    m.set(p.id, 1);
  }
  if (insights) {
    let rank = insights.bestProducts.length;
    for (const id of insights.bestProducts) {
      m.set(id, (m.get(id) ?? 1) + rank * 10);
      rank -= 1;
    }
  }
  if (postsForIndustryBoost?.length) {
    for (const p of products) {
      const mult = productIndustryBoostMultiplier(p, postsForIndustryBoost);
      m.set(p.id, (m.get(p.id) ?? 1) * mult);
    }
  }
  return m;
}

export function countPostsOnDay(posts: CalendarPost[], day: string): number {
  return posts.filter((p) => p.slotDay === day && p.status !== "cancelled").length;
}

export function isDayAtPostCap(posts: CalendarPost[], day: string): boolean {
  return countPostsOnDay(posts, day) >= MAX_POSTS_PER_DAY;
}

const MIN_GAP_MS = MIN_HOURS_BETWEEN_POSTS * 60 * 60 * 1000;

/** True hvis nytt tidspunkt holder minst {@link MIN_HOURS_BETWEEN_POSTS} t avstand til andre poster samme dag. */
export function assertScheduleGapOk(
  posts: CalendarPost[],
  slotDay: string,
  scheduledAt: number,
  excludePostId?: string,
): boolean {
  for (const p of posts) {
    if (p.slotDay !== slotDay) continue;
    if (p.status === "cancelled") continue;
    if (excludePostId && p.id === excludePostId) continue;
    if (Math.abs(p.scheduledAt - scheduledAt) < MIN_GAP_MS) return false;
  }
  return true;
}

function recentProductIds(posts: CalendarPost[], excludeDay: string): Set<string> {
  const set = new Set<string>();
  for (const p of posts) {
    if (p.slotDay === excludeDay) continue;
    if (p.status === "cancelled") continue;
    set.add(p.productId);
  }
  return set;
}

function hasDuplicateContentHash(posts: CalendarPost[], hash: string, slotDay: string): boolean {
  return posts.some((p) => p.contentHash === hash && p.slotDay !== slotDay && p.status !== "cancelled");
}

/**
 * Velger beste produkt for en dag med hensyn til score, nabodager og duplikat-innhold.
 */
export function pickBestProduct(
  products: SocialProductRef[],
  existing: CalendarPost[],
  slotDay: string,
  insights: CalendarInsights | null,
  location: Location,
): SocialProductRef | null {
  const ok = products.filter(isQualityProduct);
  if (ok.length === 0) return null;
  const scores = productScoreMap(insights, ok, existing);
  const neighbors = recentProductIds(existing, slotDay);
  const econRank = growthEconomicsRankMap(ok, existing);
  const sorted = [...ok].sort((a, b) => {
    const sb = scores.get(b.id) ?? 0;
    const sa = scores.get(a.id) ?? 0;
    if (sb !== sa) return sb - sa;
    const ra = econRank.get(a.id) ?? 999;
    const rb = econRank.get(b.id) ?? 999;
    return ra - rb;
  });

  for (const p of sorted) {
    const content = generateCalendarSlotContent(p, slotDay, location);
    const h = contentHashForCalendar(content);
    if (hasDuplicateContentHash(existing, h, slotDay)) continue;
    if (neighbors.has(p.id) && sorted.length > 1) {
      const alt = sorted.find((x) => x.id !== p.id && !neighbors.has(x.id));
      if (alt) return alt;
    }
    return p;
  }
  return sorted[0] ?? null;
}

export function createCalendarPost(slotDay: string, product: SocialProductRef, location: Location): CalendarPost {
  const id = newCalendarId();
  const leadSourceId = leadSourceIdFromPostId(id);
  const content = generateCalendarSlotContent(product, slotDay, location, id);
  return {
    id,
    productId: product.id,
    slotDay,
    scheduledAt: noonLocalMsForDayKey(slotDay),
    status: "planned",
    contentHash: contentHashForCalendar(content),
    hook: content.hook,
    caption: content.caption,
    hashtags: content.hashtags,
    b2bArchetype: content.archetype,
    b2bValuePillar: content.valuePillar,
    b2bCta: content.cta,
    industry: content.industry,
    targetRole: content.targetRole,
    leadSourceId,
    location,
    retargeting: false,
    link: `/api/social/redirect?postId=${encodeURIComponent(id)}`,
  };
}

/**
 * Fyller tomme dager i vinduet: minst én aktiv post per dag blant de neste 21 (maks {@link MAX_POSTS_PER_DAY} per dag).
 */
export function fillCalendar(
  products: SocialProductRef[],
  existingPosts: CalendarPost[],
  insights: CalendarInsights | null,
  location: Location,
): CalendarPost[] {
  const keys = rollingDayKeys();
  const posts = [...existingPosts];

  for (const day of keys) {
    while (countPostsOnDay(posts, day) < 1) {
      const prod = pickBestProduct(products, posts, day, insights, location);
      if (!prod) break;
      posts.push(createCalendarPost(day, prod, location));
    }
  }

  return posts;
}

/**
 * Marker kansellert; neste `fillCalendar` kan erstatte slot.
 */
export function cancelCalendarPost(posts: CalendarPost[], postId: string): CalendarPost[] {
  return posts.map((p) => (p.id === postId ? { ...p, status: "cancelled" as const } : p));
}

export function updateCalendarSchedule(posts: CalendarPost[], postId: string, scheduledAt: number): CalendarPost[] {
  return posts.map((p) => (p.id === postId ? { ...p, scheduledAt, slotDay: dayKeyLocal(new Date(scheduledAt)) } : p));
}

/** Publisert status etter vellykket (eller simulert) utsending. */
export function markPostPublished(posts: CalendarPost[], postId: string, err?: string): CalendarPost[] {
  const now = Date.now();
  return posts.map((p) => {
    if (p.id !== postId) return p;
    if (err) return { ...p, lastError: err };
    return {
      ...p,
      status: "published" as const,
      publishedAt: now,
      performance: p.performance ?? {
        clicks: 0,
        conversions: 0,
        revenue: 0,
        leads: 0,
        demoBookings: 0,
      },
    };
  });
}

export function postsDueForPublish(posts: CalendarPost[], now: number): CalendarPost[] {
  return posts.filter((p) => p.status === "planned" && p.scheduledAt <= now);
}

/** Planlagte poster (kun `planned`) — brukes av scheduler før «klar»-promotering. */
export function getPlannedPostsForScheduler(posts: CalendarPost[]): CalendarPost[] {
  return posts.filter((p) => p.status === "planned");
}

export function isPostDue(post: CalendarPost, now: number): boolean {
  if (post.status === "cancelled" || post.status === "published") return false;
  return post.scheduledAt <= now;
}

/**
 * Forfalte `planned` → `ready` (ingen ekstern publisering; {@link fillCalendar} fortsetter å fylle vinduet).
 */
export function promoteDuePlannedToReady(posts: CalendarPost[], now: number): CalendarPost[] {
  return posts.map((p) => {
    if (p.status !== "planned") return p;
    if (p.scheduledAt > now) return p;
    return { ...p, status: "ready" as const };
  });
}

/** Alias: 21-dagers vindu fylt med eksisterende motor ({@link fillCalendar}). */
export function ensure21DayCalendar(
  products: SocialProductRef[],
  existingPosts: CalendarPost[],
  insights: CalendarInsights | null,
  location: Location,
): CalendarPost[] {
  return fillCalendar(products, existingPosts, insights, location);
}

export function serializeCalendar(posts: CalendarPost[]): string {
  return JSON.stringify(posts);
}

export function parseCalendar(raw: string): CalendarPost[] {
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.map((item) => {
      const post = item as CalendarPost;
      const id = typeof post.id === "string" ? post.id : "";
      return {
        ...post,
        link:
          post.link ??
          (id ? `/api/social/redirect?postId=${encodeURIComponent(id)}` : undefined),
      };
    });
  } catch {
    return [];
  }
}
