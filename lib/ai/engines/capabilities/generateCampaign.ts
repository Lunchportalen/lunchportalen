/**
 * Campaign generator capability: generateCampaign.
 * Produces a campaign spec (phases, channels, key messages, KPIs, creative hints) from structured input.
 * Deterministic; no LLM. Output for planning and briefs.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateCampaign";

const generateCampaignCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Generates a campaign spec from structured input: goal, audience, channels, duration, and key messages. Returns phases, deliverables, KPIs, and creative hints. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Campaign generation input",
    properties: {
      name: { type: "string", description: "Campaign name or title" },
      goal: {
        type: "string",
        enum: ["awareness", "lead", "conversion", "retention", "custom"],
        description: "Campaign goal",
      },
      audience: { type: "string", description: "Target audience description" },
      channels: {
        type: "array",
        items: { type: "string", enum: ["email", "social", "web", "ads", "content", "events"] },
        description: "Channels to use",
      },
      durationWeeks: { type: "number", description: "Campaign duration in weeks" },
      budgetTier: { type: "string", enum: ["low", "medium", "high"], description: "Optional budget tier" },
      keyMessages: { type: "array", items: { type: "string" } },
      brandContext: { type: "string", description: "Brand or product context" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["goal"],
  },
  outputSchema: {
    type: "object",
    description: "Generated campaign spec",
    required: ["name", "goal", "phases", "keyMessages", "kpis", "creativeHints", "summary", "generatedAt"],
    properties: {
      name: { type: "string" },
      goal: { type: "string" },
      audience: { type: "string" },
      phases: {
        type: "array",
        items: {
          type: "object",
          required: ["phaseName", "durationWeeks", "objectives", "channels", "deliverables"],
          properties: {
            phaseName: { type: "string" },
            durationWeeks: { type: "number" },
            objectives: { type: "array", items: { type: "string" } },
            channels: { type: "array", items: { type: "string" } },
            deliverables: { type: "array", items: { type: "string" } },
          },
        },
      },
      keyMessages: { type: "array", items: { type: "string" } },
      kpis: {
        type: "array",
        items: {
          type: "object",
          required: ["metric", "targetDescription", "unit"],
          properties: {
            metric: { type: "string" },
            targetDescription: { type: "string" },
            unit: { type: "string" },
          },
        },
      },
      creativeHints: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is campaign spec only; no execution or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(generateCampaignCapability);

function safeStr(v: unknown): string {
  return typeof v === "string" ? String(v).trim() : "";
}

const GOAL_KPIS: Record<string, { metric: string; targetDescription: string; unit: string }[]> = {
  awareness: [
    { metric: "reach", targetDescription: "Unique audience reached", unit: "users" },
    { metric: "impressions", targetDescription: "Total impressions", unit: "count" },
    { metric: "engagement_rate", targetDescription: "Engagement rate", unit: "%" },
  ],
  lead: [
    { metric: "leads", targetDescription: "Lead count", unit: "count" },
    { metric: "cost_per_lead", targetDescription: "Cost per lead", unit: "currency" },
    { metric: "conversion_rate", targetDescription: "Landing to lead rate", unit: "%" },
  ],
  conversion: [
    { metric: "conversions", targetDescription: "Conversion count", unit: "count" },
    { metric: "conversion_rate", targetDescription: "Conversion rate", unit: "%" },
    { metric: "roas", targetDescription: "Return on ad spend", unit: "ratio" },
  ],
  retention: [
    { metric: "retention_rate", targetDescription: "Retention rate", unit: "%" },
    { metric: "repeat_actions", targetDescription: "Repeat actions (e.g. orders)", unit: "count" },
    { metric: "nps", targetDescription: "Net promoter score", unit: "score" },
  ],
  custom: [
    { metric: "primary_metric", targetDescription: "Primary success metric", unit: "custom" },
  ],
};

const GOAL_CREATIVE: Record<string, string[]> = {
  awareness: ["Clear headline", "Single message per asset", "Strong visual hook"],
  lead: ["Value-led CTA", "Low-friction form", "Trust elements above fold"],
  conversion: ["Product benefit focus", "Urgency where appropriate", "One primary CTA"],
  retention: ["Personalization hint", "Loyalty or next-step CTA", "Calm, warm tone"],
  custom: ["Align creative to goal"],
};

export type GenerateCampaignInput = {
  name?: string | null;
  goal: "awareness" | "lead" | "conversion" | "retention" | "custom";
  audience?: string | null;
  channels?: ("email" | "social" | "web" | "ads" | "content" | "events")[] | null;
  durationWeeks?: number | null;
  budgetTier?: "low" | "medium" | "high" | null;
  keyMessages?: string[] | null;
  brandContext?: string | null;
  locale?: "nb" | "en" | null;
};

export type CampaignPhase = {
  phaseName: string;
  durationWeeks: number;
  objectives: string[];
  channels: string[];
  deliverables: string[];
};

export type CampaignKpi = {
  metric: string;
  targetDescription: string;
  unit: string;
};

export type GenerateCampaignOutput = {
  name: string;
  goal: string;
  audience: string;
  phases: CampaignPhase[];
  keyMessages: string[];
  kpis: CampaignKpi[];
  creativeHints: string[];
  summary: string;
  generatedAt: string;
};

/**
 * Generates campaign spec from structured input. Deterministic; no external calls.
 */
