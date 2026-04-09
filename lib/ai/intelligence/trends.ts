/**
 * Trend detection — deterministic heuristics over the unified event timeline.
 */

import "server-only";

import type { IntelligenceEvent, IntelligenceTrends, PublicSystemSignals } from "./types";

const DAY_MS = 86_400_000;

function countConversions(events: readonly IntelligenceEvent[], since: number, until: number): number {
  let n = 0;
  for (const e of events) {
    if (e.type !== "conversion") continue;
    if (e.timestamp < since || e.timestamp >= until) continue;
    n += 1;
  }
  return n;
}

function countWeakRevenueSignals(events: readonly IntelligenceEvent[], windowMs: number): number {
  const cutoff = Date.now() - windowMs;
  let n = 0;
  for (const e of events) {
    if (e.type !== "analytics") continue;
    if (e.timestamp < cutoff) continue;
    if (e.payload.kind !== "revenue_insights") continue;
    if (e.payload.sampleOk === false) n += 1;
    const issues = e.payload.topWeakIssues;
    if (Array.isArray(issues) && issues.length >= 3) n += 1;
  }
  return n;
}

/**
 * Derive trend flags + explain strings (audit-friendly).
 */
export function deriveTrendsFromEvents(
  events: readonly IntelligenceEvent[],
  signals: PublicSystemSignals,
): IntelligenceTrends {
  const explain: string[] = [];
  const anomalies: string[] = [];
  const now = Date.now();
  const conv7 = countConversions(events, now - 7 * DAY_MS, now);
  const convPrev7 = countConversions(events, now - 14 * DAY_MS, now - 7 * DAY_MS);
  const risingConversions = convPrev7 > 0 ? conv7 / convPrev7 >= 1.15 : conv7 >= 3;
  if (risingConversions) {
    explain.push(
      convPrev7 > 0
        ? `Konverteringshendelser siste 7 døgn (${conv7}) vs forrige uke (${convPrev7}) — oppgang.`
        : `Konverteringshendelser siste 7 døgn: ${conv7} (begrenset historikk for sammenligning).`,
    );
  } else if (conv7 === 0 && convPrev7 > 0) {
    explain.push("Konverteringshendelser falt til null siste 7 døgn vs. forrige periode.");
  }

  const weakRev = countWeakRevenueSignals(events, 14 * DAY_MS);
  const conversionSlump = convPrev7 > 2 && conv7 < convPrev7 * 0.55;
  const fallingPerformance = weakRev >= 2 || conversionSlump;
  if (weakRev >= 2) {
    explain.push(`Revenue-innsikt med svake signaler eller lav dekning: ${weakRev} observasjon(er) siste 14 døgn.`);
    anomalies.push("revenue_insights_weak_or_under_sampled");
  }
  if (conversionSlump) {
    explain.push(
      `Konverteringshendelser siste 7 døgn (${conv7}) under halvparten av forrige uke (${convPrev7}) — mulig fall i ytelse.`,
    );
  }

  const byDomain = new Map<string, number>();
  for (const e of events) {
    byDomain.set(e.type, (byDomain.get(e.type) ?? 0) + 1);
  }
  const total = events.length || 1;
  for (const [t, c] of byDomain) {
    if (c / total > 0.72 && c > 25) {
      anomalies.push(`dominant_event_stream:${t}`);
      explain.push(`Høy andel hendelser av type «${t}» (${c}/${total}) — kan skjevne aggregater.`);
      break;
    }
  }

  if (signals.bestIndustry === "insufficient_data" && signals.bestChannel === "insufficient_data") {
    explain.push("GTM-kanaler og bransje har utilstrekkelig volum i intelligenslagret.");
  }

  return {
    risingConversions,
    fallingPerformance,
    anomalies,
    explain,
  };
}
