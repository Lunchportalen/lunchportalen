"use client";

import type { BlockInspectorFieldsCtx } from "../blockPropertyEditorContract";
import type { PricingBlock } from "../editorBlockTypes";
import { PropertyEditorSection } from "../PropertyEditorSection";
import { useBlockDatasetAdapter } from "../useBlockDatasetAdapter";
import { PropertyEditorPreviewHint } from "./PropertyEditorPreviewHint";

export function PricingPropertyEditor(props: { block: PricingBlock; ctx: BlockInspectorFieldsCtx }) {
  const { block, ctx } = props;
  const { commit } = useBlockDatasetAdapter(block, ctx.setBlockById);
  const cd = block.contentData;
  const planRows = block.structureData.plans;

  return (
    <div
      className="grid gap-3"
      data-lp-property-editor-root="pricing"
      data-lp-property-editor-component="PricingPropertyEditor"
      data-lp-inspector-pricing-root
    >
      <PropertyEditorPreviewHint blockType={block.type} />
      <p className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/40 px-3 py-2 text-[11px] text-[rgb(var(--lp-muted))]">
        Tom planliste = live priser fra produktplaner på publisert side. Fyll ut opptil to pakker for manuell prisvisning i
        preview og statiske sider.
      </p>
      <PropertyEditorSection section="content" overline="Prisblokk · overskrift og intro">
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Overskrift</span>
          <input
            value={cd.title}
            onChange={(e) =>
              commit((c) =>
                c.type === "pricing" ? { ...c, contentData: { ...c.contentData, title: e.target.value } } : c,
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
                c.type === "pricing" ? { ...c, contentData: { ...c.contentData, intro: e.target.value } } : c,
              )
            }
            rows={3}
            className="rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Fotnote (valgfri)</span>
          <textarea
            value={cd.footnote || ""}
            onChange={(e) =>
              commit((c) =>
                c.type === "pricing" ? { ...c, contentData: { ...c.contentData, footnote: e.target.value } } : c,
              )
            }
            rows={2}
            placeholder="Juridisk merknad eller prisforbehold"
            className="rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
          />
        </label>
      </PropertyEditorSection>
      <PropertyEditorSection section="settings" overline="Fremheving">
        <p className="text-[11px] text-[rgb(var(--lp-muted))]">
          Merk én pakke som «Fremhev» for visuell vekt — maks én bør være aktiv for rolig layout.
        </p>
      </PropertyEditorSection>
      <PropertyEditorSection section="structure" overline="Pakker (maks to i visning)">
        <div className="space-y-3">
          {planRows.map((plan, idx) => (
            <div key={idx} className="rounded-lg border border-[rgb(var(--lp-border))] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[rgb(var(--lp-text))]">Pakke {idx + 1}</span>
                <label className="flex items-center gap-2 text-xs text-[rgb(var(--lp-muted))]">
                  <input
                    type="checkbox"
                    checked={plan.featured === true}
                    onChange={(e) =>
                      commit((c) => {
                        if (c.type !== "pricing") return c;
                        const plans = c.structureData.plans.map((p, j) =>
                          j === idx ? { ...p, featured: e.target.checked } : p,
                        );
                        return { ...c, structureData: { ...c.structureData, plans } };
                      })
                    }
                  />
                  Fremhev
                </label>
              </div>
              <div className="grid gap-2">
                <label className="grid gap-1 text-xs">
                  Pakkenavn (pill)
                  <input
                    value={plan.name}
                    onChange={(e) =>
                      commit((c) => {
                        if (c.type !== "pricing") return c;
                        const plans = c.structureData.plans.map((p, j) =>
                          j === idx ? { ...p, name: e.target.value } : p,
                        );
                        return { ...c, structureData: { ...c.structureData, plans } };
                      })
                    }
                    className="h-9 rounded border border-[rgb(var(--lp-border))] px-2"
                  />
                </label>
                <label className="grid gap-1 text-xs">
                  Undertittel (h3)
                  <input
                    value={plan.tagline || ""}
                    onChange={(e) =>
                      commit((c) => {
                        if (c.type !== "pricing") return c;
                        const plans = c.structureData.plans.map((p, j) =>
                          j === idx ? { ...p, tagline: e.target.value } : p,
                        );
                        return { ...c, structureData: { ...c.structureData, plans } };
                      })
                    }
                    className="h-9 rounded border border-[rgb(var(--lp-border))] px-2"
                  />
                </label>
                <label className="grid gap-1 text-xs">
                  Merkelapp (valgfri, over navn)
                  <input
                    value={plan.badge || ""}
                    onChange={(e) =>
                      commit((c) => {
                        if (c.type !== "pricing") return c;
                        const plans = c.structureData.plans.map((p, j) =>
                          j === idx ? { ...p, badge: e.target.value } : p,
                        );
                        return { ...c, structureData: { ...c.structureData, plans } };
                      })
                    }
                    placeholder="Mest valgt"
                    className="h-9 rounded border border-[rgb(var(--lp-border))] px-2"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1 text-xs">
                    Pris (tall)
                    <input
                      value={plan.price}
                      onChange={(e) =>
                        commit((c) => {
                          if (c.type !== "pricing") return c;
                          const plans = c.structureData.plans.map((p, j) =>
                            j === idx ? { ...p, price: e.target.value } : p,
                          );
                          return { ...c, structureData: { ...c.structureData, plans } };
                        })
                      }
                      className="h-9 rounded border border-[rgb(var(--lp-border))] px-2"
                    />
                  </label>
                  <label className="grid gap-1 text-xs">
                    Prislinje (f.eks. kr / kuvert)
                    <input
                      value={plan.period || ""}
                      onChange={(e) =>
                        commit((c) => {
                          if (c.type !== "pricing") return c;
                          const plans = c.structureData.plans.map((p, j) =>
                            j === idx ? { ...p, period: e.target.value } : p,
                          );
                          return { ...c, structureData: { ...c.structureData, plans } };
                        })
                      }
                      placeholder="kr / kuvert"
                      className="h-9 rounded border border-[rgb(var(--lp-border))] px-2"
                    />
                  </label>
                </div>
                <label className="grid gap-1 text-xs">
                  Punkter (én per linje)
                  <textarea
                    value={plan.features.join("\n")}
                    onChange={(e) =>
                      commit((c) => {
                        if (c.type !== "pricing") return c;
                        const feats = e.target.value
                          .split("\n")
                          .map((l) => l.trim())
                          .filter(Boolean);
                        const plans = c.structureData.plans.map((p, j) =>
                          j === idx ? { ...p, features: feats } : p,
                        );
                        return { ...c, structureData: { ...c.structureData, plans } };
                      })
                    }
                    rows={4}
                    className="rounded border border-[rgb(var(--lp-border))] px-2 py-1"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1 text-xs">
                    CTA-tekst
                    <input
                      value={plan.ctaLabel || ""}
                      onChange={(e) =>
                        commit((c) => {
                          if (c.type !== "pricing") return c;
                          const plans = c.structureData.plans.map((p, j) =>
                            j === idx ? { ...p, ctaLabel: e.target.value } : p,
                          );
                          return { ...c, structureData: { ...c.structureData, plans } };
                        })
                      }
                      className="h-9 rounded border border-[rgb(var(--lp-border))] px-2"
                    />
                  </label>
                  <label className="grid gap-1 text-xs">
                    CTA-lenke
                    <input
                      value={plan.ctaHref || ""}
                      onChange={(e) =>
                        commit((c) => {
                          if (c.type !== "pricing") return c;
                          const plans = c.structureData.plans.map((p, j) =>
                            j === idx ? { ...p, ctaHref: e.target.value } : p,
                          );
                          return { ...c, structureData: { ...c.structureData, plans } };
                        })
                      }
                      className="h-9 rounded border border-[rgb(var(--lp-border))] px-2"
                    />
                  </label>
                </div>
              </div>
              <button
                type="button"
                className="mt-2 w-full rounded border border-dashed border-red-200 py-1.5 text-[11px] text-red-700"
                onClick={() =>
                  commit((c) => {
                    if (c.type !== "pricing") return c;
                    return {
                      ...c,
                      structureData: {
                        ...c.structureData,
                        plans: c.structureData.plans.filter((_, j) => j !== idx),
                      },
                    };
                  })
                }
              >
                Fjern pakke
              </button>
            </div>
          ))}
          <button
            type="button"
            className="w-full rounded-lg border border-dashed border-[rgb(var(--lp-border))] py-2 text-xs"
            disabled={planRows.length >= 2}
            onClick={() =>
              commit((c) => {
                if (c.type !== "pricing") return c;
                if (c.structureData.plans.length >= 2) return c;
                return {
                  ...c,
                  structureData: {
                    ...c.structureData,
                    plans: [
                      ...c.structureData.plans,
                      {
                        name: "Ny pakke",
                        tagline: "",
                        price: "",
                        features: [],
                        ctaLabel: "",
                        ctaHref: "",
                      },
                    ],
                  },
                };
              })
            }
          >
            + Legg til pakke (maks 2)
          </button>
        </div>
      </PropertyEditorSection>
    </div>
  );
}
