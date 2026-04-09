"use client";

import * as ShellUi from "./contentWorkspaceShellUiConstants";

export type ContentWorkspaceMainViewShellColorsLeadProps = {
  colorsContentBg: string;
  colorsButtonBg: string;
  colorsButtonText: string;
  colorsButtonBorder: string;
  setColorsContentBg: (v: string) => void;
  setColorsButtonBg: (v: string) => void;
  setColorsButtonText: (v: string) => void;
  setColorsButtonBorder: (v: string) => void;
};

export function ContentWorkspaceMainViewShell({ designTab }: { designTab: string }) {
  return (
    <>
      {designTab === "Layout" && (
        <div className="space-y-3 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4">
          {ShellUi.DESIGN_LAYOUT_SECTION_LABELS.map((section) => (
            <details
              key={section}
              className="group rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]"
              open={section === "Site Header"}
            >
              <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-[rgb(var(--lp-text))]">
                <span>{section}</span>
                <span className="text-[rgb(var(--lp-muted))] group-open:rotate-180">–</span>
              </summary>
            </details>
          ))}
        </div>
      )}

      {designTab === "Logo" && (
        <div className="space-y-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
          <section className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Website logo</h2>
            </div>
            <div className="row-span-2 flex items-center justify-center">
              <div className="flex h-32 w-64 items-center justify-center rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]">
                <span className="text-xs text-[rgb(var(--lp-muted))]">Logo</span>
              </div>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Favicon</h2>
              <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                En favicon er et lite ikon som brukes som branding for nettstedet. Vises i nettleserfaner og
                blant favoritter.
              </p>
            </div>
            <div className="row-span-2 flex items-center justify-center">
              <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]">
                <span className="text-xs text-[rgb(var(--lp-muted))]">Favicon</span>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export function ContentWorkspaceMainViewShellColorsLead({
  colorsContentBg,
  colorsButtonBg,
  colorsButtonText,
  colorsButtonBorder,
  setColorsContentBg,
  setColorsButtonBg,
  setColorsButtonText,
  setColorsButtonBorder,
}: ContentWorkspaceMainViewShellColorsLeadProps) {
  return (
    <>
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">
                Color palette
              </h2>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Lag en fargepalett som brukes i designet. Valgene vises i fargevelgeren for enkel gjenbruk.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {ShellUi.DESIGN_COLOR_PALETTE_HEX_SWATCHES.map((hex, idx) => (
                  <label key={idx} className="flex cursor-pointer items-center gap-0.5 rounded border border-[rgb(var(--lp-border))] p-0.5">
                    <input type="color" defaultValue={hex} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
                    <span className="text-[10px] text-[rgb(var(--lp-muted))]">–</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white text-sm">+</button>
                <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white text-sm">+</button>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">
                Baseline colors
              </h2>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Bygg opp basisfargepaletten for temaet ditt.
              </p>

              {[
                { id: "body", label: "Body", solidGradient: true, fields: [{ key: "background", label: "Background", hex: "#f2e8ce" }] },
                {
                  id: "header",
                  label: "Header",
                  solidGradient: true,
                  fields: [
                    { key: "background", label: "Background", hex: "#f2e8ce" },
                    { key: "text", label: "Text", hex: "#644b36" },
                    { key: "highlight", label: "Highlight", hex: "#fb6f01" },
                    { key: "borders", label: "Borders", hex: "#d7d7d7" },
                  ],
                },
                { id: "logo", label: "Logo", solidGradient: false, fields: [{ key: "color", label: "Logo", hex: "#644b36" }] },
                {
                  id: "link",
                  label: "Link",
                  solidGradient: false,
                  fields: [
                    { key: "link", label: "Link", hex: "#644b36" },
                    { key: "linkHover", label: "Link hover", hex: "#000000" },
                  ],
                },
                {
                  id: "mainnav",
                  label: "Main navigation",
                  solidGradient: false,
                  fields: [
                    { key: "link", label: "Link", hex: "#5d4a3a" },
                    { key: "linkActive", label: "Link active", hex: "#000000" },
                    { key: "linkHover", label: "Link hover", hex: "#000000" },
                  ],
                },
                {
                  id: "secondarynav",
                  label: "Secondary navigation",
                  solidGradient: false,
                  fields: [
                    { key: "link", label: "Link", hex: "#5d4a3a" },
                    { key: "linkHover", label: "Link hover", hex: "#5d4a3a" },
                  ],
                },
                {
                  id: "navdropdowns",
                  label: "Navigation dropdowns",
                  solidGradient: true,
                  fields: [
                    { key: "background", label: "Background", hex: "#f8f8f8" },
                    { key: "link", label: "Link", hex: "#5d4a3a" },
                    { key: "linkHover", label: "Link hover", hex: "#4f4f4f" },
                    { key: "linkActive", label: "Link active", hex: "#000000" },
                  ],
                },
                {
                  id: "content",
                  label: "Content",
                  solidGradient: true,
                  fields: [
                    { key: "background", label: "Background", hex: colorsContentBg },
                    { key: "heading", label: "Heading", hex: "#000000" },
                    { key: "secondaryHeading", label: "Secondary Heading", hex: "#000000" },
                    { key: "text", label: "Text", hex: "#000000" },
                    { key: "link", label: "Link", hex: "#000000" },
                    { key: "linkHover", label: "Link hover", hex: "#000000" },
                    { key: "border", label: "Border", hex: "#000000" },
                    { key: "highlightBg", label: "Highlight background", hex: "#000000" },
                    { key: "highlightText", label: "Highlight text", hex: "#e5e5e5" },
                  ],
                },
                {
                  id: "button",
                  label: "Button",
                  solidGradient: true,
                  fields: [
                    { key: "background", label: "Background", hex: colorsButtonBg },
                    { key: "text", label: "Text", hex: colorsButtonText },
                    { key: "border", label: "Border", hex: colorsButtonBorder },
                  ],
                  hover: [
                    { key: "backgroundHover", label: "Background hover", hex: "#6e5338" },
                    { key: "textHover", label: "Text hover", hex: "#ffffff" },
                    { key: "borderHover", label: "Border hover", hex: "#6e5338" },
                  ],
                },
                {
                  id: "footer",
                  label: "Footer",
                  solidGradient: true,
                  fields: [
                    { key: "background", label: "Background", hex: "#f8e7a0" },
                    { key: "heading", label: "Heading", hex: "#644b36" },
                    { key: "text", label: "Text", hex: "#6e5338" },
                    { key: "linkHover", label: "Link hover", hex: "#4f4f4f" },
                    { key: "highlight", label: "Highlight", hex: "#000000" },
                    { key: "secondaryHeading", label: "Secondary heading", hex: "#000000" },
                    { key: "link", label: "Link", hex: "#000000" },
                    { key: "borders", label: "Borders", hex: "#d7d7d7" },
                  ],
                },
              ].map((section) => (
                <details key={section.id} className="group rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 text-sm font-medium text-[rgb(var(--lp-text))] [&::-webkit-details-marker]:hidden">
                    <span
                      className="h-6 w-6 shrink-0 rounded border border-[rgb(var(--lp-border))]"
                      style={{ backgroundColor: section.fields[0]?.hex ?? "#f2e8ce" }}
                      aria-hidden
                    />
                    <span className="flex-1">{section.label}</span>
                    <span className="text-[rgb(var(--lp-muted))] transition group-open:rotate-180">–</span>
                  </summary>
                  <div className="border-t border-[rgb(var(--lp-border))] px-3 pb-3 pt-2">
                    {section.solidGradient && (
                      <div className="mb-2 flex gap-1">
                        <button type="button" className="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-800">SOLID</button>
                        <button type="button" className="rounded px-2 py-1 text-xs font-medium text-[rgb(var(--lp-muted))]">GRADIENT</button>
                      </div>
                    )}
                    <div className="space-y-2">
                      {section.fields.map((field) => (
                        <div key={field.key} className="flex items-center justify-between gap-2">
                          <span className="text-xs text-[rgb(var(--lp-text))]">{field.label}</span>
                          <label className="flex cursor-pointer items-center gap-1">
                            <input
                              type="color"
                              defaultValue={field.hex}
                              onChange={(e) => {
                                if (section.id === "content" && field.key === "background") setColorsContentBg(e.target.value);
                                if (section.id === "button" && field.key === "background") setColorsButtonBg(e.target.value);
                                if (section.id === "button" && field.key === "text") setColorsButtonText(e.target.value);
                                if (section.id === "button" && field.key === "border") setColorsButtonBorder(e.target.value);
                              }}
                              className="h-6 w-6 cursor-pointer rounded border-0 border-transparent bg-transparent p-0"
                            />
                            <span className="text-[rgb(var(--lp-muted))]">–</span>
                          </label>
                        </div>
                      ))}
                    </div>
                    {"hover" in section && Array.isArray(section.hover) && (
                      <>
                        <p className="mt-3 mb-1 text-[10px] font-semibold uppercase text-[rgb(var(--lp-muted))]">Hover</p>
                        <div className="mb-2 flex gap-1">
                          <button type="button" className="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-800">SOLID</button>
                          <button type="button" className="rounded px-2 py-1 text-xs font-medium text-[rgb(var(--lp-muted))]">GRADIENT</button>
                        </div>
                        <div className="space-y-2">
                          {section.hover.map((field: { key: string; label: string; hex: string }) => (
                            <div key={field.key} className="flex items-center justify-between gap-2">
                              <span className="text-xs text-[rgb(var(--lp-text))]">{field.label}</span>
                              <label className="flex cursor-pointer items-center gap-1">
                                <input type="color" defaultValue={field.hex} className="h-6 w-6 cursor-pointer rounded border-0 border-transparent bg-transparent p-0" />
                                <span className="text-[rgb(var(--lp-muted))]">–</span>
                              </label>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </details>
              ))}
            </section>
    </>
  );
}
