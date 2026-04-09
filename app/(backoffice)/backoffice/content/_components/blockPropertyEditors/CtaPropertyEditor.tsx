"use client";

import { AiTextAssistPopover } from "@/components/cms";
import type { BlockInspectorFieldsCtx } from "../blockPropertyEditorContract";
import type { CtaBlock } from "../editorBlockTypes";
import { PropertyEditorSection } from "../PropertyEditorSection";
import { useBlockDatasetAdapter } from "../useBlockDatasetAdapter";
import { PropertyEditorPreviewHint } from "./PropertyEditorPreviewHint";

/** Handlingsseksjon — U91: `contentData` (budskap) + `structureData` (knapper). */
export function CtaPropertyEditor(props: { block: CtaBlock; ctx: BlockInspectorFieldsCtx }) {
  const { block, ctx } = props;
  const { commit } = useBlockDatasetAdapter(block, ctx.setBlockById);
  const cd = block.contentData;
  const st = block.structureData;
  const { isOffline } = ctx;

  return (
    <div
      className="grid gap-3"
      data-lp-property-editor-root="cta"
      data-lp-property-editor-component="CtaPropertyEditor"
      data-lp-inspector-cta-root
    >
      <PropertyEditorPreviewHint blockType={block.type} />
      <PropertyEditorSection section="content" overline="Innhold · overskrift og støtte">
        <p className="text-[11px] text-[rgb(var(--lp-muted))]">
          Primær handling med valgfri etikett og brødtekst. Banner-blokken er for kort strip med bakgrunnsbilde — bruk CTA når du
          trenger tydelig seksjon med to knapper.
        </p>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Etikett over tittel</span>
          <input
            value={cd.eyebrow || ""}
            onChange={(e) =>
              commit((c) =>
                c.type === "cta" ? { ...c, contentData: { ...c.contentData, eyebrow: e.target.value } } : c,
              )
            }
            placeholder="Valgfri kontekstlinje"
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[rgb(var(--lp-muted))]">Overskrift</span>
            <AiTextAssistPopover
              fieldLabel="CTA-tittel"
              value={cd.title}
              disabled={isOffline}
              onApply={(t) =>
                commit((c) => (c.type === "cta" ? { ...c, contentData: { ...c.contentData, title: t } } : c))
              }
            />
          </div>
          <input
            value={cd.title}
            onChange={(e) =>
              commit((c) =>
                c.type === "cta" ? { ...c, contentData: { ...c.contentData, title: e.target.value } } : c,
              )
            }
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[rgb(var(--lp-muted))]">Støttende tekst</span>
            <AiTextAssistPopover
              fieldLabel="CTA-brødtekst"
              value={cd.body || ""}
              disabled={isOffline}
              onApply={(t) =>
                commit((c) => (c.type === "cta" ? { ...c, contentData: { ...c.contentData, body: t } } : c))
              }
            />
          </div>
          <textarea
            value={cd.body || ""}
            onChange={(e) =>
              commit((c) =>
                c.type === "cta" ? { ...c, contentData: { ...c.contentData, body: e.target.value } } : c,
              )
            }
            rows={4}
            className="rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
          />
        </label>
      </PropertyEditorSection>
      <PropertyEditorSection section="settings" overline="Presentasjon">
        <p className="text-[11px] text-[rgb(var(--lp-muted))]">
          Ingen separate layout-innstillinger — strukturlaget under holder primær og sekundær handling.
        </p>
      </PropertyEditorSection>
      <PropertyEditorSection section="structure" overline="Handlinger · primær og sekundær">
        <div className="grid gap-2 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-[rgb(var(--lp-muted))]">Primær knappetekst</span>
            <input
              value={st.buttonLabel || ""}
              onChange={(e) =>
                commit((c) =>
                  c.type === "cta"
                    ? { ...c, structureData: { ...c.structureData, buttonLabel: e.target.value } }
                    : c,
                )
              }
              className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[rgb(var(--lp-muted))]">Primær lenke</span>
            <input
              value={st.buttonHref || ""}
              onChange={(e) =>
                commit((c) =>
                  c.type === "cta"
                    ? { ...c, structureData: { ...c.structureData, buttonHref: e.target.value } }
                    : c,
                )
              }
              placeholder="/ eller https://"
              className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
            />
          </label>
        </div>
        <p className="text-[11px] text-[rgb(var(--lp-muted))]">
          Sekundær vises som tekstlenke ved siden av primær — begge felt må fylles ut sammen.
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-[rgb(var(--lp-muted))]">Sekundær tekst</span>
            <input
              value={st.secondaryButtonLabel || ""}
              onChange={(e) =>
                commit((c) =>
                  c.type === "cta"
                    ? { ...c, structureData: { ...c.structureData, secondaryButtonLabel: e.target.value } }
                    : c,
                )
              }
              className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[rgb(var(--lp-muted))]">Sekundær lenke</span>
            <input
              value={st.secondaryButtonHref || ""}
              onChange={(e) =>
                commit((c) =>
                  c.type === "cta"
                    ? { ...c, structureData: { ...c.structureData, secondaryButtonHref: e.target.value } }
                    : c,
                )
              }
              className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
            />
          </label>
        </div>
      </PropertyEditorSection>
    </div>
  );
}
