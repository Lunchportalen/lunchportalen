import "server-only";

import type { MergedAutonomyDecision, MappedAutonomyAction } from "@/lib/ai/autonomy/types";

function slugId(d: MergedAutonomyDecision): string {
  return `${d.agent}_${d.action.replace(/[^a-z0-9]+/gi, "_").slice(0, 48)}_${Math.round(d.confidence * 100)}`;
}

/**
 * Maps merged agent decisions to subsystem hints. No side effects.
 * bug_fix → CTO suggestions only (no code change).
 */
export function mapDecisionToAction(d: MergedAutonomyDecision): MappedAutonomyAction {
  const a = d.action.toLowerCase();

  if (a.includes("tech.") || a.includes("review_logs") || a.includes("performance_content")) {
    return {
      id: slugId(d),
      kind: "bug_fix",
      agent: d.agent,
      label: "CTO: gjennomgang",
      description: "Logg, helse og ytelsessignaler — kun forslag; ingen automatisk kodeendring.",
      confidence: d.confidence,
      priority: d.priority,
      reason: d.reason,
      expectedImpact: d.expectedImpact,
      routeHint: "cto_suggestions",
    };
  }

  if (a.includes("experiment") || a.includes("forsøk")) {
    return {
      id: slugId(d),
      kind: "experiment",
      agent: d.agent,
      label: "Eksperiment",
      description: "Opprett eller juster kontrollert eksperiment i eksperimentmodulen (manuelt steg).",
      confidence: d.confidence,
      priority: d.priority,
      reason: d.reason,
      expectedImpact: d.expectedImpact,
      routeHint: "experiments",
    };
  }

  if (a.includes("cta") || a.includes("meta") || a.includes("seo")) {
    return {
      id: slugId(d),
      kind: "seo_fix",
      agent: d.agent,
      label: "SEO / CRO",
      description: "SEO- og CRO-tiltak via godkjente verktøy og CMS (ingen auto-publisering).",
      confidence: d.confidence,
      priority: d.priority,
      reason: d.reason,
      expectedImpact: d.expectedImpact,
      routeHint: "seo_engine",
    };
  }

  if (a.includes("draft") || a.includes("innhold") || a.includes("strategy")) {
    return {
      id: slugId(d),
      kind: "content_improve",
      agent: d.agent,
      label: "Innhold",
      description: "Forbedre innhold i AI-editor med forhåndsvisning — ingen direkte publisering.",
      confidence: d.confidence,
      priority: d.priority,
      reason: d.reason,
      expectedImpact: d.expectedImpact,
      routeHint: "ai_content",
    };
  }

  if (a.includes("publish") || a.includes("release")) {
    return {
      id: slugId(d),
      kind: "publish",
      agent: d.agent,
      label: "Publisering",
      description: "Følg manuell godkjent arbeidsflyt — superadmin eller eksplisitt bekreftelse.",
      confidence: d.confidence,
      priority: d.priority,
      reason: d.reason,
      expectedImpact: d.expectedImpact,
      routeHint: "publish_workflow",
    };
  }

  return {
    id: slugId(d),
    kind: "content_improve",
    agent: d.agent,
    label: "Tiltak",
    description: d.reason,
    confidence: d.confidence,
    priority: d.priority,
    reason: d.reason,
    expectedImpact: d.expectedImpact,
    routeHint: "ai_content",
  };
}
