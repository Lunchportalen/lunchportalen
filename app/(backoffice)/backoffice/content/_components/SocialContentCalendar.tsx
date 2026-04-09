"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { detectIndustry } from "@/lib/ai/industry";
import { detectRole } from "@/lib/ai/role";
import type { SocialProductRef } from "@/lib/ai/socialStrategy";
import {
  assertScheduleGapOk,
  cancelCalendarPost,
  fillCalendar,
  isDayAtPostCap,
  markPostPublished,
  newCalendarId,
  parseCalendar,
  postsDueForPublish,
  rollingDayKeys,
  serializeCalendar,
  updateCalendarSchedule,
  type CalendarPost,
} from "@/lib/social/calendar";
import { contentHashForCalendar, generateCalendarSlotContent } from "@/lib/social/calendarContent";
import { learnFromCalendarPosts } from "@/lib/social/calendarLearning";
import { summarizeRevenueForCalendarPosts } from "@/lib/growth/growthAttributionInsights";
import { isArchetypeAllowedForAutoPublish } from "@/lib/growth/growthAutomation";
import { distribute } from "@/lib/growth/channels";
import { learnGrowthFromPosts } from "@/lib/growth/growthLearning";
import { calendarPostPerformanceScore } from "@/lib/growth/scoring";
import { calendarStorageKey } from "@/lib/social/calendarBrowserStorage";
import { industryUiShortLabel } from "@/lib/social/industryMessaging";
import { roleUiShortLabel } from "@/lib/social/industryRoleMessaging";
import { locationLabel, type Location } from "@/lib/social/location";
import { leadSourceIdFromPostId } from "@/lib/social/leadSource";
import {
  canAutoSocialPostToday,
  getAutoSocialCountToday,
  getAutoSocialUserEnabled,
  incrementAutoSocialPostToday,
} from "@/lib/social/autoSocialQuota";
import { logDecision } from "@/lib/ai/decisionLog";
import { publishSocialPost } from "@/lib/social/publish";
import { trackPost } from "@/lib/social/performance";
import {
  attributeLead,
  attributeLinkClick,
  attributePurchaseRevenue,
  recordDemoBookingForPost,
} from "@/lib/social/attribution";

const HOUR_MS = 60 * 60 * 1000;

function formatKr(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(n);
}

function engagementLabel(p: CalendarPost): string | null {
  const perf = p.performance;
  if (!perf) return null;
  if ((perf.revenue ?? 0) > 0) return "📈 omsetning";
  const q = (perf.leads ?? 0) * 4 + (perf.demoBookings ?? 0) * 6 + perf.clicks * 2 + (perf.likes ?? 0) * 0.5;
  if (q >= 14) return "📈 sterkt lead-signal";
  if (q >= 5) return "📈 lead-signal";
  return null;
}

export type SocialContentCalendarProps = {
  pageId: string;
  products: SocialProductRef[];
  location: Location;
};

