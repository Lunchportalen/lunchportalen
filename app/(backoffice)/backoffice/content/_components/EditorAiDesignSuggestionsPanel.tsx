"use client";

import { useCallback, useMemo, useState } from "react";

const MAX_SELECTED = 3;

export type AiDesignIssueRow = {
  code: string;
  type: string;
  severity: string;
  message: string;
  current?: string;
};

export type AiDesignSuggestionRow = {
  id: string;
  type: string;
  change: string;
  reason: string;
  target?: string;
  patch: Record<string, unknown>;
  signals?: string[];
};

export type EditorAiDesignSuggestionsPanelProps = {
  enabled: boolean;
  pageId: string;
  blocks: Array<{ id: string; type: string }>;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function severityNb(s: string): string {
  if (s === "high") return "Høy";
  if (s === "medium") return "Medium";
  if (s === "low") return "Lav";
  return s;
}

/**
 * AI Design Suggestions: kun globale DesignSettings (ingen blokk-/styling-mutasjon i data).
 * Tørrkjøring viser forhåndsvisning; Apply går via policy (maks 3 nøkler, anti veksling).
 */
export function EditorAiDesignSuggestionsPanel({ enabled, pageId, blocks }: EditorAiDesignSuggestionsPanelProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [issues, setIssues] = useState<AiDesignIssueRow[]>([]);
  const [suggestions, setSuggestions] = useState<AiDesignSuggestionRow[]>([]);
  const [previewDesignSettings, setPreviewDesignSettings] = useState<unknown>(null);
  const [combinedPatch, setCombinedPatch] = useState<Record<string, unknown> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [autoApply, setAutoApply] = useState(false);
  const [lastRevert, setLastRevert] = useState<Record<string, unknown> | null>(null);

  const patchesMap = useMemo(() => {
    const m: Record<string, Record<string, unknown>> = {};
    for (const s of suggestions) {
      m[s.id] = s.patch;
    }
    return m;
  }, [suggestions]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        if (next.size >= MAX_SELECTED) return prev;
        next.add(id);
      }
      return next;
    });
  }, []);

  const onAnalyze = useCallback(async () => {
    if (!enabled) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    setSelectedIds(new Set());
    try {
      const res = await fetch("/api/backoffice/ai/design-optimizer/analyze", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: pageId || undefined,
          blocks,
          locale: "nb",
          autoApply,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: {
          issues?: AiDesignIssueRow[];
          suggestions?: AiDesignSuggestionRow[];
          previewDesignSettings?: unknown;
          combinedPatch?: Record<string, unknown>;
          message?: string;
          autoApplied?: boolean;
          autoApplyError?: string | null;
        };
        message?: string;
      } | null;
      if (!res.ok || json?.ok === false) {
        setError(json?.message ?? `Analyse feilet (HTTP ${res.status}).`);
        setIssues([]);
        setSuggestions([]);
        setPreviewDesignSettings(null);
        setCombinedPatch(null);
        return;
      }
      const d = json?.data && isPlainObject(json.data) ? json.data : null;
      setIssues(Array.isArray(d?.issues) ? d!.issues! : []);
      setSuggestions(Array.isArray(d?.suggestions) ? d!.suggestions! : []);
      setPreviewDesignSettings(d?.previewDesignSettings ?? null);
      setCombinedPatch(isPlainObject(d?.combinedPatch) ? d!.combinedPatch! : null);
      setMessage(typeof d?.message === "string" ? d.message : null);
      if (d?.autoApplied) {
        setMessage(
          (typeof d?.message === "string" ? `${d.message} ` : "") +
            "Lavrisiko-forslag er lagret som utkast (auto).",
        );
      }
      if (d?.autoApplyError) {
        setError(String(d.autoApplyError));
      }
    } catch {
      setError("Nettverksfeil ved analyse.");
      setIssues([]);
      setSuggestions([]);
      setPreviewDesignSettings(null);
      setCombinedPatch(null);
    } finally {
      setBusy(false);
    }
  }, [enabled, pageId, blocks, autoApply]);

  const onIgnore = useCallback(() => {
    setIssues([]);
    setSuggestions([]);
    setPreviewDesignSettings(null);
    setCombinedPatch(null);
    setSelectedIds(new Set());
    setMessage(null);
    setError(null);
  }, []);

  const onApply = useCallback(
    async (publish: boolean) => {
      if (!enabled || selectedIds.size === 0) return;
      setBusy(true);
      setError(null);
      try {
        const ids = [...selectedIds];
        const res = await fetch("/api/backoffice/ai/design-optimizer/apply", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: publish ? "publish" : "save",
            pageId: pageId || undefined,
            suggestionIds: ids,
            patches: patchesMap,
            locale: "nb",
            autoApply: false,
          }),
        });
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          data?: { revertDesignSettings?: Record<string, unknown>; message?: string };
          message?: string;
        } | null;
        if (!res.ok || json?.ok === false) {
          setError(json?.message ?? `Bruk feilet (HTTP ${res.status}).`);
          return;
        }
        const d = json?.data && isPlainObject(json.data) ? json.data : null;
        if (d?.revertDesignSettings && isPlainObject(d.revertDesignSettings)) {
          setLastRevert(d.revertDesignSettings);
        }
        setMessage(publish ? "DesignSettings publisert." : "DesignSettings lagret som utkast.");
        setSelectedIds(new Set());
      } catch {
        setError("Nettverksfeil ved bruk.");
      } finally {
        setBusy(false);
      }
    },
    [enabled, pageId, patchesMap, selectedIds],
  );

  const onRevert = useCallback(
    async (publish: boolean) => {
      if (!lastRevert) {
        setError("Ingen revert-tilstand.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/backoffice/ai/design-optimizer/revert", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: publish ? "publish" : "save",
            revertDesignSettings: lastRevert,
            pageId: pageId || undefined,
            locale: "nb",
          }),
        });
        const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
        if (!res.ok || json?.ok === false) {
          setError(json?.message ?? `Tilbakestilling feilet (HTTP ${res.status}).`);
          return;
        }
        setLastRevert(null);
        setMessage(publish ? "Tilbakestilt og publisert." : "Tilbakestilt i utkast.");
      } catch {
        setError("Nettverksfeil ved tilbakestilling.");
      } finally {
        setBusy(false);
      }
    },
    [lastRevert, pageId],
  );

  if (!enabled) return null;

  return (
    <section
      aria-label="AI design suggestions"
      className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI Design Suggestions</p>
      <p className="mt-2 text-[11px] leading-snug text-[rgb(var(--lp-muted))]">
        Optimaliserer kun globale <code className="text-[10px]">designSettings</code> — ikke blokker. Forslag er deterministiske;
        maks {MAX_SELECTED} endringer per bruk; ingen auto-bruk uten at du velger auto-lavrisiko ved analyse.
      </p>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-[11px] text-[rgb(var(--lp-text))]">
        <input
          type="checkbox"
          checked={autoApply}
          onChange={(e) => setAutoApply(e.target.checked)}
          className="h-4 w-4 rounded border-[rgb(var(--lp-border))]"
        />
        Auto-modus: ved analyse, bruk kun lav risiko (utkast)
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onAnalyze()}
          className="min-h-[40px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? "Kjører…" : "Analyser side"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onIgnore}
          className="min-h-[40px] rounded-lg border border-transparent px-3 text-xs font-medium text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))] disabled:opacity-50"
        >
          Ignorer
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-xs text-red-700" aria-live="polite">
          {error}
        </p>
      ) : null}
      {message ? <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">{message}</p> : null}

      {issues.length > 0 ? (
        <div className="mt-3 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/40 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Funn (UX)</p>
          <ul className="mt-1 space-y-1.5 text-xs text-[rgb(var(--lp-text))]">
            {issues.map((i) => (
              <li key={i.code} className="leading-snug">
                <span className="mr-1 text-[10px] font-medium text-[rgb(var(--lp-muted))]">
                  [{severityNb(i.severity)} · {i.type}]
                </span>
                {i.message}
                {i.current != null ? (
                  <span className="ml-1 text-[10px] text-[rgb(var(--lp-muted))]">(nå: {i.current})</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {suggestions.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Forslag (maks {MAX_SELECTED})</p>
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li
                key={s.id}
                className="rounded-md border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/30 p-2 text-[11px]"
              >
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(s.id)}
                    onChange={() => toggleSelect(s.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-[rgb(var(--lp-border))]"
                  />
                  <span>
                    <span className="font-medium text-[rgb(var(--lp-text))]">
                      [{s.type}] {s.change}
                    </span>
                    <span className="mt-0.5 block text-[rgb(var(--lp-muted))]">{s.reason}</span>
                    {s.target ? (
                      <span className="mt-0.5 block font-mono text-[10px] text-[rgb(var(--lp-muted))]">{s.target}</span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {previewDesignSettings != null ? (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
            Tørrkjøring — forhåndsvisning designSettings
          </p>
          <pre className="mt-1 max-h-40 overflow-auto rounded-md border border-[rgb(var(--lp-border))] bg-slate-50 p-2 text-[10px] leading-snug text-slate-800">
            {JSON.stringify(previewDesignSettings, null, 2)}
          </pre>
          {combinedPatch != null && Object.keys(combinedPatch).length > 0 ? (
            <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">
              Kombinert patch (alle viste forslag):{" "}
              <code className="break-all">{JSON.stringify(combinedPatch)}</code>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || selectedIds.size === 0}
          onClick={() => void onApply(false)}
          className="min-h-[40px] rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Bruk valgte (utkast)
        </button>
        <button
          type="button"
          disabled={busy || selectedIds.size === 0}
          onClick={() => void onApply(true)}
          className="min-h-[40px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 disabled:opacity-50"
        >
          Bruk valgte og publiser
        </button>
      </div>

      {lastRevert ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-[rgb(var(--lp-border))] pt-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onRevert(false)}
            className="min-h-9 rounded-lg border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-900 disabled:opacity-50"
          >
            Tilbakestill siste (utkast)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onRevert(true)}
            className="min-h-9 rounded-lg bg-amber-900 px-2 text-xs font-medium text-white disabled:opacity-50"
          >
            Tilbakestill og publiser
          </button>
        </div>
      ) : null}
    </section>
  );
}
