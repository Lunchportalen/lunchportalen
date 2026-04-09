"use client";

import type { Block } from "./editorBlockTypes";
import {
  ContentWorkspaceEditorLowerControls,
  type ContentWorkspaceEditorLowerControlsProps,
} from "./ContentWorkspaceEditorChrome";

export type ContentWorkspaceAuxiliaryShellProps = {
  lowerControls: ContentWorkspaceEditorLowerControlsProps;
  demo: null | {
    isWow: boolean;
    onRestart: () => void;
    onToggleBeforeAfter: () => void;
  };
  aiInputs: {
    isPitch: boolean;
    aiProduct: string;
    setAiProduct: (v: string) => void;
    aiAudience: string;
    setAiAudience: (v: string) => void;
    aiIntent: string;
    setAiIntent: (v: string) => void;
    runAiBuild: () => void | Promise<void>;
    aiBuildLoading: boolean;
    runAiAudit: () => void | Promise<void>;
    aiAuditLoading: boolean;
    onboardingStep: number;
    setOnboardingStep: (n: number | ((p: number) => number)) => void;
  };
  aiBuildResult: unknown[] | null;
  onApplyAiBuild: () => void;
  selectedBlockTools: null | {
    block: Block;
    imagePresetLabels: Record<string, string>;
    imagePreset: string;
    setImagePreset: (k: string) => void;
    runAiImage: () => void | Promise<void>;
    runAiImageBatch: () => void | Promise<void>;
    aiAnyLoading: boolean;
    aiImageLoading: boolean;
    aiBatchLoading: boolean;
    runAiAction: (kind: "improve" | "shorten" | "seo") => void | Promise<void>;
    onboardingStep: number;
    setOnboardingStep: (n: number | ((p: number) => number)) => void;
  };
  aiBatchProgress: { done: number; total: number };
  aiImages: { url: string }[] | null;
  onPickAiImage: (img: { url: string }) => void;
};

