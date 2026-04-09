import type {
  DemoCtaFeatures,
  DemoCtaFeatureFraming,
  DemoCtaFeatureLength,
  DemoCtaFeatureTone,
  DemoCtaFeatureVerb,
} from "@/lib/public/demoCtaAb/types";

/**
 * Heuristic feature tags for legacy / generated labels without explicit `features`.
 */
export function inferDemoCtaFeaturesFromLabel(label: string): DemoCtaFeatures {
  const s = label.trim();
  const lower = s.toLowerCase();
  const isQuestion = /\?\s*$/.test(s);

  let tone: DemoCtaFeatureTone = "benefit";
  if (isQuestion || /\b(hva|hvordan|hvorfor)\b/i.test(s)) tone = "curiosity";
  else if (/\b(nå|i dag|siste|skynd|rask)\b/i.test(lower)) tone = "urgency";
  else if (/^(prøv|start|kom i gang|registrer|sett i gang|gå videre)\b/i.test(s)) tone = "direct";

  let verb: DemoCtaFeatureVerb = "start";
  if (/\bse\b|se ekte|se tall/i.test(lower)) verb = "see";
  else if (/\bøk|flere|vekst|øke/i.test(lower)) verb = "increase";
  else if (/aktiver|aktiv/i.test(lower)) verb = "activate";

  let framing: DemoCtaFeatureFraming = "result";
  if (isQuestion) framing = "question";
  else if (/på minutter|flyt|vei inn|oppstart|prosess/i.test(lower)) framing = "process";

  const length: DemoCtaFeatureLength = s.length > 52 ? "medium" : "short";

  return { tone, verb, framing, length };
}
