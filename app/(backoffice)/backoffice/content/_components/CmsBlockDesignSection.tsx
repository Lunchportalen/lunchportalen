"use client";

import { useMemo } from "react";

/**
 * Blokk-nivå design (token/preset) — oppdaterer kun `block.config` per designContract.
 * Ingen fri CSS; verdier er begrenset til tillatte enumerations.
 */

import type { Block } from "./editorBlockTypes";
import { safeObj } from "./contentWorkspace.helpers";
import {
  CMS_META_SECTION_DESIGN_KEY,
  type BlockLayout,
  type BlockTheme,
  type CardHover,
  type CardVariant,
} from "@/lib/cms/design/designContract";

const VARIANTS: CardVariant[] = ["default", "glass", "elevated", "flat"];
const HOVERS: CardHover[] = ["none", "lift", "glow"];
const THEMES: BlockTheme[] = ["default", "dark", "highlight"];
const LAYOUTS: BlockLayout[] = ["standard", "full", "split"];

export type CmsBlockDesignSectionProps = {
  block: Block;
  setBlockById: (id: string, updater: (b: Block) => Block) => void;
  /** When set, «Seksjon» lists `meta.sectionDesign` keys for `config.sectionId`. */
  meta?: Record<string, unknown>;
};

export function CmsBlockDesignSection({ block, setBlockById, meta }: CmsBlockDesignSectionProps) {
  const cfg = block.config ?? {};
  const card = cfg.card ?? {};
  const variant = (card.variant as CardVariant | undefined) ?? "default";
  const hover = (card.hover as CardHover | undefined) ?? "none";
  const theme = cfg.theme ?? "default";
  const layout = cfg.layout ?? "standard";
  const sectionId = typeof cfg.sectionId === "string" ? cfg.sectionId : "";
  const sectionKeys = useMemo(() => {
    const m = meta?.[CMS_META_SECTION_DESIGN_KEY];
    return Object.keys(safeObj(m)).sort();
  }, [meta]);

  const patch = (next: Partial<NonNullable<Block["config"]>>) => {
    setBlockById(block.id, (b) => ({
      ...b,
      config: { ...(b.config ?? {}), ...next },
    }));
  };

  return (
    <section
      className="space-y-3 rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 p-3 shadow-[var(--lp-shadow-soft)] backdrop-blur-sm"
      aria-labelledby="cms-block-design-heading"
    >
      <div>
        <h3 id="cms-block-design-heading" className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
          CMS-design (blokk)
        </h3>
        <p className="mt-1 text-[11px] leading-snug text-[rgb(var(--lp-muted))]">
          Overstyr globale kort-preset for denne blokken. Verdier lagres i <code className="text-[10px]">config</code> — samme
          pipeline som forhåndsvisning og publisering.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-[11px]">
          <span className="font-medium text-[rgb(var(--lp-text))]">Tema</span>
          <select
            className="h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-2 text-sm"
            value={theme}
            onChange={(e) => patch({ theme: e.target.value as BlockTheme })}
          >
            {THEMES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {meta ? (
          <label className="grid gap-1 text-[11px] sm:col-span-2">
            <span className="font-medium text-[rgb(var(--lp-text))]">Seksjon (valgfritt)</span>
            <select
              className="h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-2 text-sm"
              value={sectionId}
              onChange={(e) => {
                const v = e.target.value.trim();
                patch({ sectionId: v || undefined });
              }}
            >
              <option value="">— Ingen —</option>
              {sectionId && !sectionKeys.includes(sectionId) ? (
                <option value={sectionId}>{sectionId} (ukjent)</option>
              ) : null}
              {sectionKeys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-[rgb(var(--lp-muted))]">
              Opprett seksjoner under «CMS-design (seksjon)» på samme fane.
            </span>
          </label>
        ) : null}
        <label className="grid gap-1 text-[11px]">
          <span className="font-medium text-[rgb(var(--lp-text))]">Layout (blokk)</span>
          <select
            className="h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-2 text-sm"
            value={layout}
            onChange={(e) => patch({ layout: e.target.value as BlockLayout })}
          >
            {LAYOUTS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[11px]">
          <span className="font-medium text-[rgb(var(--lp-text))]">Kort-variant</span>
          <select
            className="h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-2 text-sm"
            value={variant}
            onChange={(e) =>
              patch({
                card: { ...card, variant: e.target.value as CardVariant },
              })
            }
          >
            {VARIANTS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[11px]">
          <span className="font-medium text-[rgb(var(--lp-text))]">Hover</span>
          <select
            className="h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-2 text-sm"
            value={hover}
            onChange={(e) =>
              patch({
                card: { ...card, hover: e.target.value as CardHover },
              })
            }
          >
            {HOVERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
