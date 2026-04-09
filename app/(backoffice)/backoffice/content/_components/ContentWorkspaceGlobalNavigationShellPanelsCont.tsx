"use client";

import type { Dispatch, SetStateAction } from "react";
import * as ShellUi from "./contentWorkspaceShellUiConstants";

export type ContentWorkspaceGlobalNavigationShellPanelsContProps = {
  navigationTab: "member" | "cta" | "language" | "advanced";
  hideMemberNavigation: boolean;
  setHideMemberNavigation: Dispatch<SetStateAction<boolean>>;
  hideCtaNavigation: boolean;
  setHideCtaNavigation: Dispatch<SetStateAction<boolean>>;
  hideLanguageNavigation: boolean;
  setHideLanguageNavigation: Dispatch<SetStateAction<boolean>>;
  multilingualMode: "multiSite" | "oneToOne";
  setMultilingualMode: Dispatch<SetStateAction<"multiSite" | "oneToOne">>;
};

/** Member / CTA / Language / Advanced underfaner i global Navigation. Props-only presentasjon. */
export function ContentWorkspaceGlobalNavigationShellPanelsCont(
  props: ContentWorkspaceGlobalNavigationShellPanelsContProps
) {
  const {
    navigationTab,
    hideMemberNavigation,
    setHideMemberNavigation,
    hideCtaNavigation,
    setHideCtaNavigation,
    hideLanguageNavigation,
    setHideLanguageNavigation,
    multilingualMode,
    setMultilingualMode,
  } = props;

  return (
    <>
      {navigationTab === "member" ? (
        <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Hide member navigation</p>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Skjul eller vis egen navigasjon for innloggede/utloggede medlemmer.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={hideMemberNavigation}
                onClick={() => setHideMemberNavigation((v) => !v)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors ${hideMemberNavigation ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"
                  }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${hideMemberNavigation ? "translate-x-5" : "translate-x-0.5"
                    }`}
                />
              </button>
              <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">
                {hideMemberNavigation ? "YES" : "NO"}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[rgb(var(--lp-text))]">Navigation heading</span>
              <span className="text-xs text-[rgb(var(--lp-muted))]">
                Overstyrer standard overskrift definert i ordboken.
              </span>
              <input
                type="text"
                className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
              />
            </label>

            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <p className="font-medium text-[rgb(var(--lp-text))]">Logged in members navigation</p>
                <p className="max-w-xl text-xs text-[rgb(var(--lp-muted))]">
                  Velg sidene som skal vises i navigasjonen for innloggede medlemmer.
                </p>
                <button
                  type="button"
                  className="mt-1 flex h-11 items-center justify-center rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
                >
                  Add
                </button>
              </div>

              <div className="space-y-1">
                <p className="font-medium text-[rgb(var(--lp-text))]">Logged out members navigation</p>
                <p className="max-w-xl text-xs text-[rgb(var(--lp-muted))]">
                  Velg sidene som skal vises i navigasjonen for utloggede medlemmer.
                </p>
                <button
                  type="button"
                  className="mt-1 flex h-11 items-center justify-center rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : navigationTab === "cta" ? (
        <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Hide CTA navigation</p>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Sitewide call–to–action–knapper som brukes i hovednavigasjonen.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={hideCtaNavigation}
                onClick={() => setHideCtaNavigation((v) => !v)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors ${hideCtaNavigation ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"
                  }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${hideCtaNavigation ? "translate-x-5" : "translate-x-0.5"
                    }`}
                />
              </button>
              <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">
                {hideCtaNavigation ? "YES" : "NO"}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-[rgb(var(--lp-text))]">
              Sitewide call to action buttons
            </p>
            <p className="max-w-xl text-xs text-[rgb(var(--lp-muted))]">
              Disse knappene brukes som hoved–call–to–actions og vises på en fremtredende plass.
            </p>
            <button
              type="button"
              className="mt-1 flex h-11 items-center justify-center rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
            >
              Add
            </button>
          </div>
        </div>
      ) : navigationTab === "language" ? (
        <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
          <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-[rgb(var(--lp-muted))]">
            <p className="mb-1 font-medium text-[rgb(var(--lp-text))]">
              To tilnærminger til flerspråklige nettsteder
            </p>
            <p className="text-xs">
              <span className="font-semibold">Multi Site</span> – flere hjemmesider innenfor samme nettsted,
              hver med egne sider per språk.
            </p>
            <p className="mt-1 text-xs">
              <span className="font-semibold">One to One</span> – hver innholdnode finnes i flere språkvarianter
              og språk–navigasjonen genereres automatisk.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Hide language navigation</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={hideLanguageNavigation}
                onClick={() => setHideLanguageNavigation((v) => !v)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors ${hideLanguageNavigation ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"
                  }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${hideLanguageNavigation ? "translate-x-5" : "translate-x-0.5"
                    }`}
                />
              </button>
              <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">
                {hideLanguageNavigation ? "YES" : "NO"}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Multilingual configuration</p>
            <div className="mt-1 flex gap-2">
              {ShellUi.MULTILINGUAL_MODE_TAB_TUPLES.map(([value, label]) => {
                const selected = multilingualMode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMultilingualMode(value as "multiSite" | "oneToOne")}
                    className={`min-h-10 rounded-full px-4 text-xs font-semibold ${selected
                      ? "bg-slate-600 text-white"
                      : "border border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-muted))]"
                      }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[rgb(var(--lp-text))]">Disable delete</p>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Hvis  ««Yes «» er valgt vil sletting av denne noden blokkeres og en advarsel vises.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
            >
              YES
            </button>
          </div>
        </div>
      )}
    </>
  );
}
