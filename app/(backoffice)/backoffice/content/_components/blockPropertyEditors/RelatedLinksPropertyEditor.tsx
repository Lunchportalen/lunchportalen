"use client";

import type { BlockInspectorFieldsCtx } from "../blockPropertyEditorContract";
import type { RelatedLinksBlock } from "../editorBlockTypes";
import { PropertyEditorSection } from "../PropertyEditorSection";
import { useBlockDatasetAdapter } from "../useBlockDatasetAdapter";
import { PropertyEditorPreviewHint } from "./PropertyEditorPreviewHint";

/** Kuratert relaterte sider — U91: intro i `contentData`, scope i `settingsData`, stikkord i `structureData`. */
export function RelatedLinksPropertyEditor(props: { block: RelatedLinksBlock; ctx: BlockInspectorFieldsCtx }) {
  const { block, ctx } = props;
  const { commit } = useBlockDatasetAdapter(block, ctx.setBlockById);
  const cd = block.contentData;
  const sd = block.settingsData;
  const st = block.structureData;

  return (
    <div
      className="grid gap-3"
      data-lp-property-editor-root="relatedLinks"
      data-lp-property-editor-component="RelatedLinksPropertyEditor"
      data-lp-inspector-related-root
    >
      <PropertyEditorPreviewHint blockType={block.type} />
      <PropertyEditorSection section="content" overline="Innhold · overskrift og ingress">
        <p className="text-[11px] text-[rgb(var(--lp-muted))]">
          Redaksjonell ramme rundt automatisk utvalg. Skiller seg fra generiske lenkelister — her styrer du sti, stikkord og
          antall, ikke manuelle URL-er per rad.
        </p>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Overskrift</span>
          <input
            value={cd.title || ""}
            onChange={(e) =>
              commit((c) =>
                c.type === "relatedLinks" ? { ...c, contentData: { ...c.contentData, title: e.target.value } } : c,
              )
            }
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Ingress</span>
          <textarea
            value={cd.subtitle || ""}
            onChange={(e) =>
              commit((c) =>
                c.type === "relatedLinks" ? { ...c, contentData: { ...c.contentData, subtitle: e.target.value } } : c,
              )
            }
            rows={2}
            className="rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Tekst når ingen relaterte sider matches (valgfri)</span>
          <textarea
            value={cd.emptyFallbackText || ""}
            onChange={(e) =>
              commit((c) =>
                c.type === "relatedLinks"
                  ? { ...c, contentData: { ...c.contentData, emptyFallbackText: e.target.value } }
                  : c,
              )
            }
            rows={2}
            placeholder="Valgfri rolig melding til leseren"
            className="rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
          />
        </label>
      </PropertyEditorSection>
      <PropertyEditorSection section="settings" overline="Kilde · sti og volum">
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Aktiv sti (skjul gjeldende side)</span>
          <input
            value={sd.currentPath || "/"}
            onChange={(e) =>
              commit((c) =>
                c.type === "relatedLinks"
                  ? { ...c, settingsData: { ...c.settingsData, currentPath: e.target.value } }
                  : c,
              )
            }
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Maks antall lenker (1–12)</span>
          <input
            type="number"
            min={1}
            max={12}
            value={sd.maxSuggestions ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                commit((c) => {
                  if (c.type !== "relatedLinks") return c;
                  const nextSd = { ...c.settingsData };
                  delete nextSd.maxSuggestions;
                  return { ...c, settingsData: nextSd };
                });
                return;
              }
              const n = parseInt(raw, 10);
              if (!Number.isFinite(n)) return;
              commit((c) =>
                c.type === "relatedLinks"
                  ? {
                      ...c,
                      settingsData: {
                        ...c.settingsData,
                        maxSuggestions: Math.min(12, Math.max(1, n)),
                      },
                    }
                  : c,
              );
            }}
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
      </PropertyEditorSection>
      <PropertyEditorSection section="structure" overline="Stikkord · kuratert oppdagelse">
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Stikkord (kommaseparert)</span>
          <input
            value={(st.tags ?? []).join(", ")}
            onChange={(e) => {
              const tags = e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              commit((c) =>
                c.type === "relatedLinks" ? { ...c, structureData: { ...c.structureData, tags } } : c,
              );
            }}
            placeholder="core, lokal, system"
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
      </PropertyEditorSection>
    </div>
  );
}