export function generateCampaign(input: GenerateCampaignInput): GenerateCampaignOutput {
  const isEn = input.locale === "en";
  const goal = input.goal && GOAL_KPIS[input.goal] ? input.goal : "awareness";
  const name = safeStr(input.name) || (isEn ? `Campaign: ${goal}` : `Kampanje: ${goal}`);
  const audience = safeStr(input.audience) || (isEn ? "Target audience" : "Målgruppe");
  const channels = Array.isArray(input.channels) && input.channels.length > 0
    ? input.channels.filter((c) => ["email", "social", "web", "ads", "content", "events"].includes(c))
    : ["web", "social"];
  const durationWeeks = typeof input.durationWeeks === "number" && input.durationWeeks > 0 ? input.durationWeeks : 4;
  const keyMessages = Array.isArray(input.keyMessages)
    ? input.keyMessages.map((m) => (typeof m === "string" ? m.trim() : "")).filter(Boolean)
    : [isEn ? "Key message 1" : "Nøkkelbudskap 1"];
  const brandContext = safeStr(input.brandContext);

  const phaseCount = durationWeeks <= 2 ? 1 : durationWeeks <= 6 ? 2 : 3;
  const weeksPerPhase = Math.floor(durationWeeks / phaseCount);
  const phases: CampaignPhase[] = [];

  const phaseNamesEn = ["Launch", "Sustain", "Close"];
  const phaseNamesNb = ["Lansering", "Videreføring", "Avslutning"];
  const phaseNames = isEn ? phaseNamesEn : phaseNamesNb;

  const objectivesByGoal: Record<string, string[][]> = {
    awareness: [
      [isEn ? "Build reach" : "Bygg rekkevidde", isEn ? "Drive traffic" : "Driv trafikk"],
      [isEn ? "Maintain visibility" : "Oppretthold synlighet", isEn ? "Engage audience" : "Engasjer målgruppe"],
      [isEn ? "Reinforce message" : "Forsterk budskap", isEn ? "Measure reach" : "Mål rekkevidde"],
    ],
    lead: [
      [isEn ? "Capture leads" : "Fang leads", isEn ? "Qualify traffic" : "Kvalifiser trafikk"],
      [isEn ? "Nurture leads" : "Nurture leads", isEn ? "Retarget" : "Retarget"],
      [isEn ? "Convert top of funnel" : "Konverter topp av funnel", isEn ? "Close leads" : "Lukk leads"],
    ],
    conversion: [
      [isEn ? "Drive conversions" : "Driv konverteringer", isEn ? "Optimize landing" : "Optimaliser landingsside"],
      [isEn ? "Scale winning creative" : "Skaler vinnende kreativ", isEn ? "Retarget abandoners" : "Retarget abandoners"],
      [isEn ? "Final push" : "Siste pust", isEn ? "Measure ROAS" : "Mål ROAS"],
    ],
    retention: [
      [isEn ? "Re-engage users" : "Gjenengasjer brukere", isEn ? "Personalize message" : "Tilpass budskap"],
      [isEn ? "Deliver value" : "Lever verdi", isEn ? "Encourage repeat" : "Oppmuntre til gjentakelse"],
      [isEn ? "Solidify habit" : "Forsterk vane", isEn ? "Collect feedback" : "Innsamle tilbakemeldinger"],
    ],
    custom: [[isEn ? "Phase 1 objective" : "Fase 1 mål"], [isEn ? "Phase 2 objective" : "Fase 2 mål"], [isEn ? "Phase 3 objective" : "Fase 3 mål"]],
  };

  const deliverablesByChannel: Record<string, string[]> = {
    email: [isEn ? "Email sequence" : "E-postsekvens", isEn ? "Subject lines" : "Emnelinjer"],
    social: [isEn ? "Social posts" : "Sosiale poster", isEn ? "Visuals" : "Visualler"],
    web: [isEn ? "Landing page" : "Landingsside", isEn ? "Banners" : "Bannere"],
    ads: [isEn ? "Ad creatives" : "Annonsekreativer", isEn ? "Copy variants" : "Kopivarianter"],
    content: [isEn ? "Blog/asset" : "Blogg/asset", isEn ? "SEO copy" : "SEO-kopi"],
    events: [isEn ? "Event assets" : "Event-assets", isEn ? "Signup flow" : "Registreringsflyt"],
  };

  for (let i = 0; i < phaseCount; i++) {
    const phaseName = phaseNames[i] ?? (isEn ? `Phase ${i + 1}` : `Fase ${i + 1}`);
    const objList = objectivesByGoal[goal]?.[i] ?? objectivesByGoal.custom[i] ?? [phaseName];
    const deliverables: string[] = [];
    for (const ch of channels) {
      const d = deliverablesByChannel[ch];
      if (d) deliverables.push(...d);
    }
    phases.push({
      phaseName,
      durationWeeks: i === phaseCount - 1 ? durationWeeks - weeksPerPhase * (phaseCount - 1) : weeksPerPhase,
      objectives: objList,
      channels: [...channels],
      deliverables: [...new Set(deliverables)],
    });
  }

  const kpis = GOAL_KPIS[goal] ?? GOAL_KPIS.custom;
  const creativeHints = GOAL_CREATIVE[goal] ?? GOAL_CREATIVE.custom;

  const summary = isEn
    ? `Campaign "${name}": ${goal}, ${durationWeeks} weeks, ${phases.length} phase(s), ${channels.length} channel(s).`
    : `Kampanje "${name}": ${goal}, ${durationWeeks} uker, ${phases.length} fase(r), ${channels.length} kanal(er).`;

  return {
    name,
    goal,
    audience: brandContext ? `${audience} (${brandContext})` : audience,
    phases,
    keyMessages,
    kpis,
    creativeHints,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { generateCampaignCapability, CAPABILITY_NAME };
