/**
 * Phase 3: AI page composer draft generation.
 * - Deterministic structure from generatePageStructure / generatePageFromStructuredInput
 * - No LLM; intent/template only. Round-trip and shape consistency.
 */

import { describe, test, expect } from "vitest";
import {
  generatePageStructure,
  generatePageFromStructuredInput,
} from "@/lib/ai/tools/pageBuilder";

describe("AI page composer draft generation", () => {
  describe("generatePageStructure", () => {
    test("returns valid draft shape with title, summary, blocks", async () => {
      const out = await generatePageStructure("Kontakt oss", "nb");
      expect(out).toHaveProperty("title");
      expect(out).toHaveProperty("summary");
      expect(out).toHaveProperty("blocks");
      expect(Array.isArray(out.blocks)).toBe(true);
      if (out.warnings != null) expect(Array.isArray(out.warnings)).toBe(true);
      expect(out.blocks.length).toBeGreaterThan(0);
      out.blocks.forEach((b) => {
        expect(b).toHaveProperty("type");
        expect(typeof b.type).toBe("string");
        if ("data" in b && b.data != null) {
          expect(typeof b.data).toBe("object");
        }
      });
    });

    test("draft blocks have deterministic types for known intents", async () => {
      const contact = await generatePageStructure("Kontakt oss", "nb");
      expect(contact.blocks.some((b) => b.type === "hero")).toBe(true);
      expect(contact.blocks.some((b) => b.type === "cta")).toBe(true);
    });
  });

  describe("generatePageFromStructuredInput", () => {
    test("returns valid draft with blocks and summary for landing pageType", () => {
      const out = generatePageFromStructuredInput({
        pageType: "landing",
        locale: "nb",
        goal: "lead",
        audience: "HR",
        ctaIntent: "demo",
      });
      expect(out.title).toBeDefined();
      expect(out.summary).toBeDefined();
      expect(Array.isArray(out.blocks)).toBe(true);
      expect(out.blocks.length).toBeGreaterThan(0);
      expect(out.blocks[0].type).toBe("hero");
    });

    test("draft is deterministic for same input (no LLM)", () => {
      const input = {
        pageType: "landing" as const,
        locale: "nb" as const,
        goal: "lead",
        audience: "HR",
        ctaIntent: "demo" as const,
      };
      const a = generatePageFromStructuredInput(input);
      const b = generatePageFromStructuredInput(input);
      expect(a.blocks.length).toBe(b.blocks.length);
      expect(a.title).toBe(b.title);
      a.blocks.forEach((block, i) => {
        expect(block.type).toBe(b.blocks[i].type);
      });
    });
  });
});
