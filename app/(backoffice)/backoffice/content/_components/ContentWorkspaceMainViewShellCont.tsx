"use client";

import type { Dispatch, SetStateAction } from "react";
import * as ShellUi from "./contentWorkspaceShellUiConstants";

export type ContentWorkspaceMainViewShellContProps = {
  designTab: string;
  labelColors: Array<{ background: string; text: string }>;
  setLabelColors: Dispatch<SetStateAction<Array<{ background: string; text: string }>>>;
  colorsContentBg: string;
  colorsButtonBg: string;
  colorsButtonText: string;
  colorsButtonBorder: string;
};

export function ContentWorkspaceMainViewShellColorsContinuation({
  labelColors,
  setLabelColors,
}: Pick<
  ContentWorkspaceMainViewShellContProps,
  "labelColors" | "setLabelColors"
>) {
  return (
    <>
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">
                Additional content colors
              </h2>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Bygg opp full fargepalett med bakgrunn, overskrifter, tekst og lenkekombinasjoner. Legg til så mange du vil.
              </p>
              <details className="group rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
                  <span className="h-6 w-6 shrink-0 rounded bg-amber-300" aria-hidden />
                  <span className="flex-1 font-medium text-[rgb(var(--lp-text))]">c1</span>
                  <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white text-xs" aria-label="Dupliser">+</button>
                  <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-600 text-xs text-white" aria-label="Slett">–</button>
                  <span className="text-[rgb(var(--lp-muted))] group-open:rotate-180">–</span>
                </summary>
                <div className="border-t border-[rgb(var(--lp-border))] px-3 pb-3 pt-2">
                  <div className="mb-2 flex gap-1">
                    <button type="button" className="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-800">SOLID</button>
                    <button type="button" className="rounded px-2 py-1 text-xs font-medium text-[rgb(var(--lp-muted))]">GRADIENT</button>
                  </div>
                  {ShellUi.LABEL_COLOR_PICKER_ROW_LABELS.map((label) => (
                    <div key={label} className="flex items-center justify-between gap-2 py-1">
                      <span className="text-xs text-[rgb(var(--lp-text))]">{label}</span>
                      <label className="flex cursor-pointer items-center gap-1">
                        <input type="color" defaultValue="#f5d385" className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                        <span className="text-[rgb(var(--lp-muted))]">–</span>
                      </label>
                    </div>
                  ))}
                </div>
              </details>
              <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-lg text-[rgb(var(--lp-muted))] hover:border-slate-300">+</button>
            </section>

            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">
                Additional button colors
              </h2>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Bygg knappefargekombinasjoner for call-to-actions. Legg til så mange du vil.
              </p>
              <details className="group rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
                  <span className="h-6 w-6 shrink-0 rounded bg-amber-400" aria-hidden />
                  <span className="flex-1 font-medium text-[rgb(var(--lp-text))]">c1-btn</span>
                  <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white text-xs" aria-label="Dupliser">+</button>
                  <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-600 text-xs text-white" aria-label="Slett">–</button>
                  <span className="text-[rgb(var(--lp-muted))] group-open:rotate-180">–</span>
                </summary>
                <div className="border-t border-[rgb(var(--lp-border))] px-3 pb-3 pt-2">
                  <p className="mb-1 text-[10px] font-semibold uppercase text-[rgb(var(--lp-muted))]">Default</p>
                  <div className="mb-2 flex gap-1">
                    <button type="button" className="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-800">SOLID</button>
                    <button type="button" className="rounded px-2 py-1 text-xs font-medium text-[rgb(var(--lp-muted))]">GRADIENT</button>
                  </div>
                  {ShellUi.THREE_PANEL_COLOR_LABELS.map((label) => (
                    <div key={label} className="flex items-center justify-between gap-2 py-1">
                      <span className="text-xs text-[rgb(var(--lp-text))]">{label}</span>
                      <label className="flex cursor-pointer items-center gap-1">
                        <input type="color" defaultValue={label === "Background" ? "#f8e7a0" : label === "Text" ? "#000000" : "#6e5338"} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                        <span className="text-[rgb(var(--lp-muted))]">–</span>
                      </label>
                    </div>
                  ))}
                  <p className="mt-3 mb-1 text-[10px] font-semibold uppercase text-[rgb(var(--lp-muted))]">Hover</p>
                  <div className="mb-2 flex gap-1">
                    <button type="button" className="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-800">SOLID</button>
                    <button type="button" className="rounded px-2 py-1 text-xs font-medium text-[rgb(var(--lp-muted))]">GRADIENT</button>
                  </div>
                  {ShellUi.THREE_PANEL_HOVER_COLOR_LABELS.map((label) => (
                    <div key={label} className="flex items-center justify-between gap-2 py-1">
                      <span className="text-xs text-[rgb(var(--lp-text))]">{label}</span>
                      <label className="flex cursor-pointer items-center gap-1">
                        <input type="color" defaultValue={label.includes("Background") ? "#6e5338" : label.includes("Text") ? "#ffffff" : "#6e5338"} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                        <span className="text-[rgb(var(--lp-muted))]">–</span>
                      </label>
                    </div>
                  ))}
                </div>
              </details>
              <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-lg text-[rgb(var(--lp-muted))] hover:border-slate-300">+</button>
            </section>

            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">
                Label colors
              </h2>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Lag fargekombinasjoner for etiketter som brukes til å fremheve tekst.
              </p>
              {labelColors.map((colors, i) => (
                <details key={i} className="group rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
                    <span
                      className="h-6 w-6 shrink-0 rounded border border-[rgb(var(--lp-border))]"
                      style={{ backgroundColor: colors.background }}
                      aria-hidden
                    />
                    <span className="flex-1 font-medium text-[rgb(var(--lp-text))]">Label {i + 1}</span>
                    <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white text-xs" aria-label="Dupliser">+</button>
                    <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-600 text-xs text-white" aria-label="Slett">–</button>
                    <span className="text-[rgb(var(--lp-muted))] transition group-open:rotate-180">–</span>
                  </summary>
                  <div className="border-t border-[rgb(var(--lp-border))] px-3 pb-3 pt-3">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-10 w-10 shrink-0 rounded border border-[rgb(var(--lp-border))]"
                            style={{ backgroundColor: colors.background }}
                            aria-hidden
                          />
                          <div className="flex gap-1">
                            <button type="button" className="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-800">SOLID</button>
                            <button type="button" className="rounded px-2 py-1 text-xs font-medium text-[rgb(var(--lp-muted))]">GRADIENT</button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-[rgb(var(--lp-text))]">Background</span>
                            <label className="flex cursor-pointer items-center gap-1">
                              <input
                                type="color"
                                value={colors.background}
                                onChange={(e) => {
                                  const next = [...labelColors];
                                  next[i] = { ...next[i]!, background: e.target.value };
                                  setLabelColors(next);
                                }}
                                className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                              />
                              <span className="text-[rgb(var(--lp-muted))]">–</span>
                            </label>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-[rgb(var(--lp-text))]">Text</span>
                            <label className="flex cursor-pointer items-center gap-1">
                              <input
                                type="color"
                                value={colors.text}
                                onChange={(e) => {
                                  const next = [...labelColors];
                                  next[i] = { ...next[i]!, text: e.target.value };
                                  setLabelColors(next);
                                }}
                                className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                              />
                              <span className="text-[rgb(var(--lp-muted))]">–</span>
                            </label>
                          </div>
                        </div>
                      </div>
                      <div
                        className="flex min-h-[80px] flex-1 items-center justify-center rounded-lg border border-[rgb(var(--lp-border))] px-4 py-3 sm:min-w-[200px]"
                        style={{ backgroundColor: "#fef3c7" }}
                      >
                        <span
                          className="rounded px-3 py-1.5 text-sm font-medium"
                          style={{ backgroundColor: colors.background, color: colors.text }}
                        >
                          I am a label!
                        </span>
                      </div>
                    </div>
                  </div>
                </details>
              ))}
              <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-lg text-[rgb(var(--lp-muted))] hover:border-slate-300">+</button>
            </section>

    </>
  );
}

