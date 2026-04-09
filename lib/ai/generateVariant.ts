import type { BlockList } from "@/lib/cms/model/blockTypes";

/**
 * Deterministisk «variant B» av CMS-body (synkron, ingen LLM).
 * Brukes av singularity-/vekst-simulatorer og tester.
 */
export function generateVariant(base: BlockList): BlockList {
  const blocks = base.blocks.map((b) => {
    if (b.type === "hero" && b.data && typeof b.data === "object") {
      const d = { ...b.data } as Record<string, unknown>;
      const title = typeof d.title === "string" ? d.title : "";
      d.title = title.includes("Variant B") ? title : `${title} — Variant B`.trim();
      return { ...b, data: d };
    }
    if (b.type === "cta" && b.data && typeof b.data === "object") {
      const d = { ...b.data } as Record<string, unknown>;
      const label = typeof d.buttonLabel === "string" ? d.buttonLabel : "";
      d.buttonLabel = label.includes("→") ? label : `${label} →`.trim();
      return { ...b, data: d };
    }
    return b;
  });

  const meta = {
    ...(typeof base.meta === "object" && base.meta && !Array.isArray(base.meta) ? base.meta : {}),
    croVariant: "B",
  };

  return { version: 1, blocks, meta };
}
