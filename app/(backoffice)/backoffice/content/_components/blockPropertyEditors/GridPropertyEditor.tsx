"use client";

import type { BlockInspectorFieldsCtx } from "../blockPropertyEditorContract";
import type { GridBlock } from "../editorBlockTypes";
import { PropertyEditorSection } from "../PropertyEditorSection";
import { useBlockDatasetAdapter } from "../useBlockDatasetAdapter";
import { PropertyEditorPreviewHint } from "./PropertyEditorPreviewHint";

/** Lokasjonsrutenett — ikke kort-seksjon. */
export function GridPropertyEditor(props: { block: GridBlock; ctx: BlockInspectorFieldsCtx }) {
  const { block, ctx } = props;
  const { commit } = useBlockDatasetAdapter(block, ctx.setBlockById);
  const cd = block.contentData;
  const sd = block.settingsData;
  const items = block.structureData.items;

  return (
    <div
      className="grid gap-3"
      data-lp-property-editor-root="grid"
      data-lp-property-editor-component="GridPropertyEditor"
      data-lp-inspector-grid-root
    >
      <PropertyEditorPreviewHint blockType={block.type} />
      <PropertyEditorSection section="content" overline="Innhold · seksjonstittel">
        <p className="text-[11px] text-[rgb(var(--lp-muted))]">
          Bevis- eller lokasjonsrutenett med bilde og meta per celle. Kort-seksjon er for verdibudskap uten steds-meta.
        </p>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Overskrift</span>
          <input
            value={cd.title}
            onChange={(e) =>
              commit((c) =>
                c.type === "grid" ? { ...c, contentData: { ...c.contentData, title: e.target.value } } : c,
              )
            }
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Ingress</span>
          <textarea
            value={cd.intro || ""}
            onChange={(e) =>
              commit((c) =>
                c.type === "grid" ? { ...c, contentData: { ...c.contentData, intro: e.target.value } } : c,
              )
            }
            rows={2}
            className="rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
          />
        </label>
      </PropertyEditorSection>
      <PropertyEditorSection section="settings" overline="Presentasjon · tekstjustering">
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Tekstjustering (variant)</span>
          <select
            value={sd.variant ?? "center"}
            onChange={(e) => {
              const v = e.target.value as "left" | "center" | "right";
              commit((c) =>
                c.type === "grid" ? { ...c, settingsData: { ...c.settingsData, variant: v } } : c,
              );
            }}
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          >
            <option value="left">Venstre</option>
            <option value="center">Midt</option>
            <option value="right">Høyre</option>
          </select>
        </label>
      </PropertyEditorSection>
      <PropertyEditorSection section="structure" overline="Celler i rutenettet">
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="rounded-lg border border-[rgb(var(--lp-border))] p-2">
              <span className="mb-1 block text-[10px] font-semibold text-[rgb(var(--lp-muted))]">Celle {idx + 1}</span>
              <label className="grid gap-1 text-xs">
                Tittel (f.eks. sted)
                <input
                  value={it.title}
                  onChange={(e) => {
                    const v = e.target.value;
                    commit((c) =>
                      c.type === "grid"
                        ? {
                            ...c,
                            structureData: {
                              ...c.structureData,
                              items: c.structureData.items.map((row, j) =>
                                j === idx ? { ...row, title: v } : row,
                              ),
                            },
                          }
                        : c,
                    );
                  }}
                  className="h-9 rounded border px-2"
                />
              </label>
              <label className="mt-1 grid gap-1 text-xs">
                Undertittel
                <input
                  value={it.subtitle || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    commit((c) =>
                      c.type === "grid"
                        ? {
                            ...c,
                            structureData: {
                              ...c.structureData,
                              items: c.structureData.items.map((row, j) =>
                                j === idx ? { ...row, subtitle: v } : row,
                              ),
                            },
                          }
                        : c,
                    );
                  }}
                  className="h-9 rounded border px-2"
                />
              </label>
              <label className="mt-1 grid gap-1 text-xs">
                Fakta-linje (adresse, vindu, …)
                <input
                  value={it.metaLine || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    commit((c) =>
                      c.type === "grid"
                        ? {
                            ...c,
                            structureData: {
                              ...c.structureData,
                              items: c.structureData.items.map((row, j) =>
                                j === idx ? { ...row, metaLine: v } : row,
                              ),
                            },
                          }
                        : c,
                    );
                  }}
                  className="h-9 rounded border px-2"
                />
              </label>
              <label className="mt-1 grid gap-1 text-xs">
                Bilde (ID / URL)
                <input
                  value={it.imageId}
                  onChange={(e) => {
                    const v = e.target.value;
                    commit((c) =>
                      c.type === "grid"
                        ? {
                            ...c,
                            structureData: {
                              ...c.structureData,
                              items: c.structureData.items.map((row, j) =>
                                j === idx ? { ...row, imageId: v } : row,
                              ),
                            },
                          }
                        : c,
                    );
                  }}
                  className="h-9 rounded border px-2"
                />
              </label>
            </div>
          ))}
          <button
            type="button"
            className="w-full rounded-lg border border-dashed py-2 text-xs"
            onClick={() =>
              commit((c) =>
                c.type === "grid"
                  ? {
                      ...c,
                      structureData: {
                        ...c.structureData,
                        items: [...c.structureData.items, { title: "", imageId: "" }],
                      },
                    }
                  : c,
              )
            }
          >
            + Legg til celle
          </button>
        </div>
      </PropertyEditorSection>
    </div>
  );
}
