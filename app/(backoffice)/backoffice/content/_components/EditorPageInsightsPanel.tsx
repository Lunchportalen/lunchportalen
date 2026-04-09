"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import { evaluatePage, type PageScoreInput } from "@/lib/ai/pageScore";
import { generateImprovements, type BlockImprovement } from "@/lib/ai/improvementEngine";
import { applyImprovement } from "@/lib/ai/safeApply";
import { logAiAction, logFeedback } from "@/lib/ai/pageInsightLog";

export type EditorPageInsightsPanelProps = {
  enabled: boolean;
  pageId: string;
  title: string;
  blocks: Block[];
  meta: Record<string, unknown>;
  setBlocks: (next: Block[]) => void;
};

function blocksFingerprint(blocks: Block[], title: string, meta: Record<string, unknown>): string {
  return `${title.length}:${blocks.length}:${JSON.stringify(meta).slice(0, 200)}:${blocks.map((b) => b.id).join(",")}`;
}

export function EditorPageInsightsPanel(props: EditorPageInsightsPanelProps) {
  const { enabled, pageId, title, blocks, meta, setBlocks } = props;

  const [debouncedBlocks, setDebouncedBlocks] = useState(blocks);
  const [debouncedTitle, setDebouncedTitle] = useState(title);
  const [debouncedMeta, setDebouncedMeta] = useState(meta);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedBlocks(blocks);
      setDebouncedTitle(title);
      setDebouncedMeta(meta);
    }, 420);
    return () => window.clearTimeout(t);
  }, [blocks, title, meta]);

  const pageInput: PageScoreInput = useMemo(
    () => ({ title: debouncedTitle, blocks: debouncedBlocks, meta: debouncedMeta }),
    [debouncedTitle, debouncedBlocks, debouncedMeta],
  );

  const pageScore = useMemo(() => evaluatePage(pageInput), [pageInput]);

  const improvements = useMemo(() => generateImprovements(pageInput), [pageInput]);

  const [autoSafe, setAutoSafe] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const lastRevertRef = useRef<(() => void) | null>(null);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const autoAppliedRef = useRef<Set<string>>(new Set());
  const lastAutoAtRef = useRef(0);

  const runApply = useCallback(
    (imp: BlockImprovement, source: "manual_apply" | "auto_safe") => {
      if (!imp.safe || !imp.apply) return;
      const current = blocksRef.current;
      const result = applyImprovement(imp, current, setBlocks);
      if (!result.ok) return;

      lastRevertRef.current = result.revert ?? null;
      setCanUndo(true);
      logAiAction({
        pageId: pageId || "unknown",
        action: imp.description,
        source,
      });
      logFeedback({
        pageId: pageId || "unknown",
        action: imp.description,
        result: "pending",
      });
    },
    [pageId, setBlocks],
  );

  const onUndo = useCallback(() => {
    const fn = lastRevertRef.current;
    if (!fn) return;
    fn();
    lastRevertRef.current = null;
    setCanUndo(false);
    logAiAction({
      pageId: pageId || "unknown",
      action: "Angret siste forbedring",
      source: "undo",
    });
  }, [pageId]);

  const fp = useMemo(() => blocksFingerprint(blocks, title, meta), [blocks, title, meta]);

  useEffect(() => {
    autoAppliedRef.current.clear();
  }, [fp]);

  useEffect(() => {
    if (!enabled || !autoSafe) return;
    const now = Date.now();
    if (now - lastAutoAtRef.current < 2800) return;

    const next = improvements.find((i) => i.safe && i.apply);
    if (!next) return;
    const key = `${next.id}:${fp}`;
    if (autoAppliedRef.current.has(key)) return;

    autoAppliedRef.current.add(key);
    lastAutoAtRef.current = now;
    runApply(next, "auto_safe");
  }, [autoSafe, enabled, improvements, fp, runApply]);

  if (!enabled) return null;

  return (
    <section
      aria-label="Sideinnsikt"
      className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">SEO &amp; CRO</p>
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/50 text-2xl font-bold tabular-nums text-[rgb(var(--lp-text))]"
          title="Lokal sidepoengsum"
        >
          {pageScore.score}
        </div>
      </div>

      <p className="mt-1 text-[11px] leading-snug text-[rgb(var(--lp-muted))]">
        Poeng og forslag er lokale signaler. Ingen auto-publisering. Trygge endringer kan anvendes manuelt eller med valgfri
        auto-modus.
      </p>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-[rgb(var(--lp-text))]">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-[rgb(var(--lp-border))]"
          checked={autoSafe}
          onChange={(e) => setAutoSafe(e.target.checked)}
        />
        <span>Auto-forbedring (kun trygge endringer)</span>
      </label>

      {canUndo ? (
        <button
          type="button"
          onClick={onUndo}
          className="mt-2 min-h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-2.5 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50"
        >
          Angre siste forbedring
        </button>
      ) : null}

      {pageScore.strengths.length > 0 ? (
        <div className="mt-3 rounded-lg border border-emerald-200/60 bg-emerald-50/40 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80">Styrker</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-[rgb(var(--lp-text))]">
            {pageScore.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {pageScore.issues.length > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-200/70 bg-amber-50/50 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/80">Forbedringspunkter</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-[rgb(var(--lp-text))]">
            {pageScore.issues.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {improvements.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Forslag</p>
          {improvements.map((imp) => (
            <div
              key={imp.id}
              className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/30 px-2.5 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase text-[rgb(var(--lp-muted))]">{imp.type}</span>
                {imp.safe ? (
                  <span className="rounded-full border border-emerald-300/80 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-900">
                    Trygg
                  </span>
                ) : (
                  <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                    Manuell
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs font-medium text-[rgb(var(--lp-text))]">{imp.description}</p>
              <p className="mt-1 text-[11px] leading-snug text-[rgb(var(--lp-muted))]">
                <span className="font-medium text-[rgb(var(--lp-text))]">AI foreslår dette fordi:</span> {imp.because}
              </p>
              {imp.safe && imp.apply ? (
                <button
                  type="button"
                  onClick={() => runApply(imp, "manual_apply")}
                  className="mt-2 min-h-[40px] w-full rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 text-xs font-semibold text-[rgb(var(--lp-text))] transition-colors hover:bg-slate-50"
                >
                  Anvend forbedring
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-[rgb(var(--lp-muted))]">Ingen automatiske forslag akkurat nå.</p>
      )}
    </section>
  );
}
