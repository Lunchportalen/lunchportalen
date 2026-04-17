// tests/cms/renderBlock.test.ts
// @ts-nocheck

import { describe, test, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderBlock, normalizeDisplayText } from "@/lib/public/blocks/renderBlock";

describe("renderBlock — unknown types and malformed data", () => {
  test("returns null for unknown block type in prod env", () => {
    const out = renderBlock(
      { id: "x", type: "unknown-type", data: { foo: "bar" } },
      "prod",
      "nb"
    );
    expect(out).toBeNull();
  });

  test("returns null for unknown block type in staging env (no fallback markup)", () => {
    const out = renderBlock(
      { id: "x", type: "unknown-type", data: { foo: "bar" } },
      "staging",
      "nb"
    );
    expect(out).toBeNull();
  });

  test("handles missing data object safely", () => {
    const out = renderBlock(
      // missing data; should not throw
      { id: "hero-1", type: "hero" } as any,
      "prod",
      "nb"
    );
    expect(out).not.toBeNull();
  });

  test("image block renders with src and alt (media path)", () => {
    const out = renderBlock(
      {
        id: "img-1",
        type: "image",
        data: {
          src: "https://cdn.example.com/hero.jpg",
          alt: "Hero bilde for lunsj",
          caption: "Optional caption",
        },
      },
      "prod",
      "nb"
    );
    expect(out).not.toBeNull();
    expect(out).toBeDefined();
  });
});

describe("renderBlock — display text normalization (no literal \\r\\n)", () => {
  test("normalizeDisplayText converts literal \\r\\n and \\n to newline", () => {
    expect(normalizeDisplayText("a\\r\\nb")).toBe("a\nb");
    expect(normalizeDisplayText("a\\nb")).toBe("a\nb");
    expect(normalizeDisplayText("a\r\nb")).toBe("a\nb");
    expect(normalizeDisplayText("a\rb")).toBe("a\nb");
    expect(normalizeDisplayText("")).toBe("");
  });

  test("hero block does not render literal \\r\\n in title", () => {
    const out = renderBlock(
      { id: "h1", type: "hero", data: { title: "Line one\\r\\nLine two" } },
      "prod",
      "nb"
    );
    expect(out).not.toBeNull();
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, out));
    expect(html).toContain("Line one");
    expect(html).toContain("Line two");
    expect(html).not.toContain("\\r\\n");
  });

  test("richText block normalizes body line endings", () => {
    const out = renderBlock(
      { id: "r1", type: "richText", data: { body: "Para one\\nPara two" } },
      "prod",
      "nb"
    );
    expect(out).not.toBeNull();
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, out));
    expect(html).toContain("Para one");
    expect(html).toContain("Para two");
    expect(html).not.toContain("\\n");
  });
});

describe("renderBlock — key block types (block editor behavior)", () => {
  test("form block without formId shows guidance message", () => {
    const out = renderBlock(
      { id: "f1", type: "form", data: { title: "Skjema" } },
      "prod",
      "nb"
    );
    expect(out).not.toBeNull();
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, out));
    expect(html).toContain("Skjemablokken mangler kilde");
  });

  test("form block with formId renders (FormBlock)", () => {
    const out = renderBlock(
      { id: "f2", type: "form", data: { formId: "contact-form", title: "Kontakt" } },
      "prod",
      "nb"
    );
    expect(out).not.toBeNull();
  });

  test("cta block renders with title, body and button", () => {
    const out = renderBlock(
      {
        id: "c1",
        type: "cta",
        data: { title: "CTA tittel", body: "Tekst", buttonLabel: "Klikk", href: "/path" },
      },
      "prod",
      "nb"
    );
    expect(out).not.toBeNull();
  });

  test("divider block renders horizontal rule container (no crash)", () => {
    const out = renderBlock(
      { id: "d1", type: "divider", data: {} },
      "prod",
      "nb"
    );
    expect(out).not.toBeNull();
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, out));
    expect(html).toContain("lp-container");
    expect(html).toContain("lp-section");
  });

  test("unsupported type in prod returns null (no crash)", () => {
    const out = renderBlock(
      { id: "u1", type: "totally_unknown_block_xyz", data: {} },
      "prod",
      "nb"
    );
    expect(out).toBeNull();
  });

  test("hero block with all fields renders", () => {
    const out = renderBlock(
      {
        id: "h1",
        type: "hero",
        data: { title: "Hero", subtitle: "Undertekst", ctaLabel: "Les mer", ctaHref: "/more" },
      },
      "prod",
      "nb"
    );
    expect(out).not.toBeNull();
  });

  test("hero_bleed block renders full-bleed shell and title", () => {
    const out = renderBlock(
      {
        id: "hb1",
        type: "hero_bleed",
        data: {
          title: "Kant til kant",
          backgroundImage: "https://example.com/bg.jpg",
          textAlign: "left",
          textPosition: "right",
          ctaPrimary: "Start",
          ctaPrimaryHref: "/start",
        },
      },
      "prod",
      "nb"
    );
    expect(out).not.toBeNull();
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, out));
    expect(html).toContain("Kant til kant");
    expect(html).toContain("w-screen");
    expect(html).toContain("max-w-[100vw]");
    expect(html).toContain("Start");
  });
});

describe("renderBlock — premium typography tokens (preview/public parity)", () => {
  test("hero block uses font-display, font-body, font-ui (no raw font-family)", () => {
    const out = renderBlock(
      {
        id: "h1",
        type: "hero",
        data: { title: "Tittel", subtitle: "Undertekst", ctaLabel: "Les mer", ctaHref: "/" },
      },
      "prod",
      "nb"
    );
    expect(out).not.toBeNull();
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, out));
    expect(html).toContain("font-display");
    expect(html).toContain("font-body");
    expect(html).toContain("font-ui");
  });

  test("richText block uses font-heading and font-body", () => {
    const out = renderBlock(
      { id: "r1", type: "richText", data: { heading: "Overskrift", body: "Brødtekst" } },
      "prod",
      "nb"
    );
    expect(out).not.toBeNull();
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, out));
    expect(html).toContain("font-heading");
    expect(html).toContain("font-body");
  });

  test("cta block uses font-heading, font-body, font-ui", () => {
    const out = renderBlock(
      {
        id: "c1",
        type: "cta",
        data: { title: "Tittel", body: "Tekst", buttonLabel: "Klikk", href: "/path" },
      },
      "prod",
      "nb"
    );
    expect(out).not.toBeNull();
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, out));
    expect(html).toContain("font-heading");
    expect(html).toContain("font-body");
    expect(html).toContain("font-ui");
  });
});

