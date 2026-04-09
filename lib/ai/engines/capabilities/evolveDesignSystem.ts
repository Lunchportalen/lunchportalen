/**
 * Design evolution AI capability: evolveDesignSystem.
 * Suggests design system evolution from current state (tokens, components, version):
 * token scales, component coverage, consistency, accessibility, and versioning. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "evolveDesignSystem";

const evolveDesignSystemCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Design evolution AI: from current design system state (tokens, components, version), suggests evolution: token scales (spacing, color, typography), component coverage, consistency rules, accessibility tokens, and versioning. Returns prioritized suggestions with current/recommended values. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Evolve design system input",
    properties: {
      currentState: {
        type: "object",
        description: "Current design system state",
        properties: {
          tokens: {
            type: "object",
            properties: {
              colors: { type: "array", items: { type: "string" }, description: "Color token names or values" },
              spacing: { type: "array", items: { type: "string" }, description: "Spacing scale (e.g. 0.25rem, 0.5rem)" },
              typography: { type: "array", items: { type: "string" }, description: "Font size / line height scale" },
              borderRadius: { type: "array", items: { type: "string" } },
            },
          },
          components: {
            type: "array",
            description: "Component names or IDs in the system",
            items: { type: "string" },
          },
          version: { type: "string", description: "Current version (e.g. 1.2.0)" },
          hasDarkMode: { type: "boolean" },
          accentColor: { type: "string" },
        },
      },
      goals: {
        type: "array",
        description: "Evolution goals (e.g. consistency, accessibility, scale)",
        items: { type: "string" },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["currentState"],
  },
  outputSchema: {
    type: "object",
    description: "Design system evolution result",
    required: ["evolutionSuggestions", "summary", "generatedAt"],
    properties: {
      evolutionSuggestions: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "type", "category", "suggestion", "priority"],
          properties: {
            id: { type: "string" },
            type: { type: "string", enum: ["token", "component", "pattern", "accessibility", "versioning"] },
            category: { type: "string", description: "e.g. spacing, color, typography" },
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
    { code: "suggestions_only", description: "Output is evolution suggestions only; no design or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(evolveDesignSystemCapability);

export type DesignSystemTokens = {
  colors?: string[] | null;
  spacing?: string[] | null;
  typography?: string[] | null;
  borderRadius?: string[] | null;
};

export type DesignSystemCurrentState = {
  tokens?: DesignSystemTokens | null;
  components?: string[] | null;
  version?: string | null;
  hasDarkMode?: boolean | null;
  accentColor?: string | null;
};

export type EvolveDesignSystemInput = {
  currentState: DesignSystemCurrentState;
  goals?: string[] | null;
  locale?: "nb" | "en" | null;
};

export type DesignEvolutionSuggestion = {
  id: string;
  type: "token" | "component" | "pattern" | "accessibility" | "versioning";
  category: string;
  suggestion: string;
  priority: "high" | "medium" | "low";
  currentValue?: string | null;
  recommendedValue?: string | null;
};

export type EvolveDesignSystemOutput = {
  evolutionSuggestions: DesignEvolutionSuggestion[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Suggests design system evolution from current state. Deterministic; no external calls.
 */
