/**
 * Forklarbare innsikter for dashboard og AI CEO (omsetning vs snitt).
 */

import type { Industry } from "@/lib/ai/industry";
import { isIndustry } from "@/lib/ai/industry";
import type { Role } from "@/lib/ai/role";
import { isRole } from "@/lib/ai/role";
import type { CalendarPost } from "@/lib/social/calendar";
import { industryUiShortLabel } from "@/lib/social/industryMessaging";
import {
  industrySegmentNorwegianPhrase,
  roleResponderHeadline,
  roleUiShortLabel,
} from "@/lib/social/industryRoleMessaging";

export type RevenueDashboardSummary = {
  totalRevenueKr: number;
  bestArchetypesLabel: string;
  /** 🏢 IT · 🏢 Bygg — etter tilskrevet omsetning */
  bestIndustriesRevenueLabel: string;
  /** f.eks. «IT + HR» */
  bestIndustryRoleSegmentLabel: string | null;
  /** f.eks. «3,2x høyere inntekt» */
  bestIndustryRoleLiftLabel: string | null;
  /** Kort neste steg */
  nextSegmentRecommendation: string | null;
};

/** Visningslabel for nøkkel it_hr → «IT + HR». */
export function formatIndustryRoleComboLabel(comboKey: string): string {
  const u = comboKey.lastIndexOf("_");
  if (u <= 0) return comboKey;
  const ind = comboKey.slice(0, u);
  const role = comboKey.slice(u + 1);
  if (isIndustry(ind) && isRole(role)) {
    return `${industryUiShortLabel(ind)} + ${roleUiShortLabel(role)}`;
  }
  return comboKey.replace("_", " + ");
}

function segmentComboKey(p: CalendarPost): string {
  return `${p.industry ?? "office"}_${p.targetRole ?? "office"}`;
}

