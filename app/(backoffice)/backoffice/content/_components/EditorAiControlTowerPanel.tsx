"use client";

import { useCallback, useEffect, useState } from "react";

type CompanyExecutionMode = "manual" | "assisted" | "auto";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

type ScalingAction = {
  id: string;
  type: string;
  target: string;
  value: string;
  confidence: number;
  expectedImpact?: string;
};

type ScalingPattern = {
  type: string;
  value: string;
  confidence: number;
  evidence?: string[];
};

export type EditorAiControlTowerPanelProps = {
  enabled: boolean;
};

/**
 * AI Control Tower — beslutning vs. utførelse: policy, logging, reversibel design-utkast ved auto/assistert godkjenning.
 */
export function EditorAiControlTowerPanel({ enabled }: EditorAiControlTowerPanelProps) {
  const [mode, setMode] = useState<CompanyExecutionMode>("manual");
  const [weakPointsCount, setWeakPointsCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guidance, setGuidance] = useState<string | null>(null);
  const [cycle, setCycle] = useState<Record<string, unknown> | null>(null);
  const [executed, setExecuted] = useState<boolean | null>(null);
  const [executeMessage, setExecuteMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<unknown[]>([]);
  const [scaling, setScaling] = useState<{
    patterns: ScalingPattern[];
    selectedActions: ScalingAction[];
    cooldown: { ok: boolean; reason: string };
    explain: string[];
  } | null>(null);
  const [scalingSelected, setScalingSelected] = useState<Set<string>>(new Set());
  const [scalingMessage, setScalingMessage] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/backoffice/company/control-tower?limit=15&scaling=1", { credentials: "include" });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: { entries?: unknown[]; scaling?: Record<string, unknown> | null };
      } | null;
      if (res.ok && json?.ok && json.data?.entries) setHistory(json.data.entries);
      const sc = json?.ok && json.data?.scaling && isPlainObject(json.data.scaling) ? json.data.scaling : null;
      if (sc) {
        const pd = (sc as { patternDetection?: { patterns?: ScalingPattern[] } }).patternDetection;
        const plist = Array.isArray(pd?.patterns) ? pd!.patterns! : [];
        const sel = Array.isArray((sc as { selectedActions?: ScalingAction[] }).selectedActions)
          ? (sc as { selectedActions: ScalingAction[] }).selectedActions
          : [];
        const cd = (sc as { cooldown?: { ok: boolean; reason: string } }).cooldown ?? { ok: true, reason: "" };
        const ex = Array.isArray((sc as { explain?: string[] }).explain) ? (sc as { explain: string[] }).explain : [];
        setScaling({
          patterns: plist,
          selectedActions: sel,
          cooldown: cd,
          explain: ex,
        });
      } else {
        setScaling(null);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (enabled) void loadHistory();
  }, [enabled, loadHistory]);

  const runCycle = useCallback(
    async (opts: {
      analyzeOnly: boolean;
      executeDecisionIds?: string[];
      rejectDecisionIds?: string[];
      scalingApplyIds?: string[];
      scalingIgnoreIds?: string[];
    }) => {
      if (!enabled) return;
      setBusy(true);
      setError(null);
      setGuidance(null);
      setExecuteMessage(null);
      setScalingMessage(null);
      try {
        const res = await fetch("/api/backoffice/company/control-tower", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            analyzeOnly: opts.analyzeOnly,
            weakPointsCount,
            executeDecisionIds: opts.executeDecisionIds ?? [],
            rejectDecisionIds: opts.rejectDecisionIds ?? [],
            includePatternScale: mode === "auto",
            scalingApplyIds: opts.scalingApplyIds ?? [],
            scalingIgnoreIds: opts.scalingIgnoreIds ?? [],
          }),
        });
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          data?: Record<string, unknown>;
          message?: string;
        } | null;
        if (!res.ok || json?.ok === false) {
          setError(json?.message ?? `Feilet (HTTP ${res.status}).`);
          return;
        }
        const d = json?.data && isPlainObject(json.data) ? json.data : null;
        if (!d) {
          setError("Tom respons.");
          return;
        }
        setCycle(isPlainObject(d.cycle) ? d.cycle : null);
        setGuidance(typeof d.guidance === "string" ? d.guidance : null);
        setExecuted(typeof d.executed === "boolean" ? d.executed : null);
        setExecuteMessage(typeof d.executeMessage === "string" ? d.executeMessage : null);
        const sar = d.scalingApplyResult;
        if (sar && isPlainObject(sar) && sar.ok === true && typeof sar.message === "string") {
          setScalingMessage(sar.message as string);
        } else if (sar && isPlainObject(sar) && sar.ok === false && typeof sar.message === "string") {
          setScalingMessage(`Skalering: ${sar.message as string}`);
        }
        setSelectedIds(new Set());
        setScalingSelected(new Set());
        void loadHistory();
      } catch {
        setError("Nettverksfeil.");
      } finally {
        setBusy(false);
      }
    },
    [enabled, mode, weakPointsCount, loadHistory],
  );

  const toggleId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const toggleScalingId = useCallback((id: string) => {
    setScalingSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  if (!enabled) return null;

  const decisions = cycle && Array.isArray((cycle as { decisions?: unknown }).decisions)
    ? (cycle as { decisions: Array<{ id: string }> }).decisions
    : [];

  return (
    <section aria-label="AI Control Tower" className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI Control Tower</p>
      <p className="mt-2 text-[11px] leading-snug text-[rgb(var(--lp-muted))]">
        Beslutning og utførelse er atskilt. Alt logges til <code className="text-[10px]">ai_activity_log</code>. Auto-modus
        skriver kun trygge globale design-tokens som utkast — aldri direkte CMS-blokk uten redaktør.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {(["manual", "assisted", "auto"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`min-h-11 rounded-lg border px-3 text-xs font-medium ${
              mode === m
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-text))] hover:bg-slate-50"
            }`}
          >
            {m === "manual" ? "Manuell" : m === "assisted" ? "Assistert" : "Auto"}
          </button>
        ))}
      </div>

      <label className="mt-3 grid gap-1 text-[11px] text-[rgb(var(--lp-text))]">
        <span className="text-[rgb(var(--lp-muted))]">Antall kjente design-svakheter (fra Revenue/Design innsikt)</span>
        <input
          type="number"
          min={0}
          value={weakPointsCount}
          onChange={(e) => setWeakPointsCount(Number(e.target.value) || 0)}
          className="h-9 w-32 rounded-md border border-[rgb(var(--lp-border))] px-2 text-sm"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void runCycle({ analyzeOnly: true })}
          className="min-h-11 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 text-xs font-medium disabled:opacity-50"
        >
          {busy ? "Kjører…" : "Kjør analyse"}
        </button>
        {mode === "auto" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void runCycle({ analyzeOnly: false })}
            className="min-h-11 rounded-lg bg-amber-800 px-3 text-xs font-medium text-white disabled:opacity-50"
          >
            Auto: utfør trygge grep
          </button>
        ) : null}
        {mode === "assisted" && selectedIds.size > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void runCycle({ analyzeOnly: true, executeDecisionIds: [...selectedIds] })}
            className="min-h-11 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white disabled:opacity-50"
          >
            Godkjenn valgte
          </button>
        ) : null}
        {selectedIds.size > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void runCycle({ analyzeOnly: true, rejectDecisionIds: [...selectedIds] })}
            className="min-h-11 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-medium text-red-900 disabled:opacity-50"
          >
            Avvis valgte
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void loadHistory()}
          className="min-h-11 rounded-lg border border-transparent px-3 text-xs text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
        >
          Oppdater logg
        </button>
      </div>

      {scaling && (scaling.patterns.length > 0 || scaling.selectedActions.length > 0) ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Skaleringsmuligheter</p>
          <p className="mt-1 text-[11px] text-[rgb(var(--lp-muted))]">
            Basert på én felles intelligensmodell. Tillit & cooldown styrer hva som kan auto-kjøres. GTM/innhold skrives til{" "}
            <code className="text-[10px]">aiScalePreferences</code> i globale innstillinger (utkast).
          </p>
          {!scaling.cooldown.ok ? (
            <p className="mt-2 text-[11px] text-amber-900">Cooldown: {scaling.cooldown.reason}</p>
          ) : null}
          {scaling.patterns.length > 0 ? (
            <ul className="mt-2 space-y-2 text-[11px]">
              {scaling.patterns.map((p, i) => (
                <li key={`${p.type}-${i}`} className="rounded border border-white bg-white p-2 shadow-sm">
                  <span className="font-semibold capitalize">{p.type}</span> · {(p.confidence * 100).toFixed(0)} % tillit
                  <p className="text-[rgb(var(--lp-text))]">{p.value}</p>
                  {p.evidence && p.evidence.length > 0 ? (
                    <ul className="mt-1 list-inside list-disc text-[10px] text-[rgb(var(--lp-muted))]">
                      {p.evidence.slice(0, 4).map((ev, j) => (
                        <li key={j}>{ev}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {scaling.selectedActions.length > 0 ? (
            <div className="mt-3">
              <p className="text-[10px] font-semibold uppercase text-[rgb(var(--lp-muted))]">Foreslåtte skaleringsgrep</p>
              <ul className="mt-1 space-y-2">
                {scaling.selectedActions.map((a) => (
                  <li key={a.id} className="rounded border border-[rgb(var(--lp-border))] bg-white p-2 text-[11px]">
                    <label className="flex cursor-pointer gap-2">
                      <input
                        type="checkbox"
                        checked={scalingSelected.has(a.id)}
                        onChange={() => toggleScalingId(a.id)}
                        className="mt-0.5 h-4 w-4"
                      />
                      <span>
                        <span className="font-semibold">{a.type}</span> · {a.target} = {a.value}
                        <span className="ml-2 text-[rgb(var(--lp-muted))]">({(a.confidence * 100).toFixed(0)} %)</span>
                        {a.expectedImpact ? <p className="text-[rgb(var(--lp-muted))]">{a.expectedImpact}</p> : null}
                        <p className="font-mono text-[10px] text-[rgb(var(--lp-muted))]">{a.id}</p>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || scalingSelected.size === 0}
                  onClick={() =>
                    void runCycle({
                      analyzeOnly: true,
                      scalingApplyIds: [...scalingSelected],
                    })
                  }
                  className="min-h-11 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white disabled:opacity-50"
                >
                  Bruk valgte
                </button>
                <button
                  type="button"
                  disabled={busy || scalingSelected.size === 0}
                  onClick={() =>
                    void runCycle({
                      analyzeOnly: true,
                      scalingIgnoreIds: [...scalingSelected],
                    })
                  }
                  className="min-h-11 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 text-xs font-medium disabled:opacity-50"
                >
                  Ignorer valgte
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
      {guidance ? <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">{guidance}</p> : null}
      {executeMessage ? <p className="mt-2 text-xs text-green-800">{executeMessage}</p> : null}
      {scalingMessage ? <p className="mt-2 text-xs text-slate-800">{scalingMessage}</p> : null}
      {executed === true ? <p className="text-xs text-green-800">Utført (utkast).</p> : null}

      {decisions.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase text-[rgb(var(--lp-muted))]">Beslutninger</p>
          <ul className="space-y-2 text-[11px]">
            {decisions.map((d: { id: string; type?: string; action?: string; confidence?: number; reason?: string; risk?: string }) => (
              <li key={d.id} className="rounded border border-[rgb(var(--lp-border))] p-2">
                {mode === "assisted" ? (
                  <label className="flex cursor-pointer gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(d.id)}
                      onChange={() => toggleId(d.id)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span>
                      <span className="font-semibold">{d.type}</span> · {d.action}
                      <span className="ml-2 text-[rgb(var(--lp-muted))]">({d.risk})</span>
                      <p className="text-[rgb(var(--lp-muted))]">{d.reason}</p>
                      <p className="font-mono text-[10px] text-[rgb(var(--lp-muted))]">{d.id}</p>
                    </span>
                  </label>
                ) : (
                  <div>
                    <span className="font-semibold">{d.type}</span> · {d.action}
                    <span className="ml-2 text-[rgb(var(--lp-muted))]">({d.risk})</span>
                    <p className="text-[rgb(var(--lp-muted))]">{d.reason}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {cycle ? (
        <pre className="mt-3 max-h-40 overflow-auto rounded-md border border-[rgb(var(--lp-border))] bg-slate-50 p-2 text-[10px]">
          {JSON.stringify({ safety: (cycle as { safety?: unknown }).safety, anomalies: (cycle as { anomalies?: unknown }).anomalies }, null, 2)}
        </pre>
      ) : null}

      {history.length > 0 ? (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase text-[rgb(var(--lp-muted))]">Siste hendelser</p>
          <ul className="mt-1 space-y-1 text-[10px] text-[rgb(var(--lp-muted))]">
            {history.slice(0, 8).map((h, i) => (
              <li key={i} className="truncate font-mono">
                {JSON.stringify(h)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
