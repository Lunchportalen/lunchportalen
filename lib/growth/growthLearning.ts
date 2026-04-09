/**
 * Vekst-/SoMe-læring med omsetning som primær sannhet (klient-/server-trygg).
 * NB: lib/ai/learning.ts er server-only — ikke bland disse.
 */

import type { CalendarPost } from "@/lib/social/calendar";
import { distribute } from "@/lib/growth/channels";
import { calendarPostPerformanceScore } from "@/lib/growth/scoring";
import { mergeOutboundLearningSlice } from "@/lib/outbound/outboundGrowthMerge";

export type GrowthLearningResult = {
  bestLocations: string[];
  bestHashtags: string[];
  bestChannels: string[];
  bestArchetypes: string[];
  bestValuePillars: string[];
  bestIndustries: string[];
  bestRoles: string[];
  /** Rangert etter sum tilskrevet omsetning */
  archetypesByRevenue: string[];
  hashtagsByRevenue: string[];
  locationsByRevenue: string[];
  ctasByRevenue: string[];
  industriesByRevenue: string[];
  /** f.eks. "it|demo" — beste arketype per bransje målt i kr */
  industryArchetypesByRevenue: string[];
  /** f.eks. "finance|Få tilbud →" */
  industryCtasByRevenue: string[];
  /** f.eks. it_hr, construction_manager — omsetning per bransje+rolle */
  bestIndustryRoleCombos: string[];
  industryRolesByRevenue: string[];
  /** Snitt konverteringer per publisert post med den målrollen */
  bestRoleConversionRates: { role: string; rate: number }[];
  totalAttributedRevenue: number;
  /** Utgående: bransjer med «interessert»-svar (manuelt loggført) */
  outboundIndustriesByReply: string[];
  outboundRolesByReply: string[];
  /** email | linkedin | unknown */
  outboundMessageTypesByReply: string[];
  /** Utgående innvendinger: andel analyser med kantine-signal */
  outboundCanteenSharePct: number;
  /** Utgående: catering-interesse av kantine-treff (manuelt loggført) */
  outboundCateringAfterCanteenPct: number;
  outboundPivotByObjection: Record<string, number>;
  /** Forklarbar rangering: innvending→pivot-count, catering per pivot */
  bestObjectionPivot: string[];
};

function bump(map: Map<string, number>, key: string | undefined, delta: number): void {
  if (!key || delta === 0) return;
  map.set(key, (map.get(key) ?? 0) + delta);
}

/**
 * Lærer hvilke mønstre som faktisk genererer omsetning (forklarbar aggregering).
 */