export function summarizeRevenueForCalendarPosts(posts: CalendarPost[]): RevenueDashboardSummary {
  let total = 0;
  const byArch = new Map<string, number>();
  const byInd = new Map<string, number>();
  const byCombo = new Map<string, { sum: number; n: number }>();

  for (const p of posts) {
    if (p.status !== "published") continue;
    const r = p.performance?.revenue ?? 0;
    total += r;
    if (p.b2bArchetype && r > 0) {
      byArch.set(p.b2bArchetype, (byArch.get(p.b2bArchetype) ?? 0) + r);
    }
    if (r > 0) {
      const ind = p.industry ?? "office";
      byInd.set(ind, (byInd.get(ind) ?? 0) + r);
    }
  }

  const published = posts.filter((p) => p.status === "published" && p.performance);
  const rev = (p: CalendarPost) => p.performance?.revenue ?? 0;
  for (const p of published) {
    const k = segmentComboKey(p);
    const cur = byCombo.get(k) ?? { sum: 0, n: 0 };
    cur.sum += rev(p);
    cur.n += 1;
    byCombo.set(k, cur);
  }

  const overallAvg = published.length > 0 ? published.reduce((a, p) => a + rev(p), 0) / published.length : 0;

  let bestComboKey: string | null = null;
  let bestComboRatio = 0;
  for (const [k, { sum, n }] of byCombo.entries()) {
    if (n < 2 || overallAvg <= 0) continue;
    const avg = sum / n;
    const ratio = avg / overallAvg;
    if (ratio > bestComboRatio) {
      bestComboRatio = ratio;
      bestComboKey = k;
    }
  }

  const top = [...byArch.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
  const bestArchetypesLabel =
    top.length === 0 ? "ingen omsetning registrert ennå" : top.map(([k]) => k).join(" + ");

  const topInd = [...byInd.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
  const bestIndustriesRevenueLabel =
    topInd.length === 0
      ? "ingen bransje-omsetning ennå"
      : topInd.map(([k]) => `🏢 ${industryUiShortLabel(k as Industry)}`).join(" · ");

  const hasSegmentLift = bestComboKey && bestComboRatio >= 1.15 && published.length >= 4;
  const bestIndustryRoleSegmentLabel =
    hasSegmentLift && bestComboKey ? formatIndustryRoleComboLabel(bestComboKey) : null;
  const bestIndustryRoleLiftLabel =
    hasSegmentLift && bestComboRatio >= 1.15
      ? `${bestComboRatio >= 1.95 ? `${Math.round(bestComboRatio)}` : bestComboRatio.toFixed(1)}x høyere inntekt (snitt vs segment)`
      : null;
  const nextSegmentRecommendation =
    hasSegmentLift && bestIndustryRoleSegmentLabel
      ? `Lag flere innlegg for segmentet «${bestIndustryRoleSegmentLabel}» (samme bransje- og rolleprofil i innholdet).`
      : null;

  return {
    totalRevenueKr: total,
    bestArchetypesLabel,
    bestIndustriesRevenueLabel,
    bestIndustryRoleSegmentLabel,
    bestIndustryRoleLiftLabel,
    nextSegmentRecommendation,
  };
}

/**
 * Anbefalingstekst til AI CEO — kun når løftet er meningsfullt (≥1.3x).
 */
export function buildRevenueLiftRecommendation(posts: CalendarPost[]): string | null {
  const published = posts.filter((p) => p.status === "published" && p.performance);
  if (published.length < 4) return null;

  const rev = (p: CalendarPost) => p.performance?.revenue ?? 0;
  const totalRev = published.reduce((a, p) => a + rev(p), 0);
  if (totalRev < 1) return null;

  const overallAvg = totalRev / published.length;

  const byArch = new Map<string, { sum: number; n: number }>();
  for (const p of published) {
    const a = p.b2bArchetype;
    if (!a) continue;
    const cur = byArch.get(a) ?? { sum: 0, n: 0 };
    cur.sum += rev(p);
    cur.n += 1;
    byArch.set(a, cur);
  }

  let bestArch: string | null = null;
  let bestArchRatio = 0;
  for (const [k, { sum, n }] of byArch.entries()) {
    if (n < 2) continue;
    const avg = sum / n;
    const ratio = overallAvg > 0 ? avg / overallAvg : 0;
    if (ratio > bestArchRatio) {
      bestArchRatio = ratio;
      bestArch = k;
    }
  }

  const byInd = new Map<string, { sum: number; n: number }>();
  for (const p of published) {
    const ind = p.industry ?? "office";
    const cur = byInd.get(ind) ?? { sum: 0, n: 0 };
    cur.sum += rev(p);
    cur.n += 1;
    byInd.set(ind, cur);
  }

  let bestInd: string | null = null;
  let bestIndRatio = 0;
  for (const [k, { sum, n }] of byInd.entries()) {
    if (n < 2) continue;
    const avg = sum / n;
    const ratio = overallAvg > 0 ? avg / overallAvg : 0;
    if (ratio > bestIndRatio) {
      bestIndRatio = ratio;
      bestInd = k;
    }
  }

  const byCombo = new Map<string, { sum: number; n: number }>();
  for (const p of published) {
    const k = segmentComboKey(p);
    const cur = byCombo.get(k) ?? { sum: 0, n: 0 };
    cur.sum += rev(p);
    cur.n += 1;
    byCombo.set(k, cur);
  }

  let bestCombo: string | null = null;
  let bestComboRatio = 0;
  for (const [k, { sum, n }] of byCombo.entries()) {
    if (n < 2) continue;
    const avg = sum / n;
    const ratio = overallAvg > 0 ? avg / overallAvg : 0;
    if (ratio > bestComboRatio) {
      bestComboRatio = ratio;
      bestCombo = k;
    }
  }

  const parts: string[] = [];
  if (bestArch && bestArchRatio >= 1.3) {
    const times = bestArchRatio >= 1.95 ? `${Math.round(bestArchRatio)}x` : `${bestArchRatio.toFixed(1)}x`;
    parts.push(
      `Denne typen innlegg («${bestArch}») genererer ca. ${times} mer tilskrevet omsetning enn snittet i kalenderen (målt på publiserte poster med ?src=post_…).`,
    );
  }
  if (bestInd && bestIndRatio >= 1.3) {
    const times = bestIndRatio >= 1.95 ? `${Math.round(bestIndRatio)}x` : `${bestIndRatio.toFixed(1)}x`;
    parts.push(
      `Segment 🏢 ${industryUiShortLabel(bestInd as Industry)} genererer ca. ${times} mer tilskrevet omsetning enn snittet (samme vindu).`,
    );
  }
  if (bestCombo && bestComboRatio >= 1.3) {
    const u = bestCombo.lastIndexOf("_");
    const indPart = u > 0 ? bestCombo.slice(0, u) : "";
    const rolePart = u > 0 ? bestCombo.slice(u + 1) : "";
    if (isIndustry(indPart) && isRole(rolePart)) {
      const times = bestComboRatio >= 1.95 ? `${Math.round(bestComboRatio)}x` : `${bestComboRatio.toFixed(1)}x`;
      parts.push(
        `${roleResponderHeadline(rolePart)} i ${industrySegmentNorwegianPhrase(indPart)} responderer best (ca. ${times} høyere tilskrevet omsetning enn snitt) → øk fokus her.`,
      );
    }
  }

  return parts.length > 0 ? parts.join(" ") : null;
}
