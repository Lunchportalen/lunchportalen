"use client";

import { useEffect, useState } from "react";

import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import { analyzePageBlocks } from "@/lib/cms/editorSmartHints";
import { personalizationHintLine } from "@/lib/cms/editorPersonalization";

const CMS_ONBOARD_KEY = "lp_cms_editor_onboarding_v1";

export type EditorSmartHintsBannerProps = {
  blocks: Block[];
  /** Scroll user to embedded AI «sett inn seksjon» control */
  sectionGeneratorAnchorId?: string;
};

/**
 * Page-level smart hints + one-click jump to «Generer seksjon» (existing AI pipeline).
 */
export function EditorSmartHintsBanner({
  blocks,
  sectionGeneratorAnchorId = "lp-cms-ai-section-insert",
}: EditorSmartHintsBannerProps) {
  const [showFirstVisitGuide, setShowFirstVisitGuide] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      setShowFirstVisitGuide(!window.localStorage.getItem(CMS_ONBOARD_KEY));
    } catch {
      setShowFirstVisitGuide(false);
    }
  }, []);

  const dismissFirstVisitGuide = () => {
    try {
      window.localStorage.setItem(CMS_ONBOARD_KEY, "1");
    } catch {
      /* ignore */
    }
    setShowFirstVisitGuide(false);
  };

  const { hints, avgScore } = analyzePageBlocks(blocks);
  const personal = personalizationHintLine();
  const merged = personal ? [personal, ...hints] : hints;
  const showHintList = merged.length > 0;
  const showScoreLine = avgScore < 78;

  const scrollToSectionAi = () => {
    document.getElementById(sectionGeneratorAnchorId)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="space-y-3">
      {showFirstVisitGuide ? (
        <div
          className="rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm shadow-sm"
          role="region"
          aria-label="Kort veiledning"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-xs font-semibold text-[rgb(var(--lp-text))]">Slik redigerer du siden</p>
            <button
              type="button"
              onClick={dismissFirstVisitGuide}
              className="shrink-0 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/40 px-2.5 py-1 text-[11px] font-medium text-[rgb(var(--lp-text))] transition-[opacity,transform] duration-150 hover:opacity-90"
            >
              Forstått
            </button>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[rgb(var(--lp-muted))]">
            Legg til en blokk, utvid raden for å redigere felt, eller klikk i forhåndsvisningen. Lagre når du er fornøyd — AI foreslår aldri endringer uten at du velger dem.
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-dashed border-pink-400/35 bg-pink-50/25 px-3 py-2.5 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[rgb(var(--lp-text))]">Smarte hint</p>
            {showScoreLine ? (
              <p className="mt-0.5 text-[11px] text-[rgb(var(--lp-muted))]">
                Sidegjennomsnitt: <span className="font-medium text-[rgb(var(--lp-text))]">{avgScore}/100</span>
                {avgScore < 62 ? " — fyll ut åpenbare hull før publisering." : " — små forbedringer gir ofte bedre konvertering."}
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] text-[rgb(var(--lp-muted))]">
                Strukturen ser solid ut. Bruk knappen for å sette inn en ny seksjon med AI når du trenger det.
              </p>
            )}
            {showHintList ? (
              <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[11px] text-[rgb(var(--lp-text))]">
                {merged.slice(0, 4).map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <button
            type="button"
            onClick={scrollToSectionAi}
            className="shrink-0 rounded-lg border border-pink-400/40 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-pink-700 shadow-sm transition-[opacity,transform] duration-150 hover:bg-pink-50"
          >
            ✨ Generer seksjon
          </button>
        </div>
        <p className="mt-2 text-[10px] text-[rgb(var(--lp-muted))]">
          AI endrer aldri innhold automatisk — du velger forslag og lagrer selv.
        </p>
      </div>
    </div>
  );
}