export function ContentWorkspaceMainViewShellCont({ designTab }: { designTab: string }) {
  return (
    <>
      {designTab === "Fonts" && (
        <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Fonts</h2>
              <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                Velg skrifter som brukes i designet. Du kan kombinere systemfonter, Google Fonts og Adobe
                Fonts.
              </p>
            </div>
            <div className="space-y-2">
              {ShellUi.DESIGN_FONT_STACK_PLACEHOLDER_LABELS.map((fontLabel) => (
                <div
                  key={fontLabel}
                  className="flex items-center gap-2 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 text-sm"
                >
                  <span className="flex-1 truncate text-[rgb(var(--lp-text))]">{fontLabel}</span>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white text-xs"
                    aria-label="Dupliser"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-600 text-xs text-white"
                    aria-label="Slett"
                  >
                    –
                  </button>
                  <span className="text-[rgb(var(--lp-muted))]">–</span>
                </div>
              ))}
              <button
                type="button"
                className="flex h-9 items-center justify-center rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
              >
                +
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Typography</h2>
            <p className="text-xs text-[rgb(var(--lp-muted))]">
              Knytt skrifttypene over til ulike typografi–roller i designet.
            </p>
            <div className="space-y-2">
              {ShellUi.DESIGN_TYPOGRAPHY_ROLE_LABELS.map((label) => (
                <button
                  key={label}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 text-left text-sm hover:bg-white"
                >
                  <span className="font-medium text-[rgb(var(--lp-text))]">{label}</span>
                  <span className="text-[rgb(var(--lp-muted))]">–</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {designTab === "Backgrounds" && (
        <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
          {ShellUi.BACKGROUND_SECTION_LABELS.map((section) => (
            <section key={section} className="space-y-3">
              <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">
                {section} background image
              </h2>
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="flex items-center justify-center">
                  <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]">
                    <span className="text-xs text-[rgb(var(--lp-muted))]">+</span>
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                      {section} background image opacity
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-[rgb(var(--lp-muted))]">0</span>
                      <div className="relative h-1 flex-1 rounded-full bg-[rgb(var(--lp-border))]">
                        <div className="absolute inset-y-0 left-0 rounded-full bg-[rgb(var(--lp-text))]" />
                      </div>
                      <span className="flex items-center gap-1 text-[11px] text-[rgb(var(--lp-muted))]">
                        <span>100</span>
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                      {section} background image options
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                      {ShellUi.BACKGROUND_IMAGE_REPEAT_MODE_LABELS.map((label) => (
                        <button
                          key={label}
                          type="button"
                          className="min-h-[32px] rounded border border-[rgb(var(--lp-border))] bg-white px-2 text-[11px] font-medium text-[rgb(var(--lp-muted))]"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs md:grid-cols-5">
                      {ShellUi.BACKGROUND_IMAGE_POSITION_ICONS.map((icon, idx) => (
                        <button
                          key={`${section}-pos-${idx}`}
                          type="button"
                          className="flex min-h-[32px] items-center justify-center rounded border border-[rgb(var(--lp-border))] bg-white text-[11px] text-[rgb(var(--lp-muted))]"
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

    </>
  );
}
