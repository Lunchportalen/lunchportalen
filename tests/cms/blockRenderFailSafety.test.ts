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

  test("returns explicit warning element for unknown block type in staging env", () => {
    const node = renderBlock({ id: "u2", type: "unknown_type", data: {} }, "staging", "nb");
    expect(node).not.toBeNull();

    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, node));
    expect(html).toContain("Ukjent blokktype i innhold");
    expect(html).toContain("unknown_type");
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