export function SocialContentCalendar({ pageId, products, location }: SocialContentCalendarProps) {
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [hourlyDryRun, setHourlyDryRun] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editTime, setEditTime] = useState("");
  const [scheduleHint, setScheduleHint] = useState<string | null>(null);

  const postsRef = useRef(posts);
  postsRef.current = posts;

  const insights = useMemo(() => learnFromCalendarPosts(posts), [posts]);
  const growthLearn = useMemo(() => learnGrowthFromPosts(posts), [posts]);
  const revenueDash = useMemo(() => summarizeRevenueForCalendarPosts(posts), [posts]);

  const persist = useCallback(
    (next: CalendarPost[]) => {
      setPosts(next);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(calendarStorageKey(pageId), serializeCalendar(next));
        } catch {
          /* ignore quota */
        }
      }
    },
    [pageId],
  );

  const productSig = useMemo(() => products.map((p) => p.id).join("\0"), [products]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(calendarStorageKey(pageId));
    const parsed = parseCalendar(raw ?? "[]").map((p) => {
      const prod = products.find((x) => x.id === p.productId);
      return {
        ...p,
        location: p.location ?? location,
        leadSourceId: p.leadSourceId ?? leadSourceIdFromPostId(p.id),
        industry: p.industry ?? (prod ? detectIndustry(`${prod.name} ${prod.url}`) : "office"),
      };
    });
    const ins = learnFromCalendarPosts(parsed);
    const filled = fillCalendar(products, parsed, ins, location);
    setPosts(filled);
    if (serializeCalendar(filled) !== serializeCalendar(parsed)) {
      try {
        window.localStorage.setItem(calendarStorageKey(pageId), serializeCalendar(filled));
      } catch {
        /* ignore */
      }
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lokasjonsskifte håndteres i egen effekt (unngå full rehydrering)
  }, [pageId, productSig, products]);

  const productsRef = useRef(products);
  productsRef.current = products;

  const lastLocationRef = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (lastLocationRef.current === location) return;
    lastLocationRef.current = location;
    setPosts((prev) => {
      const next = prev.map((p) => {
        if (p.status !== "planned" && p.status !== "ready") {
          return p.location === location ? p : { ...p, location };
        }
        const prod = productsRef.current.find((x) => x.id === p.productId);
        if (!prod) return { ...p, location };
        const c = generateCalendarSlotContent(prod, p.slotDay, location, p.id);
        return {
          ...p,
          location,
          hook: c.hook,
          caption: c.caption,
          hashtags: c.hashtags,
          b2bArchetype: c.archetype,
          b2bValuePillar: c.valuePillar,
          b2bCta: c.cta,
          industry: c.industry,
          targetRole: c.targetRole,
          contentHash: contentHashForCalendar(c),
        };
      });
      try {
        window.localStorage.setItem(calendarStorageKey(pageId), serializeCalendar(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [hydrated, location, pageId]);

  const runDuePublishes = useCallback(async () => {
    if (!getAutoSocialUserEnabled() && !hourlyDryRun) return;
    const now = Date.now();
    let current = postsRef.current;
    const due = postsDueForPublish(current, now);
    if (due.length === 0) return;

    let changed = false;
    for (const slot of due) {
      if (!canAutoSocialPostToday(2)) break;
      const prod = products.find((x) => x.id === slot.productId);
      if (!prod) continue;

      if (!isArchetypeAllowedForAutoPublish(current, slot.b2bArchetype)) continue;

      const draftContent = generateCalendarSlotContent(prod, slot.slotDay, location, slot.id);
      const r = await publishSocialPost({
        caption: slot.caption ?? draftContent.caption,
        hashtags: slot.hashtags ?? draftContent.hashtags,
        platforms: ["instagram", "facebook"],
        productId: slot.productId,
        productName: prod.name,
        via: "auto_safe",
      });

      if (r.ok) {
        incrementAutoSocialPostToday();
        current = markPostPublished(current, slot.id);
        changed = true;
        logDecision({
          action: "social_calendar_auto_dry_run",
          approved: true,
          decisionType: "social_post",
          context: prod.name,
          socialPost: {
            productId: slot.productId,
            productName: prod.name,
            platforms: ["instagram", "facebook"],
            captionSnippet: (slot.caption ?? "").slice(0, 140),
            via: "auto_safe",
            simulated: r.simulated,
            rid: r.rid,
          },
        });
      } else {
        current = markPostPublished(current, slot.id, r.message);
        changed = true;
      }
    }
    if (changed) {
      const ins = learnFromCalendarPosts(current);
      persist(fillCalendar(products, current, ins, location));
    }
  }, [products, persist, hourlyDryRun, location]);

  useEffect(() => {
    if (!hydrated) return;
    if (!hourlyDryRun && !getAutoSocialUserEnabled()) return;
    const t = window.setInterval(() => {
      void runDuePublishes();
    }, HOUR_MS);
    return () => window.clearInterval(t);
  }, [hydrated, hourlyDryRun, runDuePublishes]);

  const onCancel = (postId: string) => {
    const cancelled = cancelCalendarPost(posts, postId);
    const ins = learnFromCalendarPosts(cancelled);
    persist(fillCalendar(products, cancelled, ins, location));
  };

  const onStartEdit = (p: CalendarPost) => {
    setEditingId(p.id);
    setEditCaption(p.caption ?? "");
    const d = new Date(p.scheduledAt);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    setEditTime(`${hh}:${mm}`);
  };

  const onSaveEdit = () => {
    if (!editingId) return;
    const post = posts.find((x) => x.id === editingId);
    if (!post) return;
    const [hh, mm] = editTime.split(":").map((x) => parseInt(x, 10));
    const base = new Date(post.scheduledAt);
    if (Number.isFinite(hh) && Number.isFinite(mm)) {
      base.setHours(hh, mm, 0, 0);
    }
    const nextMs = base.getTime();
    if (!assertScheduleGapOk(posts, post.slotDay, nextMs, editingId)) {
      setScheduleHint(`Minst 7 timer mellom poster samme dag. Juster klokkeslett.`);
      window.setTimeout(() => setScheduleHint(null), 5000);
      return;
    }
    let next = updateCalendarSchedule(posts, editingId, nextMs);
    next = next.map((x) => (x.id === editingId ? { ...x, caption: editCaption } : x));
    const ins = learnFromCalendarPosts(next);
    persist(fillCalendar(products, next, ins, location));
    setEditingId(null);
    setScheduleHint(null);
  };

  const onSimulateClick = (postId: string) => {
    persist(attributeLinkClick(posts, { postId, productId: "", clicks: 1 }));
  };

  const onSimulatePurchase = (postId: string) => {
    persist(attributePurchaseRevenue(posts, { postId, productId: "", revenue: 200, conversions: 1 }));
  };

  const onRegenerateContent = (p: CalendarPost) => {
    const prod = products.find((x) => x.id === p.productId);
    if (!prod) return;
    const nid = newCalendarId();
    const content = generateCalendarSlotContent(prod, p.slotDay, location, nid);
    const ls = leadSourceIdFromPostId(nid);
    const next = posts.map((x) =>
      x.id === p.id
        ? {
            ...x,
            id: nid,
            leadSourceId: ls,
            hook: content.hook,
            caption: content.caption,
            hashtags: content.hashtags,
            b2bArchetype: content.archetype,
            b2bValuePillar: content.valuePillar,
            b2bCta: content.cta,
            industry: content.industry,
            targetRole: content.targetRole,
            location,
            contentHash: contentHashForCalendar(content),
            status: "planned" as const,
            publishedAt: undefined,
            lastError: undefined,
          }
        : x,
    );
    const ins = learnFromCalendarPosts(next);
    persist(fillCalendar(products, next, ins, location));
  };

  const postsByDay = useMemo(() => {
    const keys = rollingDayKeys();
    const m = new Map<string, CalendarPost[]>();
    for (const d of keys) m.set(d, []);
    for (const p of posts) {
      if (!m.has(p.slotDay)) continue;
      const arr = m.get(p.slotDay)!;
      arr.push(p);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.scheduledAt - b.scheduledAt);
    }
    return m;
  }, [posts]);

  const dayKeys = rollingDayKeys();

  if (!hydrated) {
    return <p className="text-xs text-[rgb(var(--lp-muted))]">Laster kalender…</p>;
  }

  if (products.length === 0) {
    return (
      <p className="text-xs text-[rgb(var(--lp-muted))]">
        Legg til produkter i SoMe-kontekst for å fylle 21-dagerskalenderen automatisk.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-[rgb(var(--lp-muted))]">
        Rullerende 21 dager: planlagt, publisert og ytelse. CTA-lenker får <code className="text-[10px]">?src=post_…</code>{" "}
        for attributjon inn til omsetning. Auto-utsending (dry-run) kjører bare for arketyper med dokumentert omsetning i
        kalenderen; maks 2 trygge innlegg per døgn.
      </p>
      <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/50 px-2 py-2 text-[11px] text-emerald-950">
        <div className="font-semibold">🔥 {formatKr(revenueDash.totalRevenueKr)} kr generert (tilskrevet)</div>
        <p className="mt-0.5 text-[10px] text-emerald-900">
          📈 beste innlegg (omsetning): {revenueDash.bestArchetypesLabel}
        </p>
        <p className="mt-0.5 text-[10px] text-emerald-900">{revenueDash.bestIndustriesRevenueLabel}</p>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[rgb(var(--lp-text))]">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-[rgb(var(--lp-border))]"
          checked={hourlyDryRun}
          onChange={(e) => setHourlyDryRun(e.target.checked)}
        />
        Timevis kjøring av forfalte planlagte poster (dry-run, krever fortsatt global auto eller denne avkryssingen)
      </label>
      <p className="text-[10px] text-[rgb(var(--lp-muted))]">
        Læring (leads): {insights.bestProducts.length} produkter · vindu {insights.bestTimeSlots[0] ?? "—"} · innhold{" "}
        {growthLearn.bestArchetypes.slice(0, 2).join(", ") || "—"} · verdier {growthLearn.bestValuePillars.slice(0, 2).join(", ") || "—"} ·
        bransje {growthLearn.bestIndustries.slice(0, 2).join(", ") || insights.bestIndustries.slice(0, 2).join(", ") || "—"} · rolle{" "}
        {growthLearn.bestRoles.slice(0, 2).join(", ") || insights.bestRoles.slice(0, 2).join(", ") || "—"} · combo{" "}
        {growthLearn.bestIndustryRoleCombos.slice(0, 2).join(", ") || "—"} · konvertering/rolle{" "}
        {growthLearn.bestRoleConversionRates[0]
          ? `${growthLearn.bestRoleConversionRates[0].role}:${growthLearn.bestRoleConversionRates[0].rate.toFixed(2)}`
          : "—"}{" "}
        · geo {growthLearn.bestLocations[0] ?? "—"} · tagger {growthLearn.bestHashtags.slice(0, 3).join(", ") || "—"}         · utgående
        kantine {growthLearn.outboundCanteenSharePct}% · catering {growthLearn.outboundCateringAfterCanteenPct}% · pivot{" "}
        {growthLearn.bestObjectionPivot[0] ?? "—"}
      </p>
      <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {dayKeys.map((day) => {
          const list = postsByDay.get(day) ?? [];
          const cap = isDayAtPostCap(posts, day);
          return (
            <li
              key={day}
              className="rounded-lg border border-[rgb(var(--lp-border))]/80 bg-slate-50/80 p-2 text-[11px] text-[rgb(var(--lp-text))]"
            >
              <div className="font-semibold">{day}</div>
              {list.length === 0 ? (
                <p className="mt-1 text-[rgb(var(--lp-muted))]">Tom slot — kjør autofyll (oppdaterer ved lasting).</p>
              ) : (
                <ul className="mt-1 space-y-2">
                  {list.map((p) => {
                    const prod = products.find((x) => x.id === p.productId);
                    const perf = p.performance;
                    const rev = perf?.revenue ?? 0;
                    const eng = engagementLabel(p);
                    const score = calendarPostPerformanceScore(p);
                    const channels = distribute({ text: p.caption ?? "", performanceScore: score });
                    const locShow = p.location ?? location;
                    return (
                      <li key={p.id} className="rounded border border-white/60 bg-white/90 px-2 py-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className="font-medium">
                            🏢 {industryUiShortLabel(p.industry ?? "office")} · {roleUiShortLabel(p.targetRole ?? "office")} ·{" "}
                            {prod?.name ?? p.productId}
                          </span>
                          <span
                            className={
                              p.status === "published"
                                ? "text-emerald-700"
                                : p.status === "cancelled"
                                  ? "text-slate-400 line-through"
                                  : "text-amber-800"
                            }
                          >
                            {p.status === "planned" ? "planlagt" : p.status === "published" ? "publisert" : "kansellert"}
                          </span>
                        </div>
                        {p.status !== "cancelled" ? (
                          <p className="mt-0.5 text-[10px] text-[rgb(var(--lp-muted))]">
                            {new Date(p.scheduledAt).toLocaleString("nb-NO", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">
                          📍 {locationLabel(locShow)}
                          {p.b2bArchetype ? (
                            <span className="ml-1">
                              · type: {p.b2bArchetype}
                              {p.b2bValuePillar ? ` / ${p.b2bValuePillar}` : ""}
                            </span>
                          ) : null}
                        </p>
                        {p.leadSourceId ? (
                          <p className="mt-0.5 font-mono text-[9px] text-[rgb(var(--lp-muted))]">src: {p.leadSourceId}</p>
                        ) : null}
                        {p.hashtags && p.hashtags.length > 0 ? (
                          <p className="mt-0.5 break-words text-[9px] text-[rgb(var(--lp-muted))]">
                            🏷 {p.hashtags.join(" ")}
                          </p>
                        ) : null}
                        {p.hook ? <p className="mt-1 text-[10px] font-medium">{p.hook}</p> : null}
                        {editingId === p.id ? (
                          <div className="mt-2 space-y-1">
                            <label className="grid gap-0.5 text-[10px]">
                              Tekst
                              <textarea
                                value={editCaption}
                                onChange={(e) => setEditCaption(e.target.value)}
                                rows={3}
                                className="w-full rounded border border-[rgb(var(--lp-border))] px-1 py-1 text-[11px]"
                              />
                            </label>
                            <label className="grid gap-0.5 text-[10px]">
                              Klokkeslett (lokal)
                              <input
                                type="time"
                                value={editTime}
                                onChange={(e) => setEditTime(e.target.value)}
                                className="h-8 rounded border border-[rgb(var(--lp-border))] px-1 text-[11px]"
                              />
                            </label>
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                className="min-h-8 rounded border border-[rgb(var(--lp-border))] px-2 text-[10px]"
                                onClick={onSaveEdit}
                              >
                                Lagre
                              </button>
                              <button
                                type="button"
                                className="min-h-8 rounded border border-transparent px-2 text-[10px] underline"
                                onClick={() => setEditingId(null)}
                              >
                                Avbryt
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-1 whitespace-pre-wrap text-[10px] text-[rgb(var(--lp-text))]">
                            {(p.caption ?? "").slice(0, 280)}
                            {(p.caption?.length ?? 0) > 280 ? "…" : ""}
                          </p>
                        )}
                        {p.status === "published" ? (
                          <p className="mt-1 text-[9px] text-[rgb(var(--lp-muted))]">
                            📈 score {score}/100 · kanaler: social{channels.ads ? ", ads" : ""}
                            {channels.email ? ", e-post" : ""}
                            {channels.retargeting ? ", retargeting" : ""}
                          </p>
                        ) : null}
                        {p.retargeting ? (
                          <p className="mt-0.5 text-[9px] font-medium text-amber-900">
                            Retargeting-kandidat (klikk, ingen kjøp)
                          </p>
                        ) : null}
                        {perf && (rev > 0 || perf.clicks > 0 || (perf.likes ?? 0) > 0) ? (
                          <div className="mt-1 space-y-0.5 text-[10px] text-[rgb(var(--lp-muted))]">
                            {rev > 0 ? <div>🔥 {formatKr(rev)} kr generert</div> : null}
                            {eng ? <div>{eng}</div> : null}
                            <div>
                              klikk {perf.clicks} · leads {perf.leads ?? 0} · demo {perf.demoBookings ?? 0} · salg{" "}
                              {perf.conversions} · likes {perf.likes ?? 0}
                            </div>
                          </div>
                        ) : null}
                        {p.lastError ? <p className="mt-1 text-[10px] text-red-700">{p.lastError}</p> : null}
                        {p.status === "planned" || p.status === "ready" || p.status === "published" ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {(p.status === "planned" || p.status === "ready") && editingId !== p.id ? (
                              <>
                                <button
                                  type="button"
                                  className="min-h-8 rounded border border-[rgb(var(--lp-border))] px-2 text-[10px]"
                                  onClick={() => onStartEdit(p)}
                                >
                                  Rediger
                                </button>
                                <button
                                  type="button"
                                  className="min-h-8 rounded border border-[rgb(var(--lp-border))] px-2 text-[10px]"
                                  onClick={() => onCancel(p.id)}
                                >
                                  Avbryt post
                                </button>
                                <button
                                  type="button"
                                  className="min-h-8 rounded border border-[rgb(var(--lp-border))] px-2 text-[10px]"
                                  onClick={() => onRegenerateContent(p)}
                                >
                                  Nytt AI-utkast
                                </button>
                              </>
                            ) : null}
                            {p.status === "published" ? (
                              <>
                                <button
                                  type="button"
                                  className="min-h-8 rounded border border-dashed border-slate-300 px-2 text-[10px]"
                                  onClick={() => persist(trackPost(posts, p.id, { likes: 3 }))}
                                >
                                  +3 likes (demo)
                                </button>
                                <button
                                  type="button"
                                  className="min-h-8 rounded border border-dashed border-slate-300 px-2 text-[10px]"
                                  onClick={() => onSimulateClick(p.id)}
                                >
                                  +1 klikk (demo)
                                </button>
                                <button
                                  type="button"
                                  className="min-h-8 rounded border border-dashed border-slate-300 px-2 text-[10px]"
                                  onClick={() => onSimulatePurchase(p.id)}
                                >
                                  +200 kr (demo)
                                </button>
                                <button
                                  type="button"
                                  className="min-h-8 rounded border border-dashed border-slate-300 px-2 text-[10px]"
                                  onClick={() => persist(attributeLead(posts, p.id, 1))}
                                >
                                  +1 lead (demo)
                                </button>
                                <button
                                  type="button"
                                  className="min-h-8 rounded border border-dashed border-slate-300 px-2 text-[10px]"
                                  onClick={() =>
                                    persist(
                                      recordDemoBookingForPost(posts, p.id, {
                                        companySize: "20–200",
                                        industry: p.industry ?? "office",
                                        leadId: `demo_${Date.now().toString(36)}`,
                                        targetRole: p.targetRole ?? "office",
                                      }),
                                    )
                                  }
                                >
                                  +1 demo (demo)
                                </button>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              {cap ? <p className="mt-1 text-[9px] text-[rgb(var(--lp-muted))]">Maks {2} poster denne dagen.</p> : null}
            </li>
          );
        })}
      </ul>
      <p className="text-[9px] text-[rgb(var(--lp-muted))]">
        Auto-kvote i dag: {getAutoSocialCountToday()}/2 · global auto-modus: {getAutoSocialUserEnabled() ? "på" : "av"}
      </p>
    </div>
  );
}
