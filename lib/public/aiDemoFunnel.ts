import type { DemoCtaVariantKey } from "@/lib/public/demoCtaAb/config";

/**
 * Attribution for AI-motoren offentlig demo → registrering.
 *
 * Sporing i `content_analytics_events` (via POST /api/public/analytics):
 * - page_view · `ai_demo_view` — `metadata.cta_ab`, `device_seg`, `source_seg`, `intent_seg` (anbefalt for mønster-læring per kontekst)
 * - cta_click — samme metadata (via data-attributter + variant)
 * - page_view · `signup_from_ai_demo` — `ab` (a|b|g*), `ds`, `ss` i URL → metadata
 *
 * Læring:
 * - Global vekter: `ai_demo_cta_ab_state` (+ `feature_learning`: enkeltfeatures, par og triple tone|verb|framing, `exploration_rate`, historikk, `strategy_mode`)
 * - Per kontekst (enhet × kilde × intent): `ai_demo_ab_context_state` (`weights`, `winning_variant`, `impressions_total`)
 * - Rebalanse: jevnlig; utforskning dynamisk ved assign (lagret rate + blend).
 */
export const AI_DEMO_FUNNEL_FROM = "ai_demo" as const;

export function registrationHrefFromAiDemo(
  ctaAb: DemoCtaVariantKey,
  ctx: { deviceSeg: string; sourceSeg: string; intentSeg?: string },
): string {
  const q = new URLSearchParams();
  q.set("from", AI_DEMO_FUNNEL_FROM);
  q.set("ab", ctaAb);
  q.set("ds", ctx.deviceSeg);
  q.set("ss", ctx.sourceSeg);
  if (ctx.intentSeg && ctx.intentSeg.length <= 24) q.set("is", ctx.intentSeg);
  return `/registrering?${q.toString()}`;
}
