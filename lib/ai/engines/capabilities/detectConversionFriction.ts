/**
 * Friction detection engine capability: detectConversionFriction.
 * Detects conversion friction from flow description: form length, step count,
 * required fields, trust signals, CTA clarity, progress indication, etc.
 * Returns friction points with type, severity, and recommendation. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "detectConversionFriction";

const detectConversionFrictionCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Friction detection engine: detects conversion friction from a flow description (steps, form fields, required fields, trust signals, CTA). Returns friction points (type, severity, stepRef, message, recommendation). Use for signup, lead, checkout, or contact flows. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Detect conversion friction input",
    properties: {
      flowType: {
        type: "string",
        description: "Type of flow: signup | lead | contact | checkout | demo",
      },
      steps: {
        type: "array",
        description: "Flow steps: [{ stepIndex, name?, fieldCount?, requiredCount?, hasCaptcha?, hasProgressIndicator? }]",
        items: {
          type: "object",
          properties: {
            stepIndex: { type: "number" },
            name: { type: "string" },
            fieldCount: { type: "number" },
            requiredCount: { type: "number" },
            hasCaptcha: { type: "boolean" },
            hasProgressIndicator: { type: "boolean" },
          },
        },
      },
      totalFormFields: { type: "number", description: "Total form fields if single-step" },
      requiredFormFields: { type: "number", description: "Required fields count" },
      hasTrustSignalNearSubmit: { type: "boolean", description: "Trust element near submit/CTA" },
      hasClearPrimaryCta: { type: "boolean", description: "Single clear primary action" },
      requiresAccountToStart: { type: "boolean", description: "User must create account before converting" },
      dropOffRates: {
        type: "array",
        description: "Optional drop-off rate per step (0-1); high rate flags friction",
        items: { type: "number" },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Conversion friction detection result",
    required: ["frictionPoints", "frictionScore", "summary", "detectedAt"],
    properties: {
      frictionPoints: {
        type: "array",
        items: {
          type: "object",
          required: ["type", "severity", "stepRef", "message", "recommendation", "priority"],
          properties: {
            type: { type: "string", description: "form_length | too_many_steps | required_fields | captcha | missing_trust | unclear_cta | account_required | no_progress | choice_overload" },
            severity: { type: "string", enum: ["high", "medium", "low"] },
            stepRef: { type: "string" },
            message: { type: "string" },
            recommendation: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
          },
        },
      },
      frictionScore: { type: "number", description: "0-100, lower = more friction" },
      summary: { type: "string" },
      detectedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "detection_only", description: "Output is detection and recommendations only; no flow or content mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(detectConversionFrictionCapability);

export type FlowStepInput = {
  stepIndex?: number | null;
  name?: string | null;
  fieldCount?: number | null;
  requiredCount?: number | null;
  hasCaptcha?: boolean | null;
  hasProgressIndicator?: boolean | null;
};

export type DetectConversionFrictionInput = {
  flowType?: string | null;
  steps?: FlowStepInput[] | null;
  totalFormFields?: number | null;
  requiredFormFields?: number | null;
  hasTrustSignalNearSubmit?: boolean | null;
  hasClearPrimaryCta?: boolean | null;
  requiresAccountToStart?: boolean | null;
  dropOffRates?: number[] | null;
  locale?: "nb" | "en" | null;
};

export type FrictionType =
  | "form_length"
  | "too_many_steps"
  | "required_fields"
  | "captcha"
  | "missing_trust"
  | "unclear_cta"
  | "account_required"
  | "no_progress"
  | "choice_overload";

export type FrictionPoint = {
  type: FrictionType;
  severity: "high" | "medium" | "low";
  stepRef: string;
  message: string;
  recommendation: string;
  priority: "high" | "medium" | "low";
};

export type DetectConversionFrictionOutput = {
  frictionPoints: FrictionPoint[];
  frictionScore: number;
  summary: string;
  detectedAt: string;
};

const FORM_FIELDS_HIGH_FRICTION = 10;
const FORM_FIELDS_MEDIUM_FRICTION = 6;
const STEPS_HIGH_FRICTION = 4;
const STEPS_MEDIUM_FRICTION = 3;
const REQUIRED_HIGH_FRICTION = 8;
const REQUIRED_MEDIUM_FRICTION = 5;

/**
 * Detects conversion friction from flow description. Deterministic; no external calls.
 */