export function learnGrowthFromPosts(posts: CalendarPost[]): GrowthLearningResult {
  const published = posts.filter((p) => p.status === "published" && p.performance);

  const locScores = new Map<string, number>();
  const tagScores = new Map<string, number>();
  const channelScores = new Map<string, number>();
  const archScores = new Map<string, number>();
  const pillarScores = new Map<string, number>();
  const indScores = new Map<string, number>();
  const roleScores = new Map<string, number>();

  const revByLoc = new Map<string, number>();
  const revByTag = new Map<string, number>();
  const revByArch = new Map<string, number>();
  const revByCta = new Map<string, number>();
  const revByInd = new Map<string, number>();
  const revByIndArch = new Map<string, number>();
  const revByIndCta = new Map<string, number>();
  const revByIndRole = new Map<string, number>();

  const roleConvAgg = new Map<string, { conversions: number; n: number }>();

  let totalAttributedRevenue = 0;

  for (const p of published) {
    const score = calendarPostPerformanceScore(p);
    const rev = p.performance?.revenue ?? 0;
    totalAttributedRevenue += rev;

    const weightEng = score + rev * 0.15;

    const loc = p.location ?? "trondheim";
    bump(locScores, loc, weightEng);
    bump(revByLoc, loc, rev);

    for (const t of p.hashtags ?? []) {
      const k = String(t).trim();
      if (!k) continue;
      bump(tagScores, k, weightEng);
      bump(revByTag, k, rev);
    }

    const indKey = p.industry ?? "office";
    const roleKey = p.targetRole ?? "office";
    bump(indScores, indKey, weightEng);
    bump(roleScores, roleKey, weightEng);
    bump(revByInd, indKey, rev);
    bump(revByIndRole, `${indKey}_${roleKey}`, rev);

    bump(archScores, p.b2bArchetype, weightEng);
    bump(pillarScores, p.b2bValuePillar, weightEng);
    bump(revByArch, p.b2bArchetype, rev);
    bump(revByCta, p.b2bCta, rev);
    if (p.b2bArchetype) {
      bump(revByIndArch, `${indKey}|${p.b2bArchetype}`, rev);
    }
    if (p.b2bCta) {
      bump(revByIndCta, `${indKey}|${p.b2bCta}`, rev);
    }

    const rc = roleConvAgg.get(roleKey) ?? { conversions: 0, n: 0 };
    rc.conversions += p.performance?.conversions ?? 0;
    rc.n += 1;
    roleConvAgg.set(roleKey, rc);

    const plan = distribute({
      text: p.caption ?? "",
      performanceScore: score,
    });
    for (const [ch, on] of Object.entries(plan)) {
      if (!on) continue;
      bump(channelScores, ch, weightEng);
    }
  }

  const sortKeysByValue = (m: Map<string, number>) =>
    [...m.entries()]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);

  const bestLocations = sortKeysByValue(locScores);
  const bestHashtags = sortKeysByValue(tagScores).slice(0, 20);
  const bestChannels =
    sortKeysByValue(channelScores).length > 0
      ? sortKeysByValue(channelScores)
      : ["social", "ads", "email", "retargeting"];
  const bestArchetypes = sortKeysByValue(archScores);
  const bestValuePillars = sortKeysByValue(pillarScores);
  const bestIndustries = sortKeysByValue(indScores);
  const bestRoles = sortKeysByValue(roleScores);

  const archetypesByRevenue = sortKeysByValue(revByArch);
  const hashtagsByRevenue = sortKeysByValue(revByTag).slice(0, 15);
  const locationsByRevenue = sortKeysByValue(revByLoc);
  const ctasByRevenue = sortKeysByValue(revByCta);
  const industriesByRevenue = sortKeysByValue(revByInd);
  const industryArchetypesByRevenue = sortKeysByValue(revByIndArch).slice(0, 12);
  const industryCtasByRevenue = sortKeysByValue(revByIndCta).slice(0, 12);
  const industryRolesByRevenue = sortKeysByValue(revByIndRole).slice(0, 12);
  const bestIndustryRoleCombos = industryRolesByRevenue;

  const bestRoleConversionRates = [...roleConvAgg.entries()]
    .filter(([, agg]) => agg.n > 0)
    .map(([role, { conversions, n }]) => ({
      role,
      rate: n > 0 ? conversions / n : 0,
    }))
    .sort((a, b) => b.rate - a.rate);

  const outboundAugment =
    typeof window !== "undefined" ? mergeOutboundLearningSlice() : null;

  return {
    bestLocations,
    bestHashtags,
    bestChannels,
    bestArchetypes,
    bestValuePillars,
    bestIndustries,
    bestRoles,
    archetypesByRevenue,
    hashtagsByRevenue,
    locationsByRevenue,
    ctasByRevenue,
    industriesByRevenue,
    industryArchetypesByRevenue,
    industryCtasByRevenue,
    bestIndustryRoleCombos,
    industryRolesByRevenue,
    bestRoleConversionRates,
    totalAttributedRevenue,
    outboundIndustriesByReply: outboundAugment?.outboundIndustriesByReply ?? [],
    outboundRolesByReply: outboundAugment?.outboundRolesByReply ?? [],
    outboundMessageTypesByReply: outboundAugment?.outboundMessageTypesByReply ?? [],
    outboundCanteenSharePct: outboundAugment?.outboundCanteenSharePct ?? 0,
    outboundCateringAfterCanteenPct: outboundAugment?.outboundCateringAfterCanteenPct ?? 0,
    outboundPivotByObjection: outboundAugment?.outboundPivotByObjection ? { ...outboundAugment.outboundPivotByObjection } : {},
    bestObjectionPivot: outboundAugment?.bestObjectionPivot ? [...outboundAugment.bestObjectionPivot] : [],
  };
}
