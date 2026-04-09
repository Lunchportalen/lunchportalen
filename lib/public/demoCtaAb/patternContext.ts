import { DEMO_DEVICE_SEGMENTS, type DemoDeviceSegment } from "@/lib/public/demoCtaAb/contextSegments";
import {
  parseFeatureLearningState,
  type FeatureLearningState,
} from "@/lib/public/demoCtaAb/types";

/** Intensjoner som brukes i mønster-læring (samme semantikk som server `classifyIntentFromSignals`). */
export type DemoPatternIntent = "demo_auto" | "shared_link" | "direct";

export const DEMO_PATTERN_INTENTS: readonly DemoPatternIntent[] = ["demo_auto", "shared_link", "direct"];

function isDemoPatternIntent(s: string): s is DemoPatternIntent {
  return (DEMO_PATTERN_INTENTS as readonly string[]).includes(s);
}

export function parseDemoPatternIntent(v: string | null | undefined): DemoPatternIntent | null {
  if (!v) return null;
  return isDemoPatternIntent(v) ? v : null;
}

/**
 * Nøkkel for mønster-læring: enhet × intensjon (`labels_by_context` bruker samme nøkkel).
 * Format: `d:mobile|i:demo_auto`
 */
export function demoCtaPatternContextKey(input: {
  device_seg: DemoDeviceSegment | string;
  intent_seg: DemoPatternIntent;
}): string {
  return `d:${input.device_seg}|i:${input.intent_seg}`;
}

export function parseDemoCtaPatternContextKey(
  key: string,
): { device_seg: string; intent_seg: DemoPatternIntent } | null {
  const m = /^d:([^|]+)\|i:(demo_auto|shared_link|direct)$/.exec(key.trim());
  if (!m?.[1] || !m[2]) return null;
  const intent_seg = m[2];
  if (!isDemoPatternIntent(intent_seg)) return null;
  return { device_seg: m[1], intent_seg };
}

export function allDemoCtaPatternContextKeys(): string[] {
  const out: string[] = [];
  for (const d of DEMO_DEVICE_SEGMENTS) {
    for (const i of DEMO_PATTERN_INTENTS) {
      out.push(demoCtaPatternContextKey({ device_seg: d, intent_seg: i }));
    }
  }
  return out;
}

/** Tolker `ai_demo_cta_ab_state.pattern_learning_by_context` (JSON-objekt av FeatureLearningState per nøkkel). */
export function parsePatternLearningByContext(raw: unknown): Record<string, FeatureLearningState> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, FeatureLearningState> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k !== "string" || k.length > 72 || !parseDemoCtaPatternContextKey(k)) continue;
    out[k] = parseFeatureLearningState(v);
  }
  return out;
}
