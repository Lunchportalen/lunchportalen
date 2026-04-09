"use client";

import { AiTextAssistPopover } from "@/components/cms";
import type { BlockInspectorFieldsCtx } from "../blockPropertyEditorContract";
import type { HeroBleedBlock } from "../editorBlockTypes";
import { PropertyEditorSection } from "../PropertyEditorSection";
import { useBlockDatasetAdapter } from "../useBlockDatasetAdapter";
import { PropertyEditorPreviewHint } from "./PropertyEditorPreviewHint";

/** Kant-til-kant hero — data-type: `hero_bleed`. U91: tekst/CTA/media i `contentData`, layout i `settingsData`. */
export function HeroBleedPropertyEditor(props: { block: HeroBleedBlock; ctx: BlockInspectorFieldsCtx }) {
  const { block, ctx } = props;
  const { commit } = useBlockDatasetAdapter(block, ctx.setBlockById);
  const cd = block.contentData;
  const sd = block.settingsData;
  const { setMediaPickerTarget, setMediaPickerOpen, isOffline } = ctx;

  return (
    <div
      className="grid gap-3"
      data-lp-property-editor-root="hero_bleed"
      data-lp-property-editor-component="HeroBleedPropertyEditor"
    >
      <PropertyEditorPreviewHint blockType={block.type} />
      <PropertyEditorSection section="content" overline="Innhold · tekst, CTA og media">
        <p className="text-[11px] text-[rgb(var(--lp-muted))]">
          To knapper, sterk visuell flate. For rolig budskap i innholdsbredde: bruk «Hero (standard)» eller «Hero (full bredde)».
        </p>
        <label className="grid gap-1 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[rgb(var(--lp-muted))]">Tittel</span>
            <AiTextAssistPopover
              fieldLabel="Hero bleed tittel"
              value={cd.title}
              disabled={isOffline}
              onApply={(t) =>
                commit((c) => (c.type === "hero_bleed" ? { ...c, contentData: { ...c.contentData, title: t } } : c))
              }
            />
          </div>
          <input
            value={cd.title}
            onChange={(e) =>
              commit((c) =>
                c.type === "hero_bleed" ? { ...c, contentData: { ...c.contentData, title: e.target.value } } : c,
              )
            }
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[rgb(var(--lp-muted))]">Undertittel</span>
            <AiTextAssistPopover
              fieldLabel="Hero bleed undertittel"
              value={cd.subtitle || ""}
              disabled={isOffline}
              onApply={(t) =>
                commit((c) => (c.type === "hero_bleed" ? { ...c, contentData: { ...c.contentData, subtitle: t } } : c))
              }
            />
          </div>
          <textarea
            value={cd.subtitle || ""}
            onChange={(e) =>
              commit((c) =>
                c.type === "hero_bleed" ? { ...c, contentData: { ...c.contentData, subtitle: e.target.value } } : c,
              )
            }
            rows={3}
            className="rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
          />
        </label>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-[rgb(var(--lp-muted))]">Primær CTA</span>
            <input
              value={cd.ctaPrimary || ""}
              onChange={(e) =>
                commit((c) =>
                  c.type === "hero_bleed" ? { ...c, contentData: { ...c.contentData, ctaPrimary: e.target.value } } : c,
                )
              }
              className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[rgb(var(--lp-muted))]">Primær lenke</span>
            <input
              value={cd.ctaPrimaryHref || ""}
              onChange={(e) =>
                commit((c) =>
                  c.type === "hero_bleed"
                    ? { ...c, contentData: { ...c.contentData, ctaPrimaryHref: e.target.value } }
                    : c,
                )
              }
              className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[rgb(var(--lp-muted))]">Sekundær CTA</span>
            <input
              value={cd.ctaSecondary || ""}
              onChange={(e) =>
                commit((c) =>
                  c.type === "hero_bleed"
                    ? { ...c, contentData: { ...c.contentData, ctaSecondary: e.target.value } }
                    : c,
                )
              }
              className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[rgb(var(--lp-muted))]">Sekundær lenke</span>
            <input
              value={cd.ctaSecondaryHref || ""}
              onChange={(e) =>
                commit((c) =>
                  c.type === "hero_bleed"
                    ? { ...c, contentData: { ...c.contentData, ctaSecondaryHref: e.target.value } }
                    : c,
                )
              }
              className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
            />
          </label>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Bakgrunnsbilde (ID / URL)</span>
          <div className="flex gap-2">
            <input
              value={cd.backgroundImageId || ""}
              onChange={(e) =>
                commit((c) =>
                  c.type === "hero_bleed"
                    ? { ...c, contentData: { ...c.contentData, backgroundImageId: e.target.value } }
                    : c,
                )
              }
              placeholder="cms:*, media-ID, https://… eller /sti"
              className="h-10 flex-1 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                setMediaPickerTarget({ blockId: block.id, field: "heroBleedBackground" });
                setMediaPickerOpen(true);
              }}
              className="shrink-0 rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-xs font-medium"
            >
              Mediearkiv
            </button>
          </div>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Overlay-bilde (valgfri)</span>
          <div className="flex gap-2">
            <input
              value={cd.overlayImageId || ""}
              onChange={(e) =>
                commit((c) =>
                  c.type === "hero_bleed" ? { ...c, contentData: { ...c.contentData, overlayImageId: e.target.value } } : c,
                )
              }
              className="h-10 flex-1 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                setMediaPickerTarget({ blockId: block.id, field: "heroBleedOverlay" });
                setMediaPickerOpen(true);
              }}
              className="shrink-0 rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-xs font-medium"
            >
              Mediearkiv
            </button>
          </div>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Alt-tekst (overlay)</span>
          <input
            value={cd.overlayImageAlt || ""}
            onChange={(e) =>
              commit((c) =>
                c.type === "hero_bleed" ? { ...c, contentData: { ...c.contentData, overlayImageAlt: e.target.value } } : c,
              )
            }
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
      </PropertyEditorSection>
      <PropertyEditorSection section="settings" overline="Presentasjon · layout-variant">
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Layout (variant)</span>
          <select
            value={sd.variant ?? sd.textPosition ?? "center"}
            onChange={(e) => {
              const v = e.target.value as "left" | "center" | "right";
              commit((c) =>
                c.type === "hero_bleed"
                  ? {
                      ...c,
                      settingsData: {
                        ...c.settingsData,
                        variant: v,
                        textAlign: v,
                        textPosition: v,
                        overlayPosition: v,
                      },
                    }
                  : c,
              );
            }}
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          >
            <option value="left">Venstre</option>
            <option value="center">Midt</option>
            <option value="right">Høyre</option>
          </select>
        </label>
        <p className="text-[11px] text-[rgb(var(--lp-muted))]">
          Én variant styrer tekst og overlegg. På mobil er tekst og knapper sentrert; overlay-bilde skjules under md.
        </p>
      </PropertyEditorSection>
      <PropertyEditorSection section="structure" overline="Struktur">
        <p className="text-[11px] text-[rgb(var(--lp-muted))]">Ingen liste — én kampanjeflate med valgfritt overlay.</p>
      </PropertyEditorSection>
    </div>
  );
}
