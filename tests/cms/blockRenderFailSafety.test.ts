/**
 * CMS → Public block render fail-safety and determinism.
 *
 * Focus:
 * - Unknown block types in prod vs staging env
 * - Malformed / minimal payloads for known types
 * - Text normalization for line endings
 */
// @ts-nocheck

import { describe, test, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { renderBlock, normalizeDisplayText } from "@/lib/public/blocks/renderBlock";
import { normalizeBlockForRender } from "@/lib/cms/public/normalizeBlockForRender";

describe("renderBlock — unknown block types", () => {
  test("returns null for unknown block type in prod env (no misleading fallback)", () => {
    const node = renderBlock({ id: "u1", type: "unknown_type", data: {} }, "prod", "nb");
    expect(node).toBeNull();
  });

  test("returns null for unknown block type in staging env (no fallback markup)", () => {
    const node = renderBlock({ id: "u2", type: "unknown_type", data: {} }, "staging", "nb");
    expect(node).toBeNull();
  });
});

describe("renderBlock — known block types with minimal/malformed payloads", () => {
  test("hero block renders deterministically with missing optional fields", () => {
    const node = renderBlock({ id: "h1", type: "hero", data: {} }, "prod", "nb");
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, node));

    // Should render a section + h1 even when title/subtitle/cta are missing (empty text, no crash)
    expect(html).toContain("<section");
    expect(html).toContain("</section>");
  });

  test("richText block tolerates non-string heading/body values by stringifying", () => {
    const node = renderBlock(
      {
        id: "r1",
        type: "richText",
        data: {
          heading: 123,
          body: { nested: "value" },
        },
      },
      "prod",
      "nb",
    );

    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, node));
    // We don't assert exact markup, only that it renders without throwing and includes stringified content.
    expect(html).toContain("123");
    expect(html).toContain("[object Object]");
  });

  test("image block with missing src renders safe placeholder", () => {
    const node = renderBlock({ id: "img1", type: "image", data: {} }, "prod", "nb");
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, node));

    // Placeholder container should render instead of <img> when src is missing.
    expect(html).not.toContain("<img");
    expect(html).toContain("Bilde");
  });

  test("image block with non-string src renders safe placeholder (malformed payload)", () => {
    const node = renderBlock(
      { id: "img2", type: "image", data: { src: 123, alt: "x" } },
      "prod",
      "nb"
    );
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, node));
    expect(html).toContain("Bilde");
  });

  test("normalizeBlockForRender then renderBlock: image with assetPath resolves to img", () => {
    const raw = { id: "i1", type: "image", assetPath: "https://cdn.test/resolved.jpg", alt: "Resolved" };
    const node = normalizeBlockForRender(raw, 0);
    expect(node.data.src).toBe("https://cdn.test/resolved.jpg");
    const rendered = renderBlock(node, "prod", "nb");
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, rendered));
    expect(html).toContain("https://cdn.test/resolved.jpg");
    expect(html).toContain("Resolved");
  });

  test("normalizeBlockForRender then renderBlock: newsletter_signup", () => {
    const raw = {
      id: "nl1",
      type: "newsletter_signup",
      data: {
        eyebrow: "Hold deg oppdatert",
        title: "Nyhetsbrev",
        lede: "Korte tips om lunsj og drift — maks én e-post i uken.",
        ctaLabel: "Meld meg på",
        ctaHref: "https://example.test/subscribe",
        disclaimer: "Du kan når som helte melde deg av.",
        submitMethod: "get",
        contentWidth: "narrow",
        variant: "center",
      },
    };
    const node = normalizeBlockForRender(raw, 0);
    expect(node.type).toBe("newsletter_signup");
    const rendered = renderBlock(node, "prod", "nb");
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, rendered));
    expect(html).toContain("Nyhetsbrev");
    expect(html).toContain('name="email"');
    expect(html).toContain("https://example.test/subscribe");
    expect(html).toContain("melde deg av");
  });

  test("normalizeBlockForRender then renderBlock: form_embed with https iframeSrc", () => {
    const raw = {
      id: "fe1",
      type: "form_embed",
      data: {
        formId: "",
        iframeSrc: "https://example.test/form-widget",
        title: "Kontakt oss",
        lede: "Fyll ut skjemaet hos leverandøren.",
        embedHtml: "",
        contentWidth: "normal",
        variant: "center",
      },
    };
    const node = normalizeBlockForRender(raw, 0);
    expect(node.type).toBe("form_embed");
    const rendered = renderBlock(node, "prod", "nb");
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, rendered));
    expect(html).toContain("https://example.test/form-widget");
    expect(html).toContain("Kontakt oss");
    expect(html).toContain("Fyll ut skjemaet");
    expect(html).toContain("<iframe");
  });

  test("normalizeBlockForRender then renderBlock: form_embed rejects non-https iframeSrc", () => {
    const raw = {
      id: "fe2",
      type: "form_embed",
      data: {
        formId: "",
        iframeSrc: "http://insecure.test/x",
        title: "",
        lede: "",
        embedHtml: "",
        contentWidth: "normal",
        variant: "center",
      },
    };
    const node = normalizeBlockForRender(raw, 0);
    const rendered = renderBlock(node, "prod", "nb");
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, rendered));
    expect(html).not.toContain("<iframe");
    expect(html).toContain("Skjemablokken mangler kilde");
  });

  test("normalizeBlockForRender then renderBlock: quote_block (editorial)", () => {
    const raw = {
      id: "qb1",
      type: "quote_block",
      data: {
        quote: "Kontroll og forutsigbarhet slår hype.",
        author: "Redaksjonen",
        role: "Lunchportalen",
        source: "Årsrapport 2025",
        contentWidth: "narrow",
        variant: "left",
      },
    };
    const node = normalizeBlockForRender(raw, 0);
    expect(node.type).toBe("quote_block");
    const rendered = renderBlock(node, "prod", "nb");
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, rendered));
    expect(html).toContain("forutsigbarhet");
    expect(html).toContain("Redaksjonen");
    expect(html).toContain("Årsrapport");
    expect(html).toContain("<blockquote");
  });

  test("normalizeBlockForRender then renderBlock: testimonial_block (testimonialsJson)", () => {
    const raw = {
      id: "tb1",
      type: "testimonial_block",
      data: {
        sectionTitle: "Stemmer fra kundene",
        testimonialsJson: JSON.stringify([
          {
            id: "1",
            quote: "Lunsjen kommer alltid presis.",
            author: "Kari Nordmann",
            role: "HR-leder",
            company: "Eksempel AS",
            image: "",
            alt: "",
            logo: "",
          },
        ]),
        density: "comfortable",
        variant: "center",
      },
    };
    const node = normalizeBlockForRender(raw, 0);
    expect(node.type).toBe("testimonial_block");
    const rendered = renderBlock(node, "prod", "nb");
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, rendered));
    expect(html).toContain("Stemmer fra kundene");
    expect(html).toContain("presis");
    expect(html).toContain("Kari Nordmann");
    expect(html).toContain("Eksempel AS");
  });

  test("normalizeBlockForRender then renderBlock: stats_block (kpisJson + columns)", () => {
    const raw = {
      id: "st1",
      type: "stats_block",
      data: {
        title: "Nøkkeltall",
        kpisJson: JSON.stringify([
          { id: "a", value: "99 %", label: "Fornøyde kunder", subtext: "Siste 12 mnd", emphasis: true },
          { id: "b", value: "24t", label: "Svartid", icon: "⚡" },
        ]),
        density: "comfortable",
        columns: "2",
        variant: "center",
      },
    };
    const node = normalizeBlockForRender(raw, 0);
    expect(node.type).toBe("stats_block");
    const rendered = renderBlock(node, "prod", "nb");
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, rendered));
    expect(html).toContain("Nøkkeltall");
    expect(html).toContain("99 %");
    expect(html).toContain("Fornøyde");
    expect(html).toContain("24t");
  });

  test("normalizeBlockForRender then renderBlock: logo_cloud (logosJson + density)", () => {
    const raw = {
      id: "lc1",
      type: "logo_cloud",
      data: {
        title: "Stoler på oss",
        logosJson: JSON.stringify([
          { id: "a", image: "https://cdn.test/a.svg", label: "Partner A", href: "https://partner.example" },
          { id: "b", image: "https://cdn.test/b.svg", label: "", href: "" },
        ]),
        density: "comfortable",
        variant: "center",
      },
    };
    const node = normalizeBlockForRender(raw, 0);
    expect(node.type).toBe("logo_cloud");
    const rendered = renderBlock(node, "prod", "nb");
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, rendered));
    expect(html).toContain("Stoler på oss");
    expect(html).toContain("https://cdn.test/a.svg");
    expect(html).toContain("https://cdn.test/b.svg");
  });

  test("normalizeBlockForRender then renderBlock: section_intro (eyebrow, title, lede)", () => {
    const raw = {
      id: "si1",
      type: "section_intro",
      data: {
        eyebrow: "Del 2",
        title: "Hvorfor Lunchportalen",
        lede: "Kort ingress som rammer inn seksjonen.",
        contentWidth: "narrow",
        variant: "center",
      },
    };
    const node = normalizeBlockForRender(raw, 0);
    expect(node.type).toBe("section_intro");
    const rendered = renderBlock(node, "prod", "nb");
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, rendered));
    expect(html).toContain("Hvorfor Lunchportalen");
    expect(html).toContain("Del 2");
    expect(html).toContain("Kort ingress");
    expect(html).toContain("<section");
  });
});

describe("normalizeDisplayText — line ending normalization", () => {
  test("normalizes various escaped/newline formats to single \\n", () => {
    const input = "Linje 1\\r\\nLinje 2\\nLinje 3\r\nLinje 4\rLinje 5";
    const normalized = normalizeDisplayText(input);

    // No raw CR characters; all line breaks should use \n.
    expect(normalized).not.toContain("\r");
    expect(normalized.split("\n").length).toBeGreaterThan(1);
  });
}
);

