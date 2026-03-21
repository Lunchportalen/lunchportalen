/**
 * Email sequence generator capability: generateEmailSequence.
 * Produces an email sequence spec (subject, preview, body outline, timing) from goal and key messages.
 * Deterministic; no LLM. Output for welcome, nurture, re-engage, conversion, onboarding.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateEmailSequence";

const generateEmailSequenceCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Generates an email sequence spec from goal, audience, and key messages. Returns per-email subject line, preview text, body outline, CTA, delay, and best-practice hints. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Email sequence generation input",
    properties: {
      goal: {
        type: "string",
        enum: ["welcome", "nurture", "re_engage", "conversion", "onboarding"],
        description: "Sequence goal",
      },
      audience: { type: "string", description: "Target audience" },
      emailCount: { type: "number", description: "Number of emails in sequence (3–7)" },
      keyMessages: { type: "array", items: { type: "string" } },
      cta: { type: "string", description: "Primary call to action" },
      tone: { type: "string", enum: ["professional", "friendly", "warm"] },
      brandContext: { type: "string" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["goal"],
  },
  outputSchema: {
    type: "object",
    description: "Generated email sequence",
    required: ["sequence", "styleNotes", "summary", "generatedAt"],
    properties: {
      sequence: {
        type: "array",
        items: {
          type: "object",
          required: ["emailNumber", "subjectLine", "previewText", "bodyOutline", "cta", "delayDays", "bestPractices"],
          properties: {
            emailNumber: { type: "number" },
            subjectLine: { type: "string" },
            previewText: { type: "string" },
            bodyOutline: { type: "string" },
            cta: { type: "string" },
            delayDays: { type: "number", description: "Days after previous email" },
            bestPractices: { type: "array", items: { type: "string" } },
          },
        },
      },
      styleNotes: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is copy/spec only; no sending or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateEmailSequenceCapability);

const DEFAULT_EMAIL_COUNT = 5;
const MIN_EMAILS = 3;
const MAX_EMAILS = 7;

const GOAL_DELAYS: Record<string, number[]> = {
  welcome: [0, 2, 5, 7, 14],
  nurture: [0, 3, 7, 10, 14],
  re_engage: [0, 5, 10, 14],
  conversion: [0, 2, 4, 7],
  onboarding: [0, 1, 3, 5, 7],
};

const GOAL_SUBJECT_PATTERNS_EN: Record<string, string[]> = {
  welcome: ["Welcome – here’s what’s next", "Quick tip to get started", "You’re all set", "A few resources for you", "We’re here if you need us"],
  nurture: ["Something you might find useful", "Quick update", "Idea for you", "Next step", "Wrapping up"],
  re_engage: ["We miss you", "Quick check-in", "Still here when you need us", "One more thing"],
  conversion: ["Ready when you are", "Last chance this week", "Your next step", "Don’t miss this"],
  onboarding: ["Welcome – step 1", "Getting started", "You’re making progress", "Almost there", "You’re in"],
};

const GOAL_SUBJECT_PATTERNS_NB: Record<string, string[]> = {
  welcome: ["Velkommen – her er neste steg", "Rask tips for å komme i gang", "Du er klar", "Noen ressurser til deg", "Vi er her om du trenger oss"],
  nurture: ["Noe du kanskje får bruk for", "Kort oppdatering", "Ide til deg", "Neste steg", "Avrunding"],
  re_engage: ["Vi savner deg", "Kort oppdatering", "Fortsatt her når du trenger oss", "Én ting til"],
  conversion: ["Klar når du er", "Siste sjanse denne uken", "Ditt neste steg", "Ikke gå glipp"],
  onboarding: ["Velkommen – steg 1", "Kom i gang", "Du kommer deg", "Nesten der", "Du er inne"],
};

const GOAL_BODY_OUTLINES_EN: Record<string, string[]> = {
  welcome: ["Thank them. One sentence on what they get. Link to first action.", "One concrete tip or resource. Short. One CTA.", "Recap value. Invite to explore or contact.", "Curated resource or next step.", "Support reminder. Unsubscribe easy."],
  nurture: ["Lead with value (tip, update). One CTA.", "Build on previous. New angle or example.", "Soft CTA or read more.", "Summary or next-step nudge.", "Clear CTA or pause."],
  re_engage: ["We noticed you’ve been away. One reason to return.", "Reminder of benefit or offer.", "Simple CTA to come back.", "Last nudge; easy opt-out."],
  conversion: ["Direct benefit. One CTA.", "Urgency or scarcity if true. CTA.", "Reminder. CTA.", "Final CTA."],
  onboarding: ["Step 1: do X. One link.", "Step 2: do Y. One link.", "Step 3: do Z. One link.", "Recap. Next step.", "Done. What’s next or support."],
};

const GOAL_BODY_OUTLINES_NB: Record<string, string[]> = {
  welcome: ["Takk. Én setning om hva de får. Lenke til første handling.", "Ét konkret tips eller ressurs. Kort. Én CTA.", "Oppsummer verdi. Inviter til å utforske eller kontakte.", "Ressurs eller neste steg.", "Hjelp på minnet. Avmeld enkelt."],
  nurture: ["Led med verdi (tips, oppdatering). Én CTA.", "Bygg på forrige. Ny vinkel eller eksempel.", "Myk CTA eller les mer.", "Oppsummering eller nudge.", "Tydelig CTA eller pause."],
  re_engage: ["Vi la merke til at du har vært borte. Én grunn til å komme tilbake.", "Påminnelse om fordel eller tilbud.", "Enkel CTA for å komme tilbake.", "Siste nudge; enkel avmelding."],
  conversion: ["Direkte fordel. Én CTA.", "Haster eller knapphet hvis sant. CTA.", "Påminnelse. CTA.", "Siste CTA."],
  onboarding: ["Steg 1: gjør X. Én lenke.", "Steg 2: gjør Y. Én lenke.", "Steg 3: gjør Z. Én lenke.", "Oppsummer. Neste steg.", "Ferdig. Hva nå eller støtte."],
};

const EMAIL_BEST_PRACTICES = ["Subject under 50 chars if possible", "Preview text complements subject", "One primary CTA per email", "Plain-text or simple HTML", "Unsubscribe in footer"];

function safeStr(v: unknown): string {
  return typeof v === "string" ? String(v).trim() : "";
}

export type GenerateEmailSequenceInput = {
  goal: "welcome" | "nurture" | "re_engage" | "conversion" | "onboarding";
  audience?: string | null;
  emailCount?: number | null;
  keyMessages?: string[] | null;
  cta?: string | null;
  tone?: "professional" | "friendly" | "warm" | null;
  brandContext?: string | null;
  locale?: "nb" | "en" | null;
};

export type EmailInSequence = {
  emailNumber: number;
  subjectLine: string;
  previewText: string;
  bodyOutline: string;
  cta: string;
  delayDays: number;
  bestPractices: string[];
};

export type GenerateEmailSequenceOutput = {
  sequence: EmailInSequence[];
  styleNotes: string[];
  summary: string;
  generatedAt: string;
};

/**
 * Generates email sequence spec. Deterministic; no external calls.
 */
