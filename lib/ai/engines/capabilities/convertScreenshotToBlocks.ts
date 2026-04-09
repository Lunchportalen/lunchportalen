/**
 * Screenshot → block generator capability: convertScreenshotToBlocks.
 * Converts a screenshot (URL) and/or description into a block structure (BlockNode[]).
 * With description: parses layout into block types and builds blocks. Without: returns default bootstrap (hero, richText, image, cta). Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { BlockNode } from "@/lib/cms/model/blockTypes";
import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";
import { buildScreenshotBootstrapBlocks } from "../../tools/blockBuilder";
import { parseScreenshotLayout } from "./parseScreenshotLayout";

const CAPABILITY_NAME = "convertScreenshotToBlocks";

const convertScreenshotToBlocksCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Converts a screenshot (screenshotUrl) and/or description into block structure. With description, parses layout into block types; without, returns default bootstrap (hero, richText, image, cta). Output: blocks (id, type, data), blockTypes, message. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Convert screenshot to blocks input",
    properties: {
      screenshotUrl: { type: "string", description: "Optional screenshot image URL" },
      description: {
        type: "string",
        description: "Optional layout or content description; when provided, layout is parsed into block sequence",
      },
      locale: { type: "string", description: "Locale (nb | en) for block copy" },
      maxBlocks: { type: "number", description: "Max blocks when using description (default 10)" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Block structure from screenshot/description",
    required: ["blocks"],
    properties: {
      blocks: {
        type: "array",
        description: "Block structure (id, type, data)",
        items: {
          type: "object",
          required: ["id", "type", "data"],
          properties: {
            id: { type: "string" },
            type: { type: "string" },
            data: { type: "object" },
          },
        },
      },
      blockTypes: {
        type: "array",
        description: "Ordered block types",
        items: { type: "string" },
      },
      message: { type: "string" },
      warnings: { type: "array", items: { type: "string" } },
    },
  },
  safetyConstraints: [
    { code: "no_user_content_injection", description: "Output uses placeholder or parsed copy only; no raw HTML.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(convertScreenshotToBlocksCapability);

export type ConvertScreenshotToBlocksInput = {
  screenshotUrl?: string | null;
  description?: string | null;
  locale?: "nb" | "en" | null;
  maxBlocks?: number | null;
};

export type ConvertScreenshotToBlocksOutput = {
  blocks: BlockNode[];
  blockTypes: string[];
  message?: string | null;
  warnings?: string[] | null;
};

/**
 * Converts screenshot (URL) and/or description to block structure. Deterministic; no external calls.
 */
export function convertScreenshotToBlocks(input: ConvertScreenshotToBlocksInput = {}): ConvertScreenshotToBlocksOutput {
  const description = (input.description ?? "").trim();
  const screenshotUrl = (input.screenshotUrl ?? "").trim() || undefined;
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";

  if (description.length > 0) {
    const parsed = parseScreenshotLayout({
      layoutDescription: description,
      screenshotUrl: screenshotUrl ?? undefined,
      locale,
      maxBlocks: input.maxBlocks ?? 10,
    });
    return {
      blocks: parsed.blocks,
      blockTypes: parsed.blockTypes,
      message: parsed.message ?? undefined,
      warnings: parsed.warnings ?? undefined,
    };
  }

  const { blocks, message } = buildScreenshotBootstrapBlocks({
    screenshotUrl,
    description: "",
    locale,
  });
  const blockTypes = blocks.map((b) => b.type);

  const warnings: string[] = [];
  if (!screenshotUrl) {
    warnings.push(isEn ? "No screenshotUrl or description; returned default bootstrap layout." : "Ingen screenshotUrl eller beskrivelse; returnerte standard bootstrap-layout.");
  }

  return {
    blocks,
    blockTypes,
    message,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

export { convertScreenshotToBlocksCapability, CAPABILITY_NAME };
