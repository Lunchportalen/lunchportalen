"use client";

import type { BlockInspectorFieldsCtx } from "../blockPropertyEditorContract";
import type { ZigzagBlock } from "../editorBlockTypes";
import { PropertyEditorSection } from "../PropertyEditorSection";
import { useBlockDatasetAdapter } from "../useBlockDatasetAdapter";
import { PropertyEditorPreviewHint } from "./PropertyEditorPreviewHint";

/**
 * Steg/prosess (type `zigzag` i datasettet) — FAQ eller sikksakk med bilder.
 * Ikke «relaterte sider»; ikke kort-seksjon.
 */
export function StepsPropertyEditor(props: { block: ZigzagBlock; ctx: BlockInspectorFieldsCtx }) {
  const { block, ctx } = props;
  const { commit } = useBlockDatasetAdapter(block, ctx.setBlockById);
  const cd = block.contentData;
  const sd = block.settingsData;
  const steps = block.structureData.steps;

  return (
    <div
      className="grid gap-3"
      data-lp-property-editor-root="zigzag"
      data-lp-property-editor-component="StepsPropertyEditor"
      data-lp-inspector-zigzag-root
    >
      <PropertyEditorPreviewHint blockType={block.type} />
      <PropertyEditorSection section="content" overline="Innhold · seksjonstittel">
        <p className="text-[11px] text-[rgb(var(--lp-muted))]">
          Ordnet flyt med steg. Velg FAQ-modus når innholdet er spørsmål/svar; prosess når hvert steg har bilde og narrativ.
        </p>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Overskrift</span>
          <input
            value={cd.title}
            onChange={(e) =>
              commit((c) =>
                c.type === "zigzag" ? { ...c, contentData: { ...c.contentData, title: e.target.value } } : c,
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
                c.type === "zigzag" ? { ...c, contentData: { ...c.contentData, intro: e.target.value } } : c,
              )
            }
            rows={2}
            className="rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
          />
        </label>
      </PropertyEditorSection>
      <PropertyEditorSection section="settings" overline="Presentasjon på nettsted">
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Modus</span>
          <select
            value={sd.presentation === "faq" ? "faq" : "process"}
            onChange={(e) =>
              commit((c) =>
                c.type === "zigzag"
                  ? {
                      ...c,
                      settingsData: {
                        ...c.settingsData,
                        presentation: e.target.value === "faq" ? "faq" : "process",
                      },
                    }
                  : c,
              )
            }
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          >
            <option value="process">Prosess (sikksakk med bilde)</option>
            <option value="faq">FAQ (spørsmål og svar)</option>
          </select>
        </label>
      </PropertyEditorSection>
      <PropertyEditorSection section="structure" overline="Steg i samlingen">
        <div className="space-y-2">
          {steps.map((st, idx) => (
            <div key={idx} className="rounded-lg border border-[rgb(var(--lp-border))] p-2">
              <span className="mb-1 block text-[10px] font-semibold text-[rgb(var(--lp-muted))]">Steg {idx + 1}</span>
              <label className="grid gap-1 text-xs">
                Nummer / kode i ring
                <input
                  value={st.step}
                  onChange={(e) => {
                    const v = e.target.value;
                    commit((c) =>
                      c.type === "zigzag"
                        ? {
                            ...c,
                            structureData: {
                              ...c.structureData,
                              steps: c.structureData.steps.map((s, j) => (j === idx ? { ...s, step: v } : s)),
                            },
                          }
                        : c,
                    );
                  }}
                  className="h-8 rounded border px-2"
                />
              </label>
              <label className="mt-1 grid gap-1 text-xs">
                Mikro-etikett (valgfri)
                <input
                  value={st.kicker || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    commit((c) =>
                      c.type === "zigzag"
                        ? {
                            ...c,
                            structureData: {
                              ...c.structureData,
                              steps: c.structureData.steps.map((s, j) => (j === idx ? { ...s, kicker: v } : s)),
                            },
                          }
                        : c,
                    );
                  }}
                  className="h-8 rounded border px-2"
                />
              </label>
              <label className="mt-1 grid gap-1 text-xs">
                Tittel
                <input
                  value={st.title}
                  onChange={(e) => {
                    const v = e.target.value;
                    commit((c) =>
                      c.type === "zigzag"
                        ? {
                            ...c,
                            structureData: {
                              ...c.structureData,
                              steps: c.structureData.steps.map((s, j) => (j === idx ? { ...s, title: v } : s)),
                            },
                          }
                        : c,
                    );
                  }}
                  className="h-8 rounded border px-2"
                />
              </label>
              <label className="mt-1 grid gap-1 text-xs">
                Brødtekst
                <textarea
                  value={st.text}
                  onChange={(e) => {
                    const v = e.target.value;
                    commit((c) =>
                      c.type === "zigzag"
                        ? {
                            ...c,
                            structureData: {
                              ...c.structureData,
                              steps: c.structureData.steps.map((s, j) => (j === idx ? { ...s, text: v } : s)),
                            },
                          }
                        : c,
                    );
                  }}
                  rows={2}
                  className="rounded border px-2 py-1"
                />
              </label>
              <label className="mt-1 grid gap-1 text-xs">
                Bilde (ID / URL)
                <input
                  value={st.imageId}
                  onChange={(e) => {
                    const v = e.target.value;
                    commit((c) =>
                      c.type === "zigzag"
                        ? {
                            ...c,
                            structureData: {
                              ...c.structureData,
                              steps: c.structureData.steps.map((s, j) => (j === idx ? { ...s, imageId: v } : s)),
                            },
                          }
                        : c,
                    );
                  }}
                  className="h-8 rounded border px-2"
                />
              </label>
            </div>
          ))}
          <button
            type="button"
            className="w-full rounded-lg border border-dashed py-2 text-xs"
            onClick={() =>
              commit((c) =>
                c.type === "zigzag"
                  ? {
                      ...c,
                      structureData: {
                        ...c.structureData,
                        steps: [
                          ...c.structureData.steps,
                          {
                            step: String(c.structureData.steps.length + 1),
                            title: "",
                            text: "",
                            imageId: "",
                          },
                        ],
                      },
                    }
                  : c,
              )
            }
          >
            + Legg til steg
          </button>
        </div>
      </PropertyEditorSection>
    </div>
  );
}
