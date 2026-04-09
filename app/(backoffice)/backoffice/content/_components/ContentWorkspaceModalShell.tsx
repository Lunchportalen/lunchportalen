"use client";

import {
  ContentWorkspaceModalStack,
  type ContentWorkspaceModalStackProps,
} from "./ContentWorkspaceModalStack";

export type ContentWorkspaceModalShellProps = {
  stack: ContentWorkspaceModalStackProps;
  onboardingStep: number;
  onOnboardingSkip: () => void;
  onOnboardingStart: () => void;
  onOnboardingFinish: () => void;
  isPitch: boolean;
  pitchStep: number;
  onPitchImprove: () => void;
  onPitchAudit: () => void;
  onPitchGenerateImage: () => void;
  onPitchToggleAfter: () => void;
  onPitchPrev: () => void;
  onPitchNext: () => void;
};

/** Modal-stack + onboarding + pitch — wiring/JSX; callbacks eies av skallet. */
export function ContentWorkspaceModalShell({
  stack,
  onboardingStep,
  onOnboardingSkip,
  onOnboardingStart,
  onOnboardingFinish,
  isPitch,
  pitchStep,
  onPitchImprove,
  onPitchAudit,
  onPitchGenerateImage,
  onPitchToggleAfter,
  onPitchPrev,
  onPitchNext,
}: ContentWorkspaceModalShellProps) {
  return (
    <>
      <ContentWorkspaceModalStack {...stack} />
      {onboardingStep > 0 ? (
        <div className="pointer-events-none fixed inset-0 z-[70] bg-black/40">
          <div className="pointer-events-auto absolute right-3 top-3">
            <button
              type="button"
              className="rounded-lg border border-white/20 bg-black/80 px-3 py-1.5 text-xs font-medium text-white transition-all duration-150 ease-out hover:bg-black"
              onClick={onOnboardingSkip}
            >
              Hopp over
            </button>
          </div>

          {onboardingStep === 1 ? (
            <div className="pointer-events-auto absolute left-1/2 top-1/2 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-2xl">
              <p className="text-lg font-semibold text-black">Velkommen 👋</p>
              <p className="mt-1 text-sm text-gray-700">La oss forbedre en side på 30 sek</p>
              <button
                type="button"
                className="mt-4 rounded-lg bg-black px-3 py-2 text-sm font-medium text-white transition-all duration-150 ease-out hover:bg-black/90"
                onClick={onOnboardingStart}
              >
                Start
              </button>
            </div>
          ) : null}

          {onboardingStep === 2 ? (
            <div className="pointer-events-auto absolute left-1/2 top-24 w-[min(92vw,360px)] -translate-x-1/2 rounded-xl bg-white p-4 shadow-2xl">
              <p className="text-sm font-semibold text-black">Klikk på en blokk</p>
              <p className="mt-1 text-xs text-gray-600">Vi har valgt første blokk for deg hvis nødvendig.</p>
            </div>
          ) : null}

          {onboardingStep === 4 ? (
            <div className="pointer-events-auto absolute left-1/2 top-24 w-[min(92vw,320px)] -translate-x-1/2 rounded-xl bg-white p-4 shadow-2xl">
              <p className="text-sm font-semibold text-black">Se forskjellen ✨</p>
              <p className="mt-1 text-xs text-gray-600">AI har forbedret teksten i valgt blokk.</p>
            </div>
          ) : null}

          {onboardingStep === 6 ? (
            <div className="pointer-events-auto absolute left-1/2 top-1/2 w-[min(92vw,360px)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-2xl">
              <p className="text-lg font-semibold text-black">Du er i gang 🚀</p>
              <p className="mt-1 text-sm text-gray-700">Nå kan du bruke AI-verktøyene fritt.</p>
              <button
                type="button"
                className="mt-4 rounded-lg bg-black px-3 py-2 text-sm font-medium text-white transition-all duration-150 ease-out hover:bg-black/90"
                onClick={onOnboardingFinish}
              >
                Fortsett
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {isPitch ? (
        <div className="fixed inset-0 z-[74] bg-black/45">
          <div className="pointer-events-none absolute inset-0" />
          <div className="pointer-events-auto absolute left-1/2 top-6 w-[min(92vw,640px)] -translate-x-1/2 rounded-xl border border-white/15 bg-black/80 p-4 text-white shadow-2xl">
            <div className="text-sm font-semibold">
              {pitchStep === 1 ? "Dette er en vanlig side" : null}
              {pitchStep === 2 ? "Teksten er svak og lite salgsutlosende" : null}
              {pitchStep === 3 ? "Forbedre med AI" : null}
              {pitchStep === 4 ? "Se forskjellen" : null}
              {pitchStep === 5 ? "Analyser siden" : null}
              {pitchStep === 6 ? "Generer bilde" : null}
              {pitchStep >= 7 ? "Dette skjer på sekunder - ikke dager" : null}
            </div>
            <div className="mt-1 text-xs text-white/80">Pitch-modus: kontrollert demo uten lagring og uten frie klikk.</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {pitchStep === 3 ? (
                <button
                  type="button"
                  onClick={onPitchImprove}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black transition-all duration-150 ease-out hover:bg-white/90"
                >
                  Forbedre med AI
                </button>
              ) : null}
              {pitchStep === 5 ? (
                <button
                  type="button"
                  onClick={onPitchAudit}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black transition-all duration-150 ease-out hover:bg-white/90"
                >
                  Kjør audit
                </button>
              ) : null}
              {pitchStep === 6 ? (
                <button
                  type="button"
                  onClick={onPitchGenerateImage}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black transition-all duration-150 ease-out hover:bg-white/90"
                >
                  Generer bilde
                </button>
              ) : null}
              <button
                type="button"
                onClick={onPitchToggleAfter}
                className="rounded-lg border border-white/20 bg-black/40 px-3 py-1.5 text-xs font-medium text-white transition-all duration-150 ease-out hover:bg-black/60"
              >
                For / Etter
              </button>
            </div>
          </div>
          <div className="pointer-events-auto fixed bottom-4 right-4 flex gap-2">
            <button
              type="button"
              onClick={onPitchPrev}
              className="rounded-lg border border-white/20 bg-black/80 px-3 py-2 text-sm font-medium text-white transition-all duration-150 ease-out hover:bg-black"
            >
              ←
            </button>
            <button
              type="button"
              onClick={onPitchNext}
              className="rounded-lg border border-white/20 bg-black/80 px-3 py-2 text-sm font-medium text-white transition-all duration-150 ease-out hover:bg-black"
            >
              →
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
