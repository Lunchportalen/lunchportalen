"use client";

import type { Dispatch, SetStateAction } from "react";
import { ContentWorkspaceDesignTabHeader, type DesignWorkspaceTab } from "./ContentWorkspaceDesignTabHeader";
import { ContentWorkspaceMainViewShell, ContentWorkspaceMainViewShellColorsLead } from "./ContentWorkspaceMainViewShell";
import {
  ContentWorkspaceMainViewShellColorsContinuation,
  ContentWorkspaceMainViewShellCont,
} from "./ContentWorkspaceMainViewShellCont";
export type ContentWorkspaceDesignTailShellProps = {
  designTab: DesignWorkspaceTab;
  setDesignTab: Dispatch<SetStateAction<DesignWorkspaceTab>>;
  colorsContentBg: string;
  colorsButtonBg: string;
  colorsButtonText: string;
  colorsButtonBorder: string;
  setColorsContentBg: Dispatch<SetStateAction<string>>;
  setColorsButtonBg: Dispatch<SetStateAction<string>>;
  setColorsButtonText: Dispatch<SetStateAction<string>>;
  setColorsButtonBorder: Dispatch<SetStateAction<string>>;
  labelColors: Array<{ background: string; text: string }>;
  setLabelColors: Dispatch<SetStateAction<Array<{ background: string; text: string }>>>;
};

/**
 * Design workspace: tab-header, farger/CSS/JS/Advanced-plassholdere og save-bar.
 * Kun presentasjon flyttet fra `ContentWorkspace.tsx` (FASE 32).
 */
