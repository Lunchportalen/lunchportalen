/**
 * AI video storyboard generator capability: generateVideoStoryboard.
 * Produces a video storyboard (scenes, shots, timing, visual/copy notes) from structured input.
 * Deterministic; no LLM. Output for production briefs or script planning.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateVideoStoryboard";

const generateVideoStoryboardCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Generates a video storyboard from structured input: title, topic, duration, style, and key messages. Returns scenes with shot type, duration, visual description, copy, and audio notes. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Video storyboard input",
    properties: {
      title: { type: "string", description: "Video or project title" },
      topic: { type: "string", description: "Main topic or theme" },
      durationSeconds: { type: "number", description: "Target total duration in seconds" },
      style: {
        type: "string",
        description: "Video style",
        enum: ["explainer", "testimonial", "product", "social", "brand", "custom"],
      },
      keyMessages: {
        type: "array",
        items: { type: "string" },
        description: "Key messages to cover (in order)",
      },
      context: { type: "string", description: "Brand or context (e.g. lunch, Norway)" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["topic"],
  },
  outputSchema: {
    type: "object",
    description: "Generated storyboard",
    required: ["scenes", "totalDurationSeconds", "styleNotes", "generatedAt"],
    properties: {
      scenes: {
        type: "array",
        items: {
          type: "object",
          required: ["sceneNumber", "durationSeconds", "shotType", "visualDescription", "copy", "audioNotes"],
          properties: {
            sceneNumber: { type: "number" },
            durationSeconds: { type: "number" },
            shotType: { type: "string", enum: ["wide", "medium", "close_up", "b_roll", "text"] },
            visualDescription: { type: "string" },
            copy: { type: "string", description: "On-screen or voice-over text" },
            audioNotes: { type: "string" },
          },
        },
      },
      totalDurationSeconds: { type: "number" },
      styleNotes: { type: "array", items: { type: "string" } },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is storyboard spec only; no media generation or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateVideoStoryboardCapability);

const DEFAULT_DURATION_SECONDS = 30;
const MIN_SCENE_SECONDS = 3;
const MAX_SCENE_SECONDS = 8;

const SHOT_TYPES: ("wide" | "medium" | "close_up" | "b_roll" | "text")[] = ["wide", "medium", "close_up", "b_roll", "text"];

const STYLE_NOTES: Record<string, string[]> = {
  explainer: ["Clear hook in first 3 seconds", "One idea per scene", "End with CTA or summary"],
  testimonial: ["Authentic setting", "Talking head + B-roll", "Keep cuts minimal"],
  product: ["Show product early", "Features in short beats", "Strong closing shot"],
  social: ["Vertical or square friendly", "Fast cuts, 3–5s per scene", "Text overlay safe zone"],
  brand: ["Consistent visual tone", "Calm, professional pacing", "Logo only at end"],
  custom: [],
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? String(v).trim() : "";
}

export type GenerateVideoStoryboardInput = {
  title?: string | null;
  topic: string;
  durationSeconds?: number | null;
  style?: "explainer" | "testimonial" | "product" | "social" | "brand" | "custom" | null;
  keyMessages?: string[] | null;
  context?: string | null;
  locale?: "nb" | "en" | null;
};

export type StoryboardScene = {
  sceneNumber: number;
  durationSeconds: number;
  shotType: "wide" | "medium" | "close_up" | "b_roll" | "text";
  visualDescription: string;
  copy: string;
  audioNotes: string;
};

export type GenerateVideoStoryboardOutput = {
  scenes: StoryboardScene[];
  totalDurationSeconds: number;
  styleNotes: string[];
  generatedAt: string;
};

function sceneDurationForStyle(style: string, totalSeconds: number): number {
  const s = style === "social" ? 4 : style === "explainer" ? 5 : 6;
  return Math.min(MAX_SCENE_SECONDS, Math.max(MIN_SCENE_SECONDS, Math.floor(totalSeconds / 5)));
}

/**
 * Builds video storyboard from structured input. Deterministic; no external calls.
 */
export function generateVideoStoryboard(input: GenerateVideoStoryboardInput): GenerateVideoStoryboardOutput {
  const topic = safeStr(input.topic);
  const title = safeStr(input.title);
  const context = safeStr(input.context);
  const styleKey = input.style && STYLE_NOTES[input.style] ? input.style : "explainer";
  const totalSeconds = typeof input.durationSeconds === "number" && input.durationSeconds > 0
    ? input.durationSeconds
    : DEFAULT_DURATION_SECONDS;
  const keyMessages = Array.isArray(input.keyMessages)
    ? input.keyMessages.map((m) => (typeof m === "string" ? m.trim() : "")).filter(Boolean)
    : [];

  const sceneLen = sceneDurationForStyle(styleKey, totalSeconds);
  const numScenes = Math.max(2, Math.floor(totalSeconds / sceneLen));
  const messages = keyMessages.length > 0 ? keyMessages : [topic];
  const isEn = input.locale === "en";

  const scenes: StoryboardScene[] = [];
  const remainder = totalSeconds - (numScenes - 1) * sceneLen;
  const lastSceneDuration = remainder > 0 ? remainder : sceneLen;
  for (let i = 1; i <= numScenes; i++) {
    const shotType = SHOT_TYPES[(i - 1) % SHOT_TYPES.length];
    const msg = messages[Math.min((i - 1) % messages.length, messages.length - 1)];
    const duration = i < numScenes ? sceneLen : lastSceneDuration;

    const visualDescription =
      shotType === "wide"
        ? (isEn ? "Wide shot: " : "Vid vinkel: ") + (topic || "main subject") + (context ? `, ${context}` : "")
        : shotType === "medium"
          ? (isEn ? "Medium shot: " : "Medium: ") + msg
          : shotType === "close_up"
            ? (isEn ? "Close-up: detail or reaction" : "Nærbilde: detalj eller reaksjon")
            : shotType === "b_roll"
              ? (isEn ? "B-roll: supporting visual for " : "B-roll: støttebilde for ") + msg
              : (isEn ? "Text card: " : "Tekstkort: ") + msg;

    const copy = shotType === "text" ? msg : (isEn ? "VO or on-screen: " : "VO eller på skjerm: ") + msg;
    const audioNotes = shotType === "text" ? (isEn ? "Optional music only" : "Kun musikk om ønsket") : (isEn ? "Voice-over or sync" : "Voice-over eller synk");

    scenes.push({
      sceneNumber: i,
      durationSeconds: duration,
      shotType,
      visualDescription,
      copy,
      audioNotes,
    });
  }

  const styleNotes = STYLE_NOTES[styleKey] ?? [];
  const totalDurationSeconds = scenes.reduce((sum, s) => sum + s.durationSeconds, 0);

  return {
    scenes,
    totalDurationSeconds,
    styleNotes,
    generatedAt: new Date().toISOString(),
  };
}

export { generateVideoStoryboardCapability, CAPABILITY_NAME };
