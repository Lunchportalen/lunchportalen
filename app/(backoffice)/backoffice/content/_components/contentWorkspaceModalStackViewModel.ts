/**
 * Demo / wow / pitch / onboarding overlay-effects for ContentWorkspace.
 * Ren flytting av eksisterende useEffect-blokker — ingen ny forretningslogikk.
 */

"use client";

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { Block } from "./editorBlockTypes";
import type { BodyMode } from "./contentWorkspace.blocks";

export type DemoWowPitchOverlayEffectsArgs = {
  isDemo: boolean;
  isWow: boolean;
  isPitch: boolean;
  pitchStep: number;
  blocks: Block[];
  setBodyMode: (m: BodyMode) => void;
  setBlocks: Dispatch<SetStateAction<Block[]>>;
  setSelectedBlockId: (id: string | null) => void;
  setTitle: (v: string) => void;
  setSlug: (v: string) => void;
  setLastError: (v: string | null) => void;
  setOriginalBlocks: (b: Block[]) => void;
  setShowAfter: (v: boolean | ((p: boolean) => boolean)) => void;
  setPitchStep: (v: number | ((p: number) => number)) => void;
  wowHasRunRef: MutableRefObject<boolean>;
  demoBlocks: Block[];
  runAiAction: (kind: "improve" | "shorten" | "seo") => void | Promise<void>;
  runAiAudit: () => void | Promise<void>;
};

export function useContentWorkspaceDemoWowPitchOverlayEffects(p: DemoWowPitchOverlayEffectsArgs): void {
  useEffect(() => {
    if (!p.isDemo) return;
    p.setBodyMode("blocks");
    p.setBlocks(p.demoBlocks);
    p.setSelectedBlockId(p.demoBlocks[0]?.id ?? null);
    p.setTitle("Demo-side");
    p.setSlug("demo-side");
    p.setLastError(null);
    if (p.isWow && !p.isPitch) {
      p.setOriginalBlocks(JSON.parse(JSON.stringify(p.demoBlocks)) as Block[]);
      p.setShowAfter(false);
      p.wowHasRunRef.current = false;
    }
    if (p.isPitch) {
      p.setOriginalBlocks(JSON.parse(JSON.stringify(p.demoBlocks)) as Block[]);
      p.setShowAfter(false);
      p.setPitchStep(1);
    }
    // Samme kontrakt som tidligere inline-effekt i ContentWorkspace (isDemo / isWow / isPitch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.isDemo, p.isWow, p.isPitch]);

  useEffect(() => {
    if (!p.isWow || p.isPitch) return;
    if (p.wowHasRunRef.current) return;
    if (!p.blocks.length) return;
    p.wowHasRunRef.current = true;

    const run = async () => {
      await new Promise((r) => setTimeout(r, 800));
      const targets = p.blocks.filter((b) => b.type === "richText");
      for (const block of targets) {
        p.setSelectedBlockId(block.id);
        await new Promise((r) => setTimeout(r, 120));
        await p.runAiAction("improve");
      }
      await p.runAiAudit();
      setTimeout(() => p.setShowAfter(true), 2000);
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.isWow, p.isPitch, p.blocks, p.runAiAction, p.runAiAudit]);

  useEffect(() => {
    if (!p.isPitch) return;
    const textBlock = p.blocks.find((b) => b.type === "richText");
    const mediaBlock = p.blocks.find((b) => b.type === "hero" || b.type === "image");
    if ((p.pitchStep === 2 || p.pitchStep === 3 || p.pitchStep === 4) && textBlock) {
      p.setSelectedBlockId(textBlock.id);
    }
    if (p.pitchStep === 6 && mediaBlock) {
      p.setSelectedBlockId(mediaBlock.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.isPitch, p.pitchStep, p.blocks]);
}

export type OnboardingOverlayEffectsArgs = {
  onboardingDoneKey: string;
  onboardingStep: number;
  setOnboardingStep: (n: number | ((p: number) => number)) => void;
  selectedBlockId: string | null;
  blocks: Block[];
  setSelectedBlockId: (id: string | null) => void;
};

export function useContentWorkspaceOnboardingOverlayEffects(p: OnboardingOverlayEffectsArgs): void {
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const hasSeen = window.localStorage.getItem(p.onboardingDoneKey);
      if (!hasSeen) {
        p.setOnboardingStep(1);
      }
    } catch {
      // ignore localStorage read errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (p.onboardingStep !== 2) return;
    if (!p.selectedBlockId && p.blocks.length > 0) {
      p.setSelectedBlockId(p.blocks[0]?.id ?? null);
      return;
    }
    if (p.selectedBlockId) {
      p.setOnboardingStep(3);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.onboardingStep, p.selectedBlockId, p.blocks]);

  useEffect(() => {
    if (p.onboardingStep !== 4) return;
    const t = setTimeout(() => {
      p.setOnboardingStep(5);
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.onboardingStep]);
}
