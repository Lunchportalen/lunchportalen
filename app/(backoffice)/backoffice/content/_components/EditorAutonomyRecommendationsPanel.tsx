"use client";

import { useCallback, useEffect, useState } from "react";
import { DsButton } from "@/components/ui/ds";

type AutonomyActionKind = "seo_fix" | "content_improve" | "experiment" | "publish" | "bug_fix";

type MappedAction = {
  id: string;
  kind: AutonomyActionKind;
  label: string;
  description: string;
  confidence: number;
  agent: string;
};

type ApiOk = { ok: true; rid: string; data: { actions?: MappedAction[] } };
type ApiErr = { ok: false; rid: string; message?: string; error?: string };
type ApiEnvelope = ApiOk | ApiErr;

function isApiErr(x: ApiEnvelope): x is ApiErr {
  return x.ok === false;
}

/**
 * Multi-agent “AI anbefaler” (top 3) — separate from CEO deterministic panel.
 */
export function EditorAutonomyRecommendationsPanel() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<MappedAction[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/autonomy/recommendations", { credentials: "include" });
      const j = (await res.json()) as ApiEnvelope;
      if (isApiErr(j)) {
        setError(j.message ?? j.error ?? "Kunne ikke hente");
        setActions([]);
        return;
      }
      const list = Array.isArray(j.data?.actions) ? j.data!.actions! : [];
      setActions(list.slice(0, 3));
    } catch {
      setError("Nettverksfeil");
      setActions([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendFeedback(a: MappedAction, intent: "execute" | "ignore") {
    setPendingId(a.id);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/autonomy/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ actionId: a.id, kind: a.kind, intent }),
      });
      const j = (await res.json()) as ApiEnvelope;
      if (isApiErr(j)) {
        setError(j.message ?? j.error ?? "Kunne ikke lagre");
        return;
      }
      await load();
    } catch {
      setError("Nettverksfeil");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/90 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">AI anbefaler</h3>
        <button
          type="button"
          className="text-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
          onClick={() => void load()}
          disabled={busy}
        >
          Oppdater
        </button>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">CEO · CMO · CTO · COO — kun veiledning; ingen auto-publisering.</p>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {busy && actions.length === 0 ? <p className="mt-2 text-xs text-slate-500">Laster…</p> : null}
      {!busy && actions.length === 0 && !error ? (
        <p className="mt-2 text-xs text-slate-500">Ingen anbefalinger akkurat nå.</p>
      ) : null}
      <ul className="mt-2 space-y-3">
        {actions.map((a) => (
          <li key={a.id} className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
            <p className="text-sm font-medium text-slate-900">{a.label}</p>
            <p className="mt-1 text-xs text-slate-600">{a.description}</p>
            <p className="mt-1 text-xs text-slate-500">
              {a.agent} · tillit {Math.round(a.confidence * 100)}% · {a.kind}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <DsButton
                type="button"
                variant="secondary"
                className="!min-h-[40px] !px-3 !py-2 !text-xs"
                disabled={pendingId !== null}
                onClick={() => void sendFeedback(a, "execute")}
              >
                {pendingId === a.id ? "…" : "Utfør (manuelt)"}
              </DsButton>
              <DsButton
                type="button"
                variant="ghost"
                className="!min-h-[40px] !px-3 !py-2 !text-xs"
                disabled={pendingId !== null}
                onClick={() => void sendFeedback(a, "ignore")}
              >
                Ignorer
              </DsButton>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