export function ContentWorkspaceDesignTailShell(props: ContentWorkspaceDesignTailShellProps) {
  const {
    designTab,
    setDesignTab,
    colorsContentBg,
    colorsButtonBg,
    colorsButtonText,
    colorsButtonBorder,
    setColorsContentBg,
    setColorsButtonBg,
    setColorsButtonText,
    setColorsButtonBorder,
    labelColors,
    setLabelColors,
  } = props;

  return (
    <div className="space-y-6">
      <ContentWorkspaceDesignTabHeader designTab={designTab} setDesignTab={setDesignTab} />

      <ContentWorkspaceMainViewShell designTab={designTab} />

      {designTab === "Colors" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
            <ContentWorkspaceMainViewShellColorsLead
              colorsContentBg={colorsContentBg}
              colorsButtonBg={colorsButtonBg}
              colorsButtonText={colorsButtonText}
              colorsButtonBorder={colorsButtonBorder}
              setColorsContentBg={setColorsContentBg}
              setColorsButtonBg={setColorsButtonBg}
              setColorsButtonText={setColorsButtonText}
              setColorsButtonBorder={setColorsButtonBorder}
            />
            <ContentWorkspaceMainViewShellColorsContinuation labelColors={labelColors} setLabelColors={setLabelColors} />
          </div>
          <div className="hidden lg:block">
            <div
              className="sticky top-6 rounded-xl border border-[rgb(var(--lp-border))] p-6"
              style={{ backgroundColor: colorsContentBg, minHeight: 320 }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--lp-text))]/70">Preview on desktop</p>
              <p className="mt-2 text-lg font-bold text-[rgb(var(--lp-text))]">SECONDARY HEADING</p>
              <h2 className="mt-1 text-2xl font-bold text-[rgb(var(--lp-text))]">Headings here</h2>
              <p className="mt-3 text-sm leading-relaxed text-[rgb(var(--lp-text))]">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.{" "}
                <span className="underline">feugiat risus</span> quis nostrud exercitation.{" "}
                <span className="rounded bg-black px-1 py-0.5 text-white">Vivamus consequat</span> ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </p>
              <p className="mt-2 text-4xl font-serif text-[rgb(var(--lp-text))]">&quot;</p>
              <p className="mt-2 text-sm text-[rgb(var(--lp-text))]">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  className="rounded-lg border-2 px-4 py-2 text-sm font-medium"
                  style={{ backgroundColor: colorsButtonBg, color: colorsButtonText, borderColor: colorsButtonBorder }}
                >
                  Lorem ipsum dolor
                </button>
                <button
                  type="button"
                  className="rounded-lg border-2 px-4 py-2 text-sm font-medium"
                  style={{ backgroundColor: colorsButtonBg, color: colorsButtonText, borderColor: colorsButtonBorder }}
                >
                  Vivamus consequat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ContentWorkspaceMainViewShellCont designTab={designTab} />
      {designTab === "CSS" && (
        <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Custom CSS</h2>
            <p className="text-xs text-[rgb(var(--lp-muted))]">
              Legg til tilpasset CSS som kun brukes av dette designet.
            </p>
            <textarea
              rows={14}
              className="w-full rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 font-mono text-xs text-[rgb(var(--lp-text))]"
            />
          </section>

          <section className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">
                Additional content color CSS
              </h2>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Brukes til å generere ekstra CSS for innholdsfarger definert under Colors.
              </p>
              <textarea
                rows={4}
                className="w-full rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 font-mono text-xs text-[rgb(var(--lp-text))]"
              />
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">
                Additional button color CSS
              </h2>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Brukes til å style ekstra knappfarger (for eksempel CTA–knapper) fra Colors–fanen.
              </p>
              <textarea
                rows={8}
                className="w-full rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 font-mono text-xs text-[rgb(var(--lp-text))]"
              />
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Additional print only CSS</h2>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Brukes til å definere egne stiler som bare gjelder for utskrift.
              </p>
              <textarea
                rows={4}
                className="w-full rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 font-mono text-xs text-[rgb(var(--lp-text))]"
              />
            </div>
          </section>
        </div>
      )}

      {designTab === "JavaScript" && (
        <div className="space-y-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
          <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Custom JS</h2>
          <p className="text-xs text-[rgb(var(--lp-muted))]">
            Legg til JavaScript som kun brukes av dette designet. Ikke inkluder <code>&lt;script&gt;</code>
            –tagger; disse legges til automatisk.
          </p>
          <textarea
            rows={18}
            className="w-full rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 font-mono text-xs text-[rgb(var(--lp-text))]"
          />
        </div>
      )}

      {designTab === "Advanced" && (
        <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
          <section className="space-y-3">
            <div className="rounded-lg bg-[rgb(var(--lp-card))] px-4 py-3 text-xs text-[rgb(var(--lp-muted))]">
              <p className="mb-1 text-sm font-semibold text-[rgb(var(--lp-text))]">Frontend source</p>
              <p>
                 ««Frontend source «» er mappen med kildekode for designet. Standardverdi er{" "}
                <span className="font-mono">uSkinned</span>. Hvis du endrer kildekode bør du opprette egne
                mappeøpostmaler og partials, og registrere disse i{" "}
                <span className="font-mono">appsettings.json</span>.
              </p>
            </div>

            <div className="space-y-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-[rgb(var(--lp-text))]">Frontend source*</span>
                <select className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 text-sm">
                  <option>uSkinned</option>
                </select>
              </label>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Disable delete</h2>
            <p className="text-xs text-[rgb(var(--lp-muted))]">
              Hvis  ««Yes «» er valgt, vil forsøk på å slette denne noden blokkeres og en advarsel vises.
            </p>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
            >
              YES
            </button>
          </section>
        </div>
      )}

      {designTab !== "Layout" &&
        designTab !== "Logo" &&
        designTab !== "Colors" &&
        designTab !== "Fonts" &&
        designTab !== "Backgrounds" &&
        designTab !== "CSS" &&
        designTab !== "JavaScript" &&
        designTab !== "Advanced" && (
          <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
            <p className="text-sm text-[rgb(var(--lp-muted))]">
              {designTab}–fanen. Kommer senere i design–systemet.
            </p>
          </div>
        )}

      <div className="flex items-center justify-between border-t border-[rgb(var(--lp-border))] pt-4">
        <p className="text-xs text-[rgb(var(--lp-muted))]">Design / Shop Design</p>
        <div className="flex gap-2">
          <button
            type="button"
            className="min-h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-4 text-sm font-medium text-green-700 hover:bg-slate-50"
          >
            Save
          </button>
          <button
            type="button"
            className="min-h-9 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700"
          >
            Save and publish
          </button>
        </div>
      </div>
    </div>
  );
}
