"use client";

import type { Dispatch, SetStateAction } from "react";
import * as ShellUi from "./contentWorkspaceShellUiConstants";

export type ContentWorkspaceGlobalNavigationShellPanelsLeadProps = {
  navigationTab: "main" | "secondary" | "footer";
  hideMainNavigation: boolean;
  setHideMainNavigation: Dispatch<SetStateAction<boolean>>;
  hideSecondaryNavigation: boolean;
  setHideSecondaryNavigation: Dispatch<SetStateAction<boolean>>;
  hideFooterNavigation: boolean;
  setHideFooterNavigation: Dispatch<SetStateAction<boolean>>;
};

/** Main / Secondary / Footer underfaner i global Navigation. Props-only presentasjon. */
export function ContentWorkspaceGlobalNavigationShellPanelsLead(
  props: ContentWorkspaceGlobalNavigationShellPanelsLeadProps
) {
  const {
    navigationTab,
    hideMainNavigation,
    setHideMainNavigation,
    hideSecondaryNavigation,
    setHideSecondaryNavigation,
    hideFooterNavigation,
    setHideFooterNavigation,
  } = props;

  return (
    <>
      {navigationTab === "main" ? (
        <div className="space-y-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Hide main navigation</p>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Hvis aktivert skjules hovednavigasjonen på nettstedet.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={hideMainNavigation}
                onClick={() => setHideMainNavigation((v) => !v)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors ${hideMainNavigation ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"
                  }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${hideMainNavigation ? "translate-x-5" : "translate-x-0.5"
                    }`}
                />
              </button>
              <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">
                {hideMainNavigation ? "YES" : "NO"}
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Main navigation</p>
            <div className="space-y-2 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-3">
              {ShellUi.MAIN_NAV_PREVIEW_LABELS.map((label, index) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-[rgb(var(--lp-text))]"
                >
                  <button
                    type="button"
                    className="mr-1 flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-[rgb(var(--lp-border))] text-xs text-[rgb(var(--lp-muted))]"
                    aria-label="Flytt"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="flex h-7 items-center rounded-md border border-dashed border-[rgb(var(--lp-border))] px-2 text-xs text-[rgb(var(--lp-muted))]"
                  >
                    Icon
                  </button>
                  <button
                    type="button"
                    className="flex h-7 items-center rounded-md border border-dashed border-[rgb(var(--lp-border))] px-2 text-xs text-[rgb(var(--lp-muted))]"
                  >
                    Rel
                  </button>
                  <div className="mx-2 flex-1 truncate font-medium">
                    {index === 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <span aria-hidden>⌂ </span>
                        <span>{label}</span>
                      </span>
                    ) : (
                      label
                    )}
                  </div>
                  <button
                    type="button"
                    className="text-xs font-medium text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    className="ml-1 flex h-8 w-8 items-center justify-center rounded-md bg-slate-600 text-white"
                    aria-label="Slett"
                  >
                    –
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="flex h-9 items-center justify-center rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-white text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      ) : navigationTab === "secondary" ? (
        <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Hide secondary navigation</p>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Velg hvilke lenker som skal vises i  ««Secondary Navigation «».
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={hideSecondaryNavigation}
                onClick={() => setHideSecondaryNavigation((v) => !v)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors ${hideSecondaryNavigation ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"
                  }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${hideSecondaryNavigation ? "translate-x-5" : "translate-x-0.5"
                    }`}
                />
              </button>
              <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">
                {hideSecondaryNavigation ? "YES" : "NO"}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Secondary navigation</p>
            <p className="max-w-xl text-xs text-[rgb(var(--lp-muted))]">
              Velg sidene som skal vises i secondary navigation. Feltet  ««Link title «» brukes som lenketekst.
            </p>
            <button
              type="button"
              className="mt-1 flex h-11 items-center justify-center rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Hide footer navigation</p>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Velg hvilke lenker som skal vises i footer navigation.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={hideFooterNavigation}
                onClick={() => setHideFooterNavigation((v) => !v)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors ${hideFooterNavigation ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"
                  }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${hideFooterNavigation ? "translate-x-5" : "translate-x-0.5"
                    }`}
                />
              </button>
              <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">
                {hideFooterNavigation ? "YES" : "NO"}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Footer navigation</p>
            <p className="max-w-xl text-xs text-[rgb(var(--lp-muted))]">
              Velg sidene som skal vises i footer navigation. Feltet  ««Link title «» brukes som lenketekst.
            </p>

            <div className="space-y-2 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-3">
              {ShellUi.FOOTER_LEGAL_LINK_LABELS.map((label) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-[rgb(var(--lp-text))]"
                >
                  <button
                    type="button"
                    className="mr-1 flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-[rgb(var(--lp-border))] text-xs text-[rgb(var(--lp-muted))]"
                    aria-label="Flytt"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="flex h-7 items-center rounded-md border border-dashed border-[rgb(var(--lp-border))] px-2 text-xs text-[rgb(var(--lp-muted))]"
                  >
                    Icon
                  </button>
                  <button
                    type="button"
                    className="flex h-7 items-center rounded-md border border-dashed border-[rgb(var(--lp-border))] px-2 text-xs text-[rgb(var(--lp-muted))]"
                  >
                    Rel
                  </button>
                  <div className="mx-2 flex-1 truncate font-medium">{label}</div>
                  <button
                    type="button"
                    className="text-xs font-medium text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    className="ml-1 flex h-8 w-8 items-center justify-center rounded-md bg-slate-600 text-white"
                    aria-label="Slett"
                  >
                    –
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="flex h-9 items-center justify-center rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-white text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
