/**
 * Motion system proof: shared primitives, reduced-motion, and preview/public parity.
 * Focused tests only; no snapshot spam or broad UI regression.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { motionTokens, motionClasses } from "@/lib/ui/motionTokens";
import { renderBlock } from "@/lib/public/blocks/renderBlock";
import type { ReactElement } from "react";

const ROOT = process.cwd();

function getSectionClassName(out: unknown): string | undefined {
  const el = out as ReactElement<{ className?: string }> | null;
  return el?.props?.className;
}

describe("Motion system proof — shared primitives", () => {
  test("motionTokens has required durations and ease", () => {
    expect(motionTokens.durationFast).toBe("120ms");
    expect(motionTokens.durationNormal).toBe("200ms");
    expect(motionTokens.durationEnter).toBe("220ms");
    expect(motionTokens.ease).toBe("cubic-bezier(0.2, 0.8, 0.2, 1)");
  });

  test("motionClasses exports all shared motion class names used by motion.css", () => {
    const classes = Object.values(motionClasses);
    expect(classes).toContain("lp-motion-btn");
    expect(classes).toContain("lp-motion-card");
    expect(classes).toContain("lp-motion-overlay");
    expect(classes).toContain("lp-motion-row");
    expect(classes).toContain("lp-motion-control");
    expect(classes).toContain("lp-motion-opacity");
    expect(classes.every((c) => typeof c === "string" && c.startsWith("lp-motion-"))).toBe(true);
  });
});

describe("Motion system proof — reduced-motion in motion.css", () => {
  test("motion.css contains prefers-reduced-motion and disables transition on all motion classes", () => {
    const css = readFileSync(join(ROOT, "lib", "ui", "motion.css"), "utf-8");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("transition: none !important");
    const requiredInReduce = [
      "lp-motion-btn",
      "lp-motion-card",
      "lp-motion-overlay",
      "lp-motion-row",
      "lp-motion-control",
      "lp-motion-switch",
      "lp-motion-switch-thumb",
      "lp-motion-icon",
      "lp-motion-opacity",
    ];
    for (const name of requiredInReduce) {
      expect(css).toContain(name);
    }
  });
});

describe("Motion system proof — reduced-motion in globals.css", () => {
  test("globals.css reduced-motion block covers hero, shine, buttons, cards, link, related-card, section-img, Tailwind animations", () => {
    const css = readFileSync(join(ROOT, "app", "globals.css"), "utf-8");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".lp-hero-frame");
    expect(css).toContain(".lp-shine");
    expect(css).toContain(".lp-btn");
    expect(css).toContain(".lp-card");
    expect(css).toContain(".lp-nav-item");
    expect(css).toContain(".lp-link");
    expect(css).toContain(".lp-related-card");
    expect(css).toContain(".lp-section-img");
    expect(css).toContain(".animate-pulse");
    expect(css).toContain(".animate-spin");
  });
});

describe("Motion system proof — renderBlock uses shared motion (preview/public parity)", () => {
  test("hero block output includes lp-motion-card", () => {
    const out = renderBlock({ id: "h1", type: "hero", data: { title: "T" } }, "prod", "nb");
    expect(getSectionClassName(out)).toContain("lp-motion-card");
  });

  test("richText block output includes lp-motion-card", () => {
    const out = renderBlock({ id: "r1", type: "richText", data: {} }, "prod", "nb");
    expect(getSectionClassName(out)).toContain("lp-motion-card");
  });

  test("cta block output includes lp-motion-card", () => {
    const out = renderBlock({ id: "c1", type: "cta", data: {} }, "prod", "nb");
    expect(getSectionClassName(out)).toContain("lp-motion-card");
  });

  test("image block output includes lp-motion-card", () => {
    const out = renderBlock({ id: "i1", type: "image", data: {} }, "prod", "nb");
    expect(getSectionClassName(out)).toContain("lp-motion-card");
  });

  test("form block with formId wraps in lp-motion-card", () => {
    const out = renderBlock(
      { id: "f1", type: "form", data: { formId: "contact", title: "Kontakt" } },
      "prod",
      "nb"
    );
    const el = out as ReactElement<{ className?: string; children?: unknown }> | null;
    expect(el).not.toBeNull();
    expect(el?.props?.className).toContain("lp-motion-card");
  });
});
