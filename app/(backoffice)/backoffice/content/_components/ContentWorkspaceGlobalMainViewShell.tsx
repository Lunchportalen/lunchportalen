"use client";

import type { Dispatch, SetStateAction } from "react";
import { GlobalDesignSystemSection } from "./GlobalDesignSystemSection";
import * as ShellUi from "./contentWorkspaceShellUiConstants";

export type ContentSettingsTabKey =
  | "general"
  | "analytics"
  | "form"
  | "shop"
  | "globalContent"
  | "notification"
  | "scripts"
  | "advanced";

export type ContentWorkspaceGlobalMainViewShellProps = {
  exitGlobalSubView: () => void;
  contentSettingsTab: ContentSettingsTabKey;
  setContentSettingsTab: Dispatch<SetStateAction<ContentSettingsTabKey>>;
  contentDirection: "ltr" | "rtl";
  setContentDirection: Dispatch<SetStateAction<"ltr" | "rtl">>;
};

/**
 * Global workspace » Innhold og innstillinger: tilbake, underfaner, Generell + Analytics-paneler.
 * Props-only presentasjon; state eies i `ContentWorkspace.tsx` / overlays-hook.
 */
export function ContentWorkspaceGlobalMainViewShell({
  exitGlobalSubView,
  contentSettingsTab,
  setContentSettingsTab,
  contentDirection,
  setContentDirection,
}: ContentWorkspaceGlobalMainViewShellProps) {
  return (
    <>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => exitGlobalSubView()}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label="Tilbake til Global"
        >
          –
        </button>
        <h1 className="text-2xl font-semibold text-[rgb(var(--lp-text))]">Innhold og innstillinger</h1>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-[rgb(var(--lp-border))] pb-2">
        {ShellUi.CONTENT_SETTINGS_TAB_TUPLES.map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setContentSettingsTab(tab as ContentSettingsTabKey)}
            className={`min-h-9 rounded-t-lg border px-3 text-sm font-medium ${contentSettingsTab === tab
              ? "border-[rgb(var(--lp-border))] border-b-0 bg-white text-[rgb(var(--lp-text))] -mb-px"
              : "border-transparent text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {contentSettingsTab === "general" && (
        <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
          <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">
            Denne seksjonen styrer globale innstillinger som gjelder hele nettstedet.
          </div>
          <GlobalDesignSystemSection />
          <div className="grid gap-4">
            <label className="grid gap-1">
              <span className="font-medium text-[rgb(var(--lp-text))]">Designstil *</span>
              <span className="text-xs text-[rgb(var(--lp-muted))]">Velg designstil for nettstedet.</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  defaultValue="Standard"
                  className="h-10 flex-1 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                  readOnly
                />
                <button type="button" className="text-sm text-[rgb(var(--lp-muted))] hover:underline">
                  Å
                </button>
                <button type="button" className="text-sm text-[rgb(var(--lp-muted))] hover:underline">
                  Fjern
                </button>
              </div>
            </label>

            <label className="grid gap-1">
              <span className="font-medium text-[rgb(var(--lp-text))]">Nettstedsnavn *</span>
              <span className="text-xs text-[rgb(var(--lp-muted))]">
                Vises i standard Meta-tittel og som logo-tekst (skjules hvis logo er lagt til).
              </span>
              <input
                type="text"
                placeholder="F.eks. Lunchportalen"
                className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
              />
            </label>

            <label className="grid gap-1">
              <span className="font-medium text-[rgb(var(--lp-text))]">Standard delingsbilde</span>
              <span className="text-xs text-[rgb(var(--lp-muted))]">
                Bilde som brukes når noen deler en side på sosiale medier (f.eks. X eller Facebook).
              </span>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
                  Bilde
                </div>
                <p className="text-xs text-[rgb(var(--lp-muted))]">Anbefaler minst 1200×630 px.</p>
              </div>
            </label>

            <label className="grid gap-1">
              <span className="font-medium text-[rgb(var(--lp-text))]">
                X (Twitter) nettstedsbrukernavn
              </span>
              <span className="text-xs text-[rgb(var(--lp-muted))]">
                Brukernavn som vises i X (Twitter)-kortets footer.
              </span>
              <input
                type="text"
                placeholder="@nettsted"
                className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
              />
            </label>

            <label className="grid gap-1">
              <span className="font-medium text-[rgb(var(--lp-text))]">
                Override language code reference
              </span>
              <span className="text-xs text-[rgb(var(--lp-muted))]">ISO Language Codes.</span>
              <input
                type="text"
                placeholder="no"
                className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
              />
            </label>

            <div className="grid gap-1">
              <span className="font-medium text-[rgb(var(--lp-text))]">Leseretning (content direction)</span>
              <span className="text-xs text-[rgb(var(--lp-muted))]">
                Velg om innhold skal vises venstre-til-høyre (LTR) eller høyre-til-venstre (RTL).
              </span>
              <div className="mt-2 flex gap-2">
                {ShellUi.CONTENT_DIRECTION_LTR_RTL_TUPLES.map(([value, label]) => {
                  const selected = contentDirection === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setContentDirection(value as "ltr" | "rtl")}
                      className={`flex flex-1 flex-col items-center gap-1 rounded-xl border px-4 py-3 text-sm ${selected
                        ? "border-slate-400 bg-slate-50 text-[rgb(var(--lp-text))]"
                        : "border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-muted))]"
                        }`}
                    >
                      <span className="text-lg" aria-hidden>
                        {value === "ltr" ? "–" : "–"}
                      </span>
                      <span className="font-medium">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-4">
              <div className="grid gap-1">
                <span className="font-medium text-[rgb(var(--lp-text))]">Global search results page</span>
                <span className="text-xs text-[rgb(var(--lp-muted))]">
                  Hvis ingen side er valgt vil søkeskjemaet ikke vises.
                </span>
                <div className="mt-2 flex items-center justify-between rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-white px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-[rgb(var(--lp-text))]">Search</p>
                    <p className="text-xs text-[rgb(var(--lp-muted))]">/search/</p>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-medium text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
                  >
                    Fjern
                  </button>
                </div>
              </div>

              <div className="grid gap-1">
                <span className="font-medium text-[rgb(var(--lp-text))]">Page not found</span>
                <span className="text-xs text-[rgb(var(--lp-muted))]">
                  Vises hvis den forespurte URL-en ikke finnes.
                </span>
                <div className="mt-2 flex items-center justify-between rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-white px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-[rgb(var(--lp-text))]">Page not found</p>
                    <p className="text-xs text-[rgb(var(--lp-muted))]">/page-not-found/</p>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-medium text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
                  >
                    Fjern
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {contentSettingsTab === "analytics" && (
        <div className="space-y-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[rgb(var(--lp-text))]">
                Google Analytics tracking ID
              </span>
              <span className="text-xs text-[rgb(var(--lp-muted))]">Besøk Google Analytics.</span>
              <input
                type="text"
                className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                placeholder="UA-XXXXXXX-X eller G-XXXXXXX"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[rgb(var(--lp-text))]">Google Tag Manager ID</span>
              <span className="text-xs text-[rgb(var(--lp-muted))]">Besøk Google Tag Manager.</span>
              <input
                type="text"
                className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                placeholder="GTM-XXXXXXX"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[rgb(var(--lp-text))]">Facebook pixel</span>
              <span className="text-xs text-[rgb(var(--lp-muted))]">Besøk Facebook.</span>
              <input
                type="text"
                className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                placeholder="Pixel ID"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[rgb(var(--lp-text))]">X (Twitter) pixel</span>
              <span className="text-xs text-[rgb(var(--lp-muted))]">Besøk X (Twitter).</span>
              <input
                type="text"
                className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                placeholder="Pixel ID"
              />
            </label>
          </div>
        </div>
      )}
    </>
  );
}
