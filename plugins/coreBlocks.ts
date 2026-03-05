/**
 * Phase 18: Core blocks plugin.
 * Mirrors previous hardcoded BLOCK_REGISTRY.
 */

import type { CMSPlugin } from "@/lib/cms/plugins/types";

export const plugin: CMSPlugin = {
  id: "core-blocks",
  name: "Core blocks",
  enabledByDefault: true,
  blocks: [
    {
      type: "hero",
      label: "Hero",
      description: "Stor toppseksjon med tittel, tekst og knapp.",
      category: "marketing",
      defaults: () => ({
        title: "",
        subtitle: "",
        imageUrl: "",
        imageAlt: "",
        ctaLabel: "",
        ctaHref: "",
      }),
      previewText: (d) => String(d?.title ?? d?.heading ?? "Hero"),
    },
    {
      type: "richText",
      label: "Rich text",
      description: "Fleksibel tekstblokk med overskrift og brødtekst.",
      category: "content",
      defaults: () => ({ heading: "", body: "" }),
      previewText: (d) => String(d?.heading ?? d?.body ?? "Empty rich text"),
    },
    {
      type: "image",
      label: "Image",
      description: "Bildeblokk med alt-tekst og bildetekst.",
      category: "content",
      defaults: () => ({ assetPath: "", alt: "", caption: "" }),
      previewText: (d) => String(d?.alt ?? d?.caption ?? d?.assetPath ?? "Empty image"),
    },
    {
      type: "cta",
      label: "Call to action",
      description: "Avsnitt med tydelig handling og knapp.",
      category: "marketing",
      defaults: () => ({ title: "", body: "", buttonLabel: "", buttonHref: "" }),
      previewText: (d) => String(d?.title ?? d?.buttonLabel ?? "Empty CTA"),
    },
    {
      type: "banners",
      label: "Banners",
      description: "Samling av mindre bannere med lenker.",
      category: "marketing",
      defaults: () => ({ items: [] }),
      previewText: () => "Banners",
    },
    {
      type: "divider",
      label: "Divider",
      description: "Enkel visuell separator mellom innholdsseksjoner.",
      category: "layout",
      defaults: () => ({}),
      previewText: () => "Visual divider",
    },
    {
      type: "code",
      label: "Code",
      description: "Kodeblokk for teknisk innhold eller eksempler.",
      category: "system",
      defaults: () => ({
        code: "",
        behaviour: "display" as const,
        displayIntro: false,
        displayOutro: false,
      }),
      previewText: () => "Code snippet",
    },
    {
      type: "windows",
      label: "Windows-style layout",
      description: "Flerkolonne-layout for avansert innhold (placeholder).",
      category: "layout",
      defaults: () => ({}),
      previewText: () => "Windows-style layout",
    },
    {
      type: "form",
      label: "Form",
      description: "Embed a form",
      category: "content",
      defaults: () => ({
        formId: "",
        title: "Form",
      }),
      previewText: (d) => String(d?.title ?? "Form"),
    },
  ],
};