export function evolveDesignSystem(input: EvolveDesignSystemInput): EvolveDesignSystemOutput {
  const state = input.currentState && typeof input.currentState === "object" ? input.currentState : {};
  const goals = Array.isArray(input.goals) ? input.goals.map(safeStr).filter(Boolean) : [];
  const isEn = input.locale === "en";

  const tokens = state.tokens && typeof state.tokens === "object" ? state.tokens : {};
  const colors = Array.isArray(tokens.colors) ? tokens.colors.map(safeStr).filter(Boolean) : [];
  const spacing = Array.isArray(tokens.spacing) ? tokens.spacing.map(safeStr).filter(Boolean) : [];
  const typography = Array.isArray(tokens.typography) ? tokens.typography.map(safeStr).filter(Boolean) : [];
  const components = Array.isArray(state.components) ? state.components.map(safeStr).filter(Boolean) : [];
  const version = safeStr(state.version);
  const hasDarkMode = state.hasDarkMode === true;
  const accentColor = safeStr(state.accentColor);

  const suggestions: DesignEvolutionSuggestion[] = [];

  function add(
    id: string,
    type: DesignEvolutionSuggestion["type"],
    category: string,
    suggestion: string,
    priority: DesignEvolutionSuggestion["priority"],
    current?: string | null,
    recommended?: string | null
  ) {
    suggestions.push({
      id,
      type,
      category,
      suggestion,
      priority,
      currentValue: current ?? undefined,
      recommendedValue: recommended ?? undefined,
    });
  }

  if (spacing.length === 0) {
    add(
      "spacing_scale",
      "token",
      "spacing",
      isEn ? "Define a spacing scale (e.g. 4px base: 0, 4, 8, 12, 16, 24, 32, 48, 64px)." : "Definer en spacing-skala (f.eks. 4px-base: 0, 4, 8, 12, 16, 24, 32, 48, 64px).",
      "high",
      null,
      "0.25rem | 0.5rem | 0.75rem | 1rem | 1.5rem | 2rem | 3rem | 4rem"
    );
  } else if (spacing.length < 5) {
    add(
      "spacing_granularity",
      "token",
      "spacing",
      isEn ? "Add more spacing steps for layout flexibility (aim for 8–12 steps)." : "Legg til flere spacing-trinn for layout-fleksibilitet (mål 8–12 trinn).",
      "medium",
      String(spacing.length),
      "8–12 steps"
    );
  }

  if (colors.length === 0) {
    add(
      "color_tokens",
      "token",
      "color",
      isEn ? "Define semantic color tokens (primary, neutral, success, error, accent)." : "Definer semantiske farge-tokens (primary, neutral, success, error, accent).",
      "high",
      null,
      "primary, neutral, success, error, accent"
    );
  }

  if (!accentColor && colors.length > 0) {
    add(
      "accent_token",
      "token",
      "color",
      isEn ? "Use a single accent color token for focus and primary actions (AGENTS.md: one accent)." : "Bruk én accent-farge-token for fokus og primær handling (AGENTS.md: én accent).",
      "high",
      null,
      "e.g. --color-accent"
    );
  }

  if (typography.length === 0) {
    add(
      "typography_scale",
      "token",
      "typography",
      isEn ? "Define a type scale (e.g. 12, 14, 16, 18, 24, 32px) and line heights." : "Definer en type-skala (f.eks. 12, 14, 16, 18, 24, 32px) og linjehøyder.",
      "high",
      null,
      "0.75rem | 0.875rem | 1rem | 1.125rem | 1.5rem | 2rem"
    );
  }

  const coreComponents = ["button", "input", "card", "heading", "text", "link"];
  const missing = coreComponents.filter((c) => !components.some((x) => x.toLowerCase().includes(c)));
  if (missing.length > 0) {
    add(
      "component_coverage",
      "component",
      "components",
      isEn ? `Consider adding core components: ${missing.slice(0, 4).join(", ")}.` : `Vurder å legge til kjernekomponenter: ${missing.slice(0, 4).join(", ")}.`,
      missing.length >= 3 ? "high" : "medium",
      components.length ? String(components.length) : "0",
      missing.join(", ")
    );
  }

  if (!hasDarkMode) {
    add(
      "dark_mode",
      "pattern",
      "theme",
      isEn ? "Plan for dark mode: semantic color tokens that map to light/dark values." : "Planlegg dark mode: semantiske farge-tokens som mappes til lys/mørk.",
      "medium",
      "false",
      "hasDarkMode: true with token mapping"
    );
  }

  add(
    "accessibility_contrast",
    "accessibility",
    "color",
    isEn ? "Ensure contrast tokens meet WCAG AA (4.5:1 text, 3:1 large text/UI)." : "Sikre at kontrast-tokens oppfyller WCAG AA (4.5:1 tekst, 3:1 stor tekst/UI).",
    "high",
    null,
    "Define --color-text-on-primary, --color-text-on-accent with sufficient contrast"
  );

  add(
    "versioning",
    "versioning",
    "version",
    isEn ? "Use semantic versioning (major.minor.patch) and document breaking token/component changes." : "Bruk semantisk versjonering (major.minor.patch) og dokumenter brytende token/komponentendringer.",
    "low",
    version || "none",
    "e.g. 1.0.0"
  );

  if (goals.length > 0) {
    const g = goals.slice(0, 2).join(", ");
    add(
      "goals_align",
      "pattern",
      "goals",
      isEn ? `Align evolution with stated goals: ${g}.` : `Juster evolusjon til mål: ${g}.`,
      "medium",
      null,
      g
    );
  }

  suggestions.sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 };
    return p[a.priority] - p[b.priority];
  });

  const summary = isEn
    ? `Suggested ${suggestions.length} design system evolution(s) across tokens, components, and patterns.`
    : `Foreslo ${suggestions.length} design system-evolusjon(er) for tokens, komponenter og mønstre.`;

  return {
    evolutionSuggestions: suggestions,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { evolveDesignSystemCapability, CAPABILITY_NAME };