export function detectConversionFriction(input: DetectConversionFrictionInput = {}): DetectConversionFrictionOutput {
  const steps = Array.isArray(input.steps) ? input.steps : [];
  const totalFields =
    typeof input.totalFormFields === "number"
      ? input.totalFormFields
      : steps.reduce((s, st) => s + (Number(st?.fieldCount) || 0), 0);
  const requiredFields =
    typeof input.requiredFormFields === "number"
      ? input.requiredFormFields
      : steps.reduce((s, st) => s + (Number(st?.requiredCount) || 0), 0);
  const hasTrust = input.hasTrustSignalNearSubmit === true;
  const hasClearCta = input.hasClearPrimaryCta !== false;
  const requiresAccount = input.requiresAccountToStart === true;
  const dropOffRates = Array.isArray(input.dropOffRates) ? input.dropOffRates : [];
  const isEn = input.locale === "en";

  const frictionPoints: FrictionPoint[] = [];
  let scoreDeductions = 0;

  const add = (
    type: FrictionType,
    severity: "high" | "medium" | "low",
    stepRef: string,
    message: string,
    recommendation: string,
    priority: "high" | "medium" | "low"
  ) => {
    frictionPoints.push({ type, severity, stepRef, message, recommendation, priority });
    scoreDeductions += severity === "high" ? 15 : severity === "medium" ? 10 : 5;
  };

  const stepCount = steps.length || (totalFields > 0 ? 1 : 0);

  if (totalFields >= FORM_FIELDS_HIGH_FRICTION) {
    add(
      "form_length",
      "high",
      "form",
      isEn ? `Form has ${totalFields} fields; long forms increase drop-off.` : `Skjemaet har ${totalFields} felt; lange skjemaer øker frafall.`,
      isEn ? "Reduce fields, use multi-step, or hide optional fields until needed." : "Reduser felt, bruk flertrinns, eller skjul valgfrie felt til nødvendig.",
      "high"
    );
  } else if (totalFields >= FORM_FIELDS_MEDIUM_FRICTION) {
    add(
      "form_length",
      "medium",
      "form",
      isEn ? `Form has ${totalFields} fields; consider shortening or splitting.` : `Skjemaet har ${totalFields} felt; vurder å forkorte eller dele opp.`,
      isEn ? "Keep only essential fields above the fold; optional below or in follow-up." : "Behold kun nødvendige felt over fold; valgfrie under eller i oppfølging.",
      "medium"
    );
  }

  if (stepCount >= STEPS_HIGH_FRICTION) {
    add(
      "too_many_steps",
      "high",
      "flow",
      isEn ? `Flow has ${stepCount} steps; each step adds friction.` : `Flyten har ${stepCount} steg; hvert steg legger til friksjon.`,
      isEn ? "Combine steps where possible or show progress clearly; minimize steps to conversion." : "Slå sammen steg der det er mulig eller vis fremdrift tydelig; minimaliser steg til konvertering.",
      "high"
    );
  } else if (stepCount >= STEPS_MEDIUM_FRICTION) {
    add(
      "too_many_steps",
      "medium",
      "flow",
      isEn ? `Flow has ${stepCount} steps. Ensure progress is visible.` : `Flyten har ${stepCount} steg. Sikre at fremdrift er synlig.`,
      isEn ? "Add a progress indicator so users know how much is left." : "Legg til fremdriftsindikator slik at brukere vet hvor mye som gjenstår.",
      "medium"
    );
  }

  if (requiredFields >= REQUIRED_HIGH_FRICTION) {
    add(
      "required_fields",
      "high",
      "form",
      isEn ? `${requiredFields} required fields; reduce or defer non-essential.` : `${requiredFields} obligatoriske felt; reduser eller utsett ikke-essensielle.`,
      isEn ? "Mark only truly required fields; collect optional data later." : "Merk kun virkelig nødvendige felt; samle valgfrie data senere.",
      "high"
    );
  } else if (requiredFields >= REQUIRED_MEDIUM_FRICTION) {
    add(
      "required_fields",
      "medium",
      "form",
      isEn ? `${requiredFields} required fields. Review necessity.` : `${requiredFields} obligatoriske felt. Gjennomgå nødvendighet.`,
      isEn ? "Consider making some fields optional or pre-filling where possible." : "Vurder å gjøre noen felt valgfrie eller forhåndsutfylt der mulig.",
      "medium"
    );
  }

  const hasCaptcha = steps.some((s) => s?.hasCaptcha === true);
  if (hasCaptcha) {
    add(
      "captcha",
      "medium",
      "form",
      isEn ? "Captcha or challenge adds friction before submit." : "Captcha eller utfordring legger til friksjon før innsending.",
      isEn ? "Use only when necessary; consider less intrusive options (e.g. honeypot, rate limit)." : "Bruk kun ved behov; vurder mindre inngripende alternativer (f.eks. honeypot, rate limit).",
      "medium"
    );
  }

  if (!hasTrust) {
    add(
      "missing_trust",
      "high",
      "submit",
      isEn ? "No trust signal near submit; users may hesitate." : "Ingen tillitssignal nær innsending; brukere kan nøle.",
      isEn ? "Add a short guarantee, testimonial, or security note near the CTA." : "Legg til kort garanti, anmeldelse eller sikkerhetsmelding nær CTA.",
      "high"
    );
  }

  if (!hasClearCta) {
    add(
      "unclear_cta",
      "high",
      "flow",
      isEn ? "Primary CTA is unclear or multiple competing actions." : "Primær CTA er uklar eller flere konkurrerende handlinger.",
      isEn ? "Use one clear primary button (e.g. Get offer, Book demo); secondary actions de-emphasized." : "Bruk én tydelig primær knapp (f.eks. Få tilbud, Bestill demo); sekundære handlinger nedtonet.",
      "high"
    );
  }

  if (requiresAccount) {
    add(
      "account_required",
      "high",
      "flow",
      isEn ? "User must create account before converting; major friction." : "Bruker må opprette konto før konvertering; stor friksjon.",
      isEn ? "Offer guest checkout or lead capture without account; create account after conversion." : "Tilby gjestekasse eller lead-fangst uten konto; opprett konto etter konvertering.",
      "high"
    );
  }

  const hasProgress = steps.length > 0 && steps.some((s) => s?.hasProgressIndicator === true);
  if (stepCount >= 2 && !hasProgress) {
    add(
      "no_progress",
      "medium",
      "flow",
      isEn ? "Multi-step flow has no visible progress indicator." : "Flertrinns flyt har ingen synlig fremdriftsindikator.",
      isEn ? "Add step indicator (e.g. Step 2 of 3) to reduce uncertainty and drop-off." : "Legg til stegindikator (f.eks. Steg 2 av 3) for å redusere usikkerhet og frafall.",
      "medium"
    );
  }

  dropOffRates.forEach((rate, i) => {
    if (typeof rate === "number" && rate >= 0.5 && rate <= 1) {
      add(
        "choice_overload",
        "high",
        `step_${i + 1}`,
        isEn ? `High drop-off at step ${i + 1} (${Math.round(rate * 100)}%); investigate friction.` : `Høyt frafall på steg ${i + 1} (${Math.round(rate * 100)}%); undersøk friksjon.`,
        isEn ? "Simplify step, reduce choices, or add reassurance (trust, progress)." : "Forenkle steg, reduser valg, eller legg til beroligelse (tillit, fremdrift).",
        "high"
      );
    }
  });

  const frictionScore = Math.max(0, Math.min(100, 100 - scoreDeductions));
  const summary = isEn
    ? `Detected ${frictionPoints.length} friction point(s). Friction score: ${frictionScore}/100 (higher = less friction).`
    : `Oppdaget ${frictionPoints.length} friksjonspunkt(er). Friksjonsscore: ${frictionScore}/100 (høyere = mindre friksjon).`;

  return {
    frictionPoints,
    frictionScore,
    summary,
    detectedAt: new Date().toISOString(),
  };
}

export { detectConversionFrictionCapability, CAPABILITY_NAME };