export function generateEmailSequence(input: GenerateEmailSequenceInput): GenerateEmailSequenceOutput {
  const isEn = input.locale === "en";
  const goal = input.goal && GOAL_DELAYS[input.goal] ? input.goal : "welcome";
  const count = typeof input.emailCount === "number"
    ? Math.max(MIN_EMAILS, Math.min(MAX_EMAILS, input.emailCount))
    : Math.min(DEFAULT_EMAIL_COUNT, (GOAL_DELAYS[goal] ?? []).length) || DEFAULT_EMAIL_COUNT;
  const cta = safeStr(input.cta) || (isEn ? "Get started" : "Kom i gang");
  const keyMessages = Array.isArray(input.keyMessages) ? input.keyMessages.map((m) => (typeof m === "string" ? m.trim() : "")).filter(Boolean) : [];

  const subjects = (isEn ? GOAL_SUBJECT_PATTERNS_EN : GOAL_SUBJECT_PATTERNS_NB)[goal] ?? GOAL_SUBJECT_PATTERNS_EN.welcome;
  const outlines = (isEn ? GOAL_BODY_OUTLINES_EN : GOAL_BODY_OUTLINES_NB)[goal] ?? GOAL_BODY_OUTLINES_EN.welcome;
  const delays = GOAL_DELAYS[goal] ?? [0, 2, 5, 7];

  const sequence: EmailInSequence[] = [];

  for (let i = 0; i < count; i++) {
    const subjectLine = keyMessages[i] ? (keyMessages[i].length <= 50 ? keyMessages[i] : keyMessages[i].slice(0, 47) + "…") : (subjects[i] ?? subjects[0]);
    const previewText = keyMessages[i] ? keyMessages[i].slice(0, 80) : (isEn ? "Quick read – next step inside." : "Kort lesing – neste steg inni.");
    const bodyOutline = outlines[i] ?? outlines[outlines.length - 1];
    const delayDays = delays[i] ?? delays[delays.length - 1];

    sequence.push({
      emailNumber: i + 1,
      subjectLine,
      previewText,
      bodyOutline,
      cta,
      delayDays,
      bestPractices: EMAIL_BEST_PRACTICES,
    });
  }

  const styleNotes: string[] = [];
  if (input.tone === "professional") styleNotes.push(isEn ? "Calm, professional tone (AGENTS.md)." : "Rolig, profesjonell tone (AGENTS.md).");
  if (input.tone === "warm") styleNotes.push(isEn ? "Warm and approachable; no hype." : "Varm og tilgjengelig; ingen hype.");

  const summary = isEn
    ? `${count}-email ${goal} sequence. Primary CTA: ${cta}.`
    : `${count} e-poster i ${goal}-sekvens. Primær CTA: ${cta}.`;

  return {
    sequence,
    styleNotes,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { generateEmailSequenceCapability, CAPABILITY_NAME };
