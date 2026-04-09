"use client";

import { AiTextAssistPopover } from "@/components/cms";
import type { BlockInspectorFieldsCtx } from "../blockPropertyEditorContract";
import type { HeroFullBlock } from "../editorBlockTypes";
import { PropertyEditorSection } from "../PropertyEditorSection";
import { useBlockDatasetAdapter } from "../useBlockDatasetAdapter";
import { PropertyEditorPreviewHint } from "./PropertyEditorPreviewHint";

/** Full-width hero med valgfri gradient — data-type: `hero_full`. U91: bilde i `contentData`, gradient i `settingsData`. */
export function HeroFullPropertyEditor(props: { block: HeroFullBlock; ctx: BlockInspectorFieldsCtx }) {
  const { block, ctx } = props;
  const { commit } = useBlockDatasetAdapter(block, ctx.setBlockById);
  const cd = block.contentData;
  const sd = block.settingsData;
  const { setMediaPickerTarget, setMediaPickerOpen, isOffline } = ctx;

  return (
    <div
      className="grid gap-3"
      data-lp-property-editor-root="hero_full"
      data-lp-property-editor-component="HeroFullPropertyEditor"
    >
      <PropertyEditorPreviewHint blockType={block.type} />
      <PropertyEditorSection section="content" overline="Innhold · budskap, media og CTA">
        <p className="text-[11px] text-[rgb(var(--lp-muted))]">
          Åpen, trygg forside-følelse. Skiller seg fra standard-hero (innholdsbredde) og fra kant-til-kant-hero (kampanje/dramatikk).
        </p>
        <label className="grid gap-1 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[rgb(var(--lp-muted))]">Tittel</span>
            <AiTextAssistPopover
              fieldLabel="Hero full tittel"
              value={cd.title}
              disabled={isOffline}
              onApply={(t) =>
                commit((c) => (c.type === "hero_full" ? { ...c, contentData: { ...c.contentData, title: t } } : c))
              }
            />
          </div>
          <input
            value={cd.title}
            onChange={(e) =>
              commit((c) =>
                c.type === "hero_full" ? { ...c, contentData: { ...c.contentData, title: e.target.value } } : c,
              )
            }
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[rgb(var(--lp-muted))]">Undertittel</span>
            <AiTextAssistPopover
              fieldLabel="Hero full undertittel"
              value={cd.subtitle || ""}
              disabled={isOffline}
              onApply={(t) =>
                commit((c) => (c.type === "hero_full" ? { ...c, contentData: { ...c.contentData, subtitle: t } } : c))
              }
            />
          </div>
          <textarea
            value={cd.subtitle || ""}
            onChange={(e) =>
              commit((c) =>
                c.type === "hero_full" ? { ...c, contentData: { ...c.contentData, subtitle: e.target.value } } : c,
              )
            }
            rows={3}
            className="rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Bilde (ID / URL)</span>
          <div className="flex gap-2">
            <input
              value={cd.imageId || ""}
              onChange={(e) =>
                commit((c) =>
                  c.type === "hero_full" ? { ...c, contentData: { ...c.contentData, imageId: e.target.value } } : c,
                )
              }
              className="h-10 flex-1 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                setMediaPickerTarget({ blockId: block.id, field: "heroImageUrl" });
                setMediaPickerOpen(true);
              }}
              className="shrink-0 rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-xs font-medium"
            >
              Mediearkiv
            </button>
          </div>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Alt-tekst</span>
          <input
            value={cd.imageAlt || ""}
            onChange={(e) =>
              commit((c) =>
                c.type === "hero_full" ? { ...c, contentData: { ...c.contentData, imageAlt: e.target.value } } : c,
              )
            }
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-[rgb(var(--lp-muted))]">CTA</span>
            <input
              value={cd.ctaLabel || ""}
              onChange={(e) =>
                commit((c) =>
                  c.type === "hero_full" ? { ...c, contentData: { ...c.contentData, ctaLabel: e.target.value } } : c,
                )
              }
              className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[rgb(var(--lp-muted))]">CTA-lenke</span>
            <input
              value={cd.ctaHref || ""}
              onChange={(e) =>
                commit((c) =>
                  c.type === "hero_full" ? { ...c, contentData: { ...c.contentData, ctaHref: e.target.value } } : c,
                )
              }
              className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
            />
          </label>
        </div>
      </PropertyEditorSection>
      <PropertyEditorSection section="settings" overline="Presentasjon · gradient">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2">
          <span className="text-sm text-[rgb(var(--lp-text))]">Gradient over bilde</span>
          <button
            type="button"
            onClick={() =>
              commit((c) =>
                c.type === "hero_full"
                  ? {
                      ...c,
                      settingsData: { ...c.settingsData, useGradient: !(c.settingsData.useGradient !== false) },
                    }
                  : c,
              )
            }
            className={`relative h-6 w-11 rounded-full border ${sd.useGradient !== false ? "border-slate-500 bg-slate-300" : "border-[rgb(var(--lp-border))] bg-slate-100"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${sd.useGradient !== false ? "left-5" : "left-0.5"}`}
            />
          </button>
        </div>
      </PropertyEditorSection>
      <PropertyEditorSection section="structure" overline="Struktur">
        <p className="text-[11px] text-[rgb(var(--lp-muted))]">Én flate — ingen liste over underelementer.</p>
      </PropertyEditorSection>
    </div>
  );
}
