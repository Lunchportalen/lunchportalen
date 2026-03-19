/**
 * Unit tests for AI page builder: prompt-aware deterministic structure.
 * Phase 3: intent detection and template selection; no LLM.
 */

import { describe, test, expect } from "vitest";
import { generatePageStructure, generatePageFromStructuredInput } from "@/lib/ai/tools/pageBuilder";

describe("generatePageStructure", () => {
  test("returns empty blocks and warning when prompt is empty", async () => {
    const out = await generatePageStructure("", "nb");
    expect(out.blocks).toEqual([]);
    expect(out.warnings).toContain("Tom prompt.");
  });

  test("trims prompt and returns generic/landing when no intent keywords", async () => {
    const out = await generatePageStructure("  Noe generelt innhold  ", "nb");
    expect(out.blocks.length).toBeGreaterThan(0);
    expect(out.title).toBe("Noe generelt innhold");
    expect(out.blocks[0].type).toBe("hero");
  });

  test("contact intent: prompt contains 'kontakt'", async () => {
    const out = await generatePageStructure("Kontakt oss for mer info", "nb");
    expect(out.blocks.length).toBe(3);
    expect(out.blocks[0].type).toBe("hero");
    expect((out.blocks[0].data as Record<string, string>).title).toBe("Kontakt oss");
    expect(out.blocks[2].type).toBe("cta");
  });

  test("pricing intent: prompt contains 'priser'", async () => {
    const out = await generatePageStructure("Se våre priser og pakker", "nb");
    expect(out.blocks.length).toBe(3);
    expect((out.blocks[0].data as Record<string, string>).title).toMatch(/pakker|pris/i);
  });

  test("info intent: prompt contains 'hvordan'", async () => {
    const out = await generatePageStructure("Hvordan fungerer det?", "nb");
    expect(out.blocks.length).toBe(5);
    expect((out.blocks[0].data as Record<string, string>).title).toMatch(/fungerer|works/i);
  });

  test("locale en returns English copy", async () => {
    const out = await generatePageStructure("Contact us", "en");
    expect(out.blocks.length).toBe(3);
    expect((out.blocks[0].data as Record<string, string>).title).toBe("Contact us");
  });

  test("title is derived from prompt words (max ~80 chars)", async () => {
    const long = "A".repeat(100);
    const out = await generatePageStructure(long, "nb");
    expect(out.title).toBeDefined();
    expect((out.title ?? "").length).toBeLessThanOrEqual(80);
  });
});

describe("generatePageFromStructuredInput", () => {
  test("returns draft blocks for landing pageType", () => {
    const out = generatePageFromStructuredInput({
      pageType: "landing",
      locale: "nb",
      goal: "lead",
      audience: "HR",
      ctaIntent: "demo",
    });
    expect(out.blocks.length).toBeGreaterThan(0);
    expect(out.blocks[0].type).toBe("hero");
    expect(out.summary).toMatch(/Utkast|Draft|kladd/i);
  });

  test("filters by sectionsExclude", () => {
    const out = generatePageFromStructuredInput({
      pageType: "landing",
      locale: "nb",
      sectionsExclude: ["cta"],
    });
    const hasCta = out.blocks.some((b) => b.type === "cta");
    expect(hasCta).toBe(false);
  });

  test("uses prompt for title when provided", () => {
    const out = generatePageFromStructuredInput({
      prompt: "Min kampanjeside",
      pageType: "landing",
      locale: "nb",
    });
    expect(out.title).toBe("Min kampanjeside");
  });
});
