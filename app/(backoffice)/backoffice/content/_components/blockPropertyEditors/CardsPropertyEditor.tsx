"use client";

import type { BlockInspectorFieldsCtx } from "../blockPropertyEditorContract";
import type { CardsBlock } from "../editorBlockTypes";
import { PropertyEditorSection } from "../PropertyEditorSection";
import { useBlockDatasetAdapter } from "../useBlockDatasetAdapter";
import { PropertyEditorPreviewHint } from "./PropertyEditorPreviewHint";

/** Verdi-kort i rader — U91: seksjon i `contentData`, stil i `settingsData`, kort i `structureData`. */
export function CardsPropertyEditor(props: { block: CardsBlock; ctx: BlockInspectorFieldsCtx }) {
  const { block, ctx } = props;
  const { commit } = useBlockDatasetAdapter(block, ctx.setBlockById);
  const cd = block.contentData;
  const sd = block.settingsData;
  const st = block.structureData;

  return (
    <div
      className="grid gap-3"
      data-lp-property-editor-root="cards"
      data-lp-property-editor-component="CardsPropertyEditor"
      data-lp-inspector-cards-root
    >
      <PropertyEditorPreviewHint blockType={block.type} />
      <PropertyEditorSection section="content" overline="Kortseksjon · overskrift og ingress">
        <p className="text-[11px] text-[rgb(var(--lp-muted))]">
          Bruk til verdiforslag i kort. «Lokasjonsrutenett» er for steder med bilde + meta per celle — ikke samme formål.
        </p>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Overskrift</span>
          <input
            value={cd.title}
            onChange={(e) =>
              commit((c) =>
                c.type === "cards" ? { ...c, contentData: { ...c.contentData, title: e.target.value } } : c,
              )
            }
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Ingress</span>
          <textarea
            value={cd.text}
            onChange={(e) =>
              commit((c) =>
                c.type === "cards" ? { ...c, contentData: { ...c.contentData, text: e.target.value } } : c,
              )
            }
            rows={3}
            className="rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
          />
        </label>
      </PropertyEditorSection>
      <PropertyEditorSection section="settings" overline="Presentasjon">
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Kortstil</span>
          <select
            value={sd.presentation === "plain" ? "plain" : "feature"}
            onChange={(e) =>
              commit((c) =>
                c.type === "cards"
                  ? {
                      ...c,
                      settingsData: {
                        ...c.settingsData,
                        presentation: e.target.value === "plain" ? "plain" : "feature",
                      },
                    }
                  : c,
              )
            }
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          >
            <option value="feature">Med ikonring (anbefalt for verdiforslag)</option>
            <option value="plain">Rolige kort uten ikon</option>
          </select>
        </label>
      </PropertyEditorSection>
      <PropertyEditorSection section="structure" overline="Kort (samling)">
        <div className="space-y-2">
          {st.items.map((it, idx) => (
            <div key={idx} className="rounded-lg border border-[rgb(var(--lp-border))] p-2">
              <span className="mb-2 block text-[10px] font-semibold text-[rgb(var(--lp-muted))]">Kort {idx + 1}</span>
              <label className="grid gap-1 text-xs">
                Etikett (valgfri)
                <input
                  value={it.kicker || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    commit((c) =>
                      c.type === "cards"
                        ? {
                            ...c,
                            structureData: {
                              ...c.structureData,
                              items: c.structureData.items.map((row, j) =>
                                j === idx ? { ...row, kicker: v } : row,
                              ),
                            },
                          }
                        : c,
                    );
                  }}
                  className="h-8 rounded border border-[rgb(var(--lp-border))] px-2"
                />
              </label>
              <label className="mt-1 grid gap-1 text-xs">
                Tittel
                <input
                  value={it.title}
                  onChange={(e) => {
                    const v = e.target.value;
                    commit((c) =>
                      c.type === "cards"
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
                  className="h-9 rounded border border-[rgb(var(--lp-border))] px-2"
                />
              </label>
              <label className="mt-1 grid gap-1 text-xs">
                Brødtekst
                <textarea
                  value={it.text}
                  onChange={(e) => {
                    const v = e.target.value;
                    commit((c) =>
                      c.type === "cards"
                        ? {
                            ...c,
                            structureData: {
                              ...c.structureData,
                              items: c.structureData.items.map((row, j) =>
                                j === idx ? { ...row, text: v } : row,
                              ),
                            },
                          }
                        : c,
                    );
                  }}
                  rows={2}
                  className="rounded border border-[rgb(var(--lp-border))] px-2 py-1"
                />
              </label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-xs">
                  Lenketekst
                  <input
                    value={it.linkLabel || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      commit((c) =>
                        c.type === "cards"
                          ? {
                              ...c,
                              structureData: {
                                ...c.structureData,
                                items: c.structureData.items.map((row, j) =>
                                  j === idx ? { ...row, linkLabel: v } : row,
                                ),
                              },
                            }
                          : c,
                      );
                    }}
                    className="h-8 rounded border px-2"
                  />
                </label>
                <label className="grid gap-1 text-xs">
                  Lenke-URL
                  <input
                    value={it.linkHref || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      commit((c) =>
                        c.type === "cards"
                          ? {
                              ...c,
                              structureData: {
                                ...c.structureData,
                                items: c.structureData.items.map((row, j) =>
                                  j === idx ? { ...row, linkHref: v } : row,
                                ),
                              },
                            }
                          : c,
                      );
                    }}
                    className="h-8 rounded border px-2"
                  />
                </label>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="w-full rounded-lg border border-dashed border-[rgb(var(--lp-border))] py-2 text-xs"
            onClick={() =>
              commit((c) =>
                c.type === "cards"
                  ? {
                      ...c,
                      structureData: {
                        ...c.structureData,
                        items: [...c.structureData.items, { title: "", text: "" }],
                      },
                    }
                  : c,
              )
            }
          >
            + Legg til kort
          </button>
        </div>
        <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.14em] text-pink-900/55">
          Seksjons-CTA (valgfri, opptil to)
        </p>
        <p className="text-[11px] text-[rgb(var(--lp-muted))]">Vises under kortene. Begge felt må fylles ut per knapp.</p>
        {[0, 1].map((slot) => {
          const row = st.cta?.[slot];
          return (
            <div key={slot} className="mb-2 rounded-lg border border-[rgb(var(--lp-border))]/80 p-2">
              <span className="text-[10px] font-medium text-[rgb(var(--lp-muted))]">Knapp {slot + 1}</span>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <input
                  placeholder="Tekst"
                  value={row?.label ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    commit((c) => {
                      if (c.type !== "cards") return c;
                      const next = [...(c.structureData.cta ?? [])];
                      while (next.length <= slot) next.push({ label: "", href: "" });
                      next[slot] = { ...next[slot]!, label: v };
                      return { ...c, structureData: { ...c.structureData, cta: next } };
                    });
                  }}
                  className="h-8 rounded border px-2 text-xs"
                />
                <input
                  placeholder="Lenke"
                  value={row?.href ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    commit((c) => {
                      if (c.type !== "cards") return c;
                      const next = [...(c.structureData.cta ?? [])];
                      while (next.length <= slot) next.push({ label: "", href: "" });
                      next[slot] = { ...next[slot]!, href: v };
                      return { ...c, structureData: { ...c.structureData, cta: next } };
                    });
                  }}
                  className="h-8 rounded border px-2 text-xs"
                />
              </div>
            </div>
          );
        })}
      </PropertyEditorSection>
    </div>
  );
}

