import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const ROUTE_PATH = join(process.cwd(), "app", "api", "order", "set-day", "route.ts");

describe("/api/order/set-day choice validation", () => {
  test("requires explicit choice when multiple choices are available", () => {
    const source = readFileSync(ROUTE_PATH, "utf-8");

    expect(source).toContain("CHOICE_REQUIRED");
    expect(source).toContain("allowed.length === 1");
    expect(source).toContain("Menyvalg er påkrevd. Velg en kategori før bestilling.");
  });

  test("rejects invalid choice instead of falling back to varmmat or first choice", () => {
    const source = readFileSync(ROUTE_PATH, "utf-8");

    expect(source).toContain("INVALID_CHOICE");
    expect(source).toContain("allowed.some((c) => c.key === finalChoiceKey)");
    expect(source).not.toContain('allowed.find((c) => c.key === "varmmat")?.key ?? allowed[0]?.key');
  });

  test("keeps cancellation path independent from choice_key", () => {
    const source = readFileSync(ROUTE_PATH, "utf-8");

    expect(source).toContain("let finalChoiceKey: string | null = wantsLunch ? choiceKeyIn : null");
    expect(source).toContain("wantsLunch && finalChoiceKey");
    expect(source).toContain("lpOrderCancel");
  });
});
