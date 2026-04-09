"use client";

import { AiTextAssistPopover } from "@/components/cms";
import type { BlockInspectorFieldsCtx } from "../blockPropertyEditorContract";
import type { HeroBlock } from "../editorBlockTypes";
import { PropertyEditorSection } from "../PropertyEditorSection";
import { useBlockDatasetAdapter } from "../useBlockDatasetAdapter";
import { PropertyEditorPreviewHint } from "./PropertyEditorPreviewHint";

/** Standard hero — innholdsbredden. Data-type: `hero`. U91: `contentData` + tom `settingsData`. */
export function HeroPropertyEditor(props: { block: HeroBlock; ctx: BlockInspectorFieldsCtx }) {
  const { block, ctx } = props;
  const { commit } = useBlockDatasetAdapter(block, ctx.setBlockById);
  const cd = block.contentData;
  const {
    setMediaPickerTarget,
    setMediaPickerOpen,
    isOffline,
    effectiveId,
    aiBusyToolId,
    handleAiStructuredIntent,
  } = ctx;

  return (
    <div
      className="grid gap-3"
      data-lp-property-editor-root="hero"
      data-lp-property-editor-component="HeroPropertyEditor"
    >
      <PropertyEditorPreviewHint blockType={block.type} />
      <PropertyEditorSection section="content" overline="Innhold · budskap, media og handling">
        <p className="text-[11px] text-[rgb(var(--lp-muted))]">
          Tittel, undertittel, valgfritt bilde og én primær CTA. Bruk denne når heroen skal ligge i innholdsbredden (ikke
          kant-til-kant).
        </p>
        <label className="grid gap-1 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[rgb(var(--lp-muted))]">Tittel</span>
            <div className="flex shrink-0 items-center gap-1">
              <AiTextAssistPopover
                fieldLabel="Hero-tittel"
                value={cd.title}
                disabled={isOffline}
                onApply={(t) =>
                  commit((c) => (c.type === "hero" ? { ...c, contentData: { ...c.contentData, title: t } } : c))
                }
              />
              <button
                type="button"
                className="inline-flex items-center justify-center rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-0.5 text-[10px] font-medium text-[rgb(var(--lp-text))] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-50"
                disabled={isOffline || !effectiveId || aiBusyToolId === "experiment.generate.variants"}
                onClick={() =>
                  handleAiStructuredIntent?.({ variantCount: 2, target: "hero_only" }, { fromPanel: false })
                }
              >
                {aiBusyToolId === "experiment.generate.variants" ? "Kjører…" : "Generer bedre overskrift"}
              </button>
            </div>
          </div>
          <input
            value={cd.title}
            onChange={(e) =>
              commit((c) =>
                c.type === "hero" ? { ...c, contentData: { ...c.contentData, title: e.target.value } } : c,
              )
            }
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[rgb(var(--lp-muted))]">Undertittel</span>
            <AiTextAssistPopover
              fieldLabel="Hero-undertittel"
              value={cd.subtitle || ""}
              disabled={isOffline}
              onApply={(t) =>
                commit((c) => (c.type === "hero" ? { ...c, contentData: { ...c.contentData, subtitle: t } } : c))
              }
            />
          </div>
          <input
            value={cd.subtitle || ""}
            onChange={(e) =>
              commit((c) =>
                c.type === "hero" ? { ...c, contentData: { ...c.contentData, subtitle: e.target.value } } : c,
              )
            }
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Bilde (ID / URL)</span>
          <div className="flex gap-2">
            <input
              value={cd.imageId || ""}
              onChange={(e) =>
                commit((c) =>
                  c.type === "hero" ? { ...c, contentData: { ...c.contentData, imageId: e.target.value } } : c,
                )
              }
              placeholder="cms:*, media-ID, https://… eller /sti"
              className="h-10 flex-1 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                setMediaPickerTarget({ blockId: block.id, field: "heroImageUrl" });
                setMediaPickerOpen(true);
              }}
              className="shrink-0 rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))]"
            >
              Fra mediearkiv
            </button>
          </div>
        </label>
        {cd.imageId ? (
          <label className="grid gap-1 text-sm">
            <span className="text-[rgb(var(--lp-muted))]">Bilde alt-tekst</span>
            <input
              value={cd.imageAlt || ""}
              onChange={(e) =>
                commit((c) =>
                  c.type === "hero" ? { ...c, contentData: { ...c.contentData, imageAlt: e.target.value } } : c,
                )
              }
              placeholder="Beskriv bildet for tilgjengelighet"
              className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
            />
          </label>
        ) : null}
        <div className="grid gap-2 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[rgb(var(--lp-muted))]">CTA-tekst</span>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-0.5 text-[10px] font-medium text-[rgb(var(--lp-text))] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-50"
                disabled={isOffline || !effectiveId || aiBusyToolId === "experiment.generate.variants"}
                onClick={() =>
                  handleAiStructuredIntent?.({ variantCount: 2, target: "hero_cta" }, { fromPanel: false })
                }
              >
                {aiBusyToolId === "experiment.generate.variants" ? "Kjører…" : "Generer CTA-idéer"}
              </button>
            </div>
            <input
              value={cd.ctaLabel || ""}
              onChange={(e) =>
                commit((c) =>
                  c.type === "hero" ? { ...c, contentData: { ...c.contentData, ctaLabel: e.target.value } } : c,
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
                  c.type === "hero" ? { ...c, contentData: { ...c.contentData, ctaHref: e.target.value } } : c,
                )
              }
              className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
            />
          </label>
        </div>
      </PropertyEditorSection>
      <PropertyEditorSection section="settings" overline="Presentasjon">
        <p className="text-[11px] text-[rgb(var(--lp-muted))]">
          Standard-hero har ingen egne layout-innstillinger — alt budskap og media ligger i innholdslaget.
        </p>
      </PropertyEditorSection>
      <PropertyEditorSection section="structure" overline="Struktur">
        <p className="text-[11px] text-[rgb(var(--lp-muted))]">
          Ingen elementliste — én hero med valgfritt bilde. Trenger du flere knapper eller kant-til-kant, velg «Hero (kant til
          kant)» i biblioteket.
        </p>
      </PropertyEditorSection>
    </div>
  );
}