/** Under-editor: save/historikk + demo + AI-rader — presentasjon; callbacks fra skallet. */
export function ContentWorkspaceAuxiliaryShell({
  lowerControls,
  demo,
  aiInputs,
  aiBuildResult,
  onApplyAiBuild,
  selectedBlockTools,
  aiBatchProgress,
  aiImages,
  onPickAiImage,
}: ContentWorkspaceAuxiliaryShellProps) {
  return (
    <>
      <ContentWorkspaceEditorLowerControls {...lowerControls} />

      {demo ? (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <div className="font-medium">Demo-modus – ingen endringer lagres</div>
          <div className="mt-0.5 text-xs">Prøv: Klikk en blokk → Forbedre tekst</div>
          {demo.isWow ? (
            <div className="mt-1 text-xs font-medium text-amber-950">Se hvordan siden forbedres automatisk ✨</div>
          ) : null}
          <button
            type="button"
            onClick={demo.onRestart}
            className="mt-2 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 transition-all duration-150 ease-out hover:bg-amber-100"
          >
            Start på nytt
          </button>
          {demo.isWow ? (
            <button
              type="button"
              onClick={demo.onToggleBeforeAfter}
              className="mt-2 ml-2 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 transition-all duration-150 ease-out hover:bg-amber-100"
            >
              Før / Etter
            </button>
          ) : null}
        </div>
      ) : null}

      {aiInputs.isPitch ? null : (
        <div className="mt-2">
          <div className="grid gap-2">
            <input
              value={aiInputs.aiProduct}
              onChange={(e) => aiInputs.setAiProduct(e.target.value)}
              placeholder="Produkt"
              className="h-10 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 text-sm text-[rgb(var(--lp-text))]"
            />
            <input
              value={aiInputs.aiAudience}
              onChange={(e) => aiInputs.setAiAudience(e.target.value)}
              placeholder="Målgruppe"
              className="h-10 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 text-sm text-[rgb(var(--lp-text))]"
            />
            <input
              value={aiInputs.aiIntent}
              onChange={(e) => aiInputs.setAiIntent(e.target.value)}
              placeholder="Mål (f.eks salg / SEO)"
              className="h-10 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 text-sm text-[rgb(var(--lp-text))]"
            />
          </div>
          <button
            type="button"
            onClick={() => void aiInputs.runAiBuild()}
            disabled={aiInputs.aiBuildLoading}
            className="mt-2 min-h-[44px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-medium text-[rgb(var(--lp-text))] transition-all duration-150 ease-out hover:bg-[rgb(var(--lp-card))]/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {aiInputs.aiBuildLoading ? "Jobber..." : "Generer side"}
          </button>
          <button
            type="button"
            onClick={() => {
              void aiInputs.runAiAudit();
              if (aiInputs.onboardingStep === 5) aiInputs.setOnboardingStep(6);
            }}
            disabled={aiInputs.aiAuditLoading}
            className="mt-2 ml-2 min-h-[44px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-medium text-[rgb(var(--lp-text))] transition-all duration-150 ease-out hover:bg-[rgb(var(--lp-card))]/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {aiInputs.aiAuditLoading ? "Analyserer..." : "Analyser side"}
          </button>
          {aiInputs.onboardingStep === 5 ? (
            <div className="animate-fade-in mt-2 rounded-lg border border-black/10 bg-black px-2 py-1 text-xs text-white">
              Analyser siden
            </div>
          ) : null}
        </div>
      )}

      {aiBuildResult ? (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 text-xs font-semibold">AI forslag til side</div>
          {aiBuildResult.map((b, i) => (
            <div key={i} className="mb-1 text-sm">
              {typeof (b as { type?: unknown }).type === "string"
                ? ((b as { type: string }).type || "ukjent")
                : "ukjent"}
            </div>
          ))}
          <button type="button" onClick={onApplyAiBuild} className="mt-2 text-xs font-medium text-green-700">
            Bruk forslag
          </button>
        </div>
      ) : null}

      {selectedBlockTools ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <div className="mb-2 flex w-full flex-wrap gap-2">
            {Object.entries(selectedBlockTools.imagePresetLabels).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => selectedBlockTools.setImagePreset(key)}
                className={`rounded px-2 py-1 text-xs transition-all duration-150 ease-out ${
                  selectedBlockTools.imagePreset === key ? "bg-black text-white" : "bg-gray-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void selectedBlockTools.runAiImage()}
            disabled={
              selectedBlockTools.aiAnyLoading ||
              (selectedBlockTools.block.type !== "hero" && selectedBlockTools.block.type !== "image")
            }
            className="min-h-[44px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-medium text-[rgb(var(--lp-text))] transition-all duration-150 ease-out hover:bg-[rgb(var(--lp-card))]/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {selectedBlockTools.aiImageLoading ? "Genererer..." : "Generer bilde"}
          </button>
          <button
            type="button"
            onClick={() => void selectedBlockTools.runAiImageBatch()}
            disabled={selectedBlockTools.aiAnyLoading}
            className="min-h-[44px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-medium text-[rgb(var(--lp-text))] transition-all duration-150 ease-out hover:bg-[rgb(var(--lp-card))]/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {selectedBlockTools.aiBatchLoading ? "Genererer bilder (hele siden)..." : "Generer bilder (hele siden)"}
          </button>
          <button
            type="button"
            onClick={() => {
              void selectedBlockTools.runAiAction("improve");
              if (selectedBlockTools.onboardingStep === 3) selectedBlockTools.setOnboardingStep(4);
            }}
            disabled={selectedBlockTools.aiAnyLoading}
            className="min-h-[44px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-medium text-[rgb(var(--lp-text))] transition-all duration-150 ease-out hover:bg-[rgb(var(--lp-card))]/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Forbedre tekst
          </button>
          {selectedBlockTools.onboardingStep === 3 ? (
            <div className="animate-fade-in rounded-lg border border-black/10 bg-black px-2 py-1 text-xs text-white">
              Klikk &quot;Forbedre tekst&quot;
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void selectedBlockTools.runAiAction("shorten")}
            disabled={selectedBlockTools.aiAnyLoading}
            className="min-h-[44px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-medium text-[rgb(var(--lp-text))] transition-all duration-150 ease-out hover:bg-[rgb(var(--lp-card))]/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Forkort
          </button>
          <button
            type="button"
            onClick={() => void selectedBlockTools.runAiAction("seo")}
            disabled={selectedBlockTools.aiAnyLoading}
            className="min-h-[44px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-medium text-[rgb(var(--lp-text))] transition-all duration-150 ease-out hover:bg-[rgb(var(--lp-card))]/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            SEO-optimaliser
          </button>
        </div>
      ) : null}

      {aiBatchProgress.total > 0 ? (
        <div className="mt-2">
          <div className="text-xs text-gray-600">
            Genererer bilder: {aiBatchProgress.done} / {aiBatchProgress.total}
            {aiBatchProgress.done === 0 ? " (starter med hero)" : ""}
          </div>
          <div className="mt-1 h-1 rounded bg-gray-200">
            <div
              className="h-1 rounded bg-black transition-all duration-150 ease-out"
              style={{
                width: `${Math.min(
                  100,
                  Math.max(
                    0,
                    aiBatchProgress.total > 0 ? (aiBatchProgress.done / aiBatchProgress.total) * 100 : 0
                  )
                )}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {aiImages && aiImages.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {aiImages.map((img, i) => (
            <img
              key={`${img.url}-${i}`}
              src={img.url}
              alt=""
              className="cursor-pointer rounded transition-all duration-150 ease-out hover:opacity-80"
              onClick={() => onPickAiImage(img)}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
