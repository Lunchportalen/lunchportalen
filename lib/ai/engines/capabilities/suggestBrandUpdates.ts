/**
 * Brand evolution assistant capability: suggestBrandUpdates.
 * Suggests brand updates from current brand state: logo path, accent color, voice,
 * and asset checklist. Aligns with AGENTS.md brand/logo rules. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "suggestBrandUpdates";

const suggestBrandUpdatesCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Brand evolution assistant: from current brand state (logo path, accent color, voice, guidelines), suggests updates to align with brand rules: logo from /public/brand, single accent (hot pink), no text-only logo, voice consistency, favicon/app icons. Returns prioritized suggestions. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Suggest brand updates input",
    properties: {
      currentBrand: {
        type: "object",
        description: "Current brand state",
        properties: {
          logoPath: { type: "string", description: "Current logo path (e.g. /public/brand/...)" },
          logoFormat: { type: "string", description: "Image format (png, svg)" },
          accentColor: { type: "string", description: "Primary accent color" },
          voiceTone: { type: "string", description: "Brand voice (e.g. calm, professional)" },
          hasTextOnlyLogo: { type: "boolean", description: "If true, header uses text-only logo (forbidden in prod)" },
          hasFavicon: { type: "boolean" },
          hasAppIcons: { type: "boolean" },
          guidelines: { type: "string", description: "Optional brand guidelines summary" },
        },
      },
      goals: {
        type: "array",
        description: "Optional evolution goals",
        items: { type: "string" },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["currentBrand"],
  },
  outputSchema: {
    type: "object",
    description: "Brand update suggestions result",
    required: ["suggestions", "summary", "generatedAt"],
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "category", "suggestion", "priority"],
          properties: {
            id: { type: "string" },
            category: { type: "string", description: "logo | color | voice | assets | compliance" },
            suggestion: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            currentValue: { type: "string" },
            recommendedValue: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is suggestions only; no brand or asset mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(suggestBrandUpdatesCapability);

export type CurrentBrandInput = {
  logoPath?: string | null;
  logoFormat?: string | null;
  accentColor?: string | null;
  voiceTone?: string | null;
  hasTextOnlyLogo?: boolean | null;
  hasFavicon?: boolean | null;
  hasAppIcons?: boolean | null;
  guidelines?: string | null;
};

export type SuggestBrandUpdatesInput = {
  currentBrand: CurrentBrandInput;
  goals?: string[] | null;
  locale?: "nb" | "en" | null;
};

export type BrandUpdateSuggestion = {
  id: string;
  category: "logo" | "color" | "voice" | "assets" | "compliance";
  suggestion: string;
  priority: "high" | "medium" | "low";
  currentValue?: string | null;
  recommendedValue?: string | null;
};

export type SuggestBrandUpdatesOutput = {
  suggestions: BrandUpdateSuggestion[];
  summary: string;
  generatedAt: string;
};

const CANONICAL_LOGO_PATH = "/public/brand/LP-logo-uten-bakgrunn.png";
const BRAND_PATH_PREFIX = "/public/brand";

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Suggests brand updates from current state. Aligns with AGENTS.md S9–S11. Deterministic; no external calls.
 */
