// tests/cms/renderBlock.test.ts
// @ts-nocheck

import { describe, test, expect } from "vitest";
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

  test("renders a visible warning for unknown block type in staging env", () => {
    const out = renderBlock(
      { id: "x", type: "unknown-type", data: { foo: "bar" } },
      "staging",
      "nb"
    );
    expect(out).not.toBeNull();
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
    const h1 = (out as any)?.props?.children?.[0];
    expect(h1?.props?.children).toBe("Line one\nLine two");
  });

  test("richText block normalizes body line endings", () => {
    const out = renderBlock(
      { id: "r1", type: "richText", data: { body: "Para one\\nPara two" } },
      "prod",
      "nb"
    );
    expect(out).not.toBeNull();
    const bodyDiv = (out as any)?.props?.children?.[1];
    expect(bodyDiv?.props?.children).toBe("Para one\nPara two");
  });
});

describe("renderBlock — key block types (block editor behavior)", () => {
  test("form block without formId shows amber message", () => {
    const out = renderBlock(
      { id: "f1", type: "form", data: { title: "Skjema" } },
      "prod",
      "nb"
    );
    expect(out).not.toBeNull();
    expect((out as any)?.props?.children).toContain("Skjema-blokk mangler formId");
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

  test("divider or unsupported type in prod returns null (no crash)", () => {
    const out = renderBlock(
      { id: "d1", type: "divider", data: {} },
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
});

describe("renderBlock — premium typography tokens (preview/public parity)", () => {
  function collectClassNames(el: any): string {
    if (!el?.props) return "";
    const parts = [el.props.className].filter(Boolean);
    const children = Array.isArray(el.props.children) ? el.props.children : [el.props.children];
    for (const c of children) {
      if (c && typeof c === "object" && c.props) parts.push(collectClassNames(c));
    }
    return parts.join(" ");
  }

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
    const classNames = collectClassNames(out);
    expect(classNames).toContain("font-display");
    expect(classNames).toContain("font-body");
    expect(classNames).toContain("font-ui");
  });

  test("richText block uses font-heading and font-body", () => {
    const out = renderBlock(
      { id: "r1", type: "richText", data: { heading: "Overskrift", body: "Brødtekst" } },
      "prod",
      "nb"
    );
    expect(out).not.toBeNull();
    const classNames = collectClassNames(out);
    expect(classNames).toContain("font-heading");
    expect(classNames).toContain("font-body");
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
    const classNames = collectClassNames(out);
    expect(classNames).toContain("font-heading");
    expect(classNames).toContain("font-body");
    expect(classNames).toContain("font-ui");
  });
});