export function suggestBrandUpdates(input: SuggestBrandUpdatesInput): SuggestBrandUpdatesOutput {
  const brand = input.currentBrand && typeof input.currentBrand === "object" ? input.currentBrand : {};
  const isEn = input.locale === "en";

  const logoPath = safeStr(brand.logoPath);
  const accentColor = safeStr(brand.accentColor);
  const voiceTone = safeStr(brand.voiceTone);
  const hasTextOnlyLogo = brand.hasTextOnlyLogo === true;
  const hasFavicon = brand.hasFavicon === true;
  const hasAppIcons = brand.hasAppIcons === true;

  const suggestions: BrandUpdateSuggestion[] = [];

  function add(
    id: string,
    category: BrandUpdateSuggestion["category"],
    suggestion: string,
    priority: BrandUpdateSuggestion["priority"],
    current?: string | null,
    recommended?: string | null
  ) {
    suggestions.push({
      id,
      category,
      suggestion,
      priority,
      currentValue: current ?? undefined,
      recommendedValue: recommended ?? undefined,
    });
  }

  if (hasTextOnlyLogo) {
    add(
      "logo_no_text_only",
      "compliance",
      isEn
        ? "Text-only logos are forbidden in production (AGENTS.md S9–S11). Use image logo from /public/brand."
        : "Kun-tekst-logoer er forbudt i produksjon (AGENTS.md S9–S11). Bruk bilde-logo fra /public/brand.",
      "high",
      "text-only",
      CANONICAL_LOGO_PATH
    );
  }

  if (logoPath && !logoPath.toLowerCase().includes(BRAND_PATH_PREFIX.toLowerCase())) {
    add(
      "logo_path",
      "logo",
      isEn
        ? "Official logo must be rendered from /public/brand (AGENTS.md S9)."
        : "Offisielt logo må rendres fra /public/brand (AGENTS.md S9).",
      "high",
      logoPath,
      BRAND_PATH_PREFIX + "/LP-logo-uten-bakgrunn.png"
    );
  }

  if (!logoPath && !hasTextOnlyLogo) {
    add(
      "logo_asset",
      "logo",
      isEn
        ? "Set header logo to /public/brand/LP-logo-uten-bakgrunn.png; height 64px (mobile) / 120px (desktop)."
        : "Sett header-logo til /public/brand/LP-logo-uten-bakgrunn.png; høyde 64px (mobil) / 120px (desktop).",
      "high",
      null,
      CANONICAL_LOGO_PATH
    );
  }

  add(
    "logo_one_element",
    "compliance",
    isEn
      ? "Header must contain exactly one brand element: the logo image (S11)."
      : "Header skal inneholde nøyaktig ett merkeelement: logo-bildet (S11).",
    "high",
    null,
    "Single logo image only"
  );

  const hasHotPink = /#e91e82|#d81b6f|e91e82|hotpink|hot-pink|accent/i.test(accentColor);
  if (accentColor && !hasHotPink) {
    add(
      "accent_color",
      "color",
      isEn
        ? "Brand accent is hot pink (AGENTS.md F6). Use for hover, focus, one primary action only."
        : "Merke-accent er hot pink (AGENTS.md F6). Bruk for hover, fokus, én primær handling.",
      "medium",
      accentColor,
      "#e91e82 (hot pink)"
    );
  }

  add(
    "accent_single",
    "color",
    isEn
      ? "Use exactly one accent; no large accent backgrounds or multiple CTAs in accent."
      : "Bruk nøyaktig én accent; ingen store accent-bakgrunner eller flere CTA-er i accent.",
    "medium",
    null,
    "One accent only"
  );

  if (voiceTone && !/calm|rolig|professional|profesjonell|warm|varm/i.test(voiceTone)) {
    add(
      "voice_tone",
      "voice",
      isEn
        ? "Brand voice: calm, warm, professional. No hype or buzzwords (AGENTS.md S7)."
        : "Merke stemme: rolig, varm, profesjonell. Ingen hype eller buzzwords (AGENTS.md S7).",
      "medium",
      voiceTone,
      "calm, warm, professional"
    );
  }

  if (!hasFavicon) {
    add(
      "favicon",
      "assets",
      isEn
        ? "Add favicon via Next.js metadata conventions; do not regress."
        : "Legg til favicon via Next.js metadata; ikke regresjon.",
      "medium",
      "false",
      "favicon.ico or metadata"
    );
  }

  if (!hasAppIcons) {
    add(
      "app_icons",
      "assets",
      isEn ? "Wire app icons via Next metadata; ensure no layout shift." : "Koble app-ikoner via Next metadata; unngå layout shift.",
      "low",
      "false",
      "app icons in metadata"
    );
  }

  add(
    "logo_no_overflow",
    "compliance",
    isEn
      ? "Logo must never cause overflow or horizontal scroll (S9, S11)."
      : "Logo skal aldri forårsake overflow eller horisontal scroll (S9, S11).",
    "high",
    null,
    "max-height, contain"
  );

  if (input.goals?.length) {
    const g = input.goals.slice(0, 2).join(", ");
    add(
      "goals_align",
      "compliance",
      isEn ? `Align brand updates with goals: ${g}.` : `Juster merkeoppdateringer med mål: ${g}.`,
      "low",
      null,
      g
    );
  }

  suggestions.sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 };
    return p[a.priority] - p[b.priority];
  });

  const summary = isEn
    ? `Suggested ${suggestions.length} brand update(s) for logo, color, voice, and assets.`
    : `Foreslo ${suggestions.length} merkeoppdatering(er) for logo, farge, stemme og ressurser.`;

  return {
    suggestions,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { suggestBrandUpdatesCapability, CAPABILITY_NAME };
