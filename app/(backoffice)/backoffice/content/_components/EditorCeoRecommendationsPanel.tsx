"use client";

import { useCallback, useEffect, useState } from "react";
import { DsButton } from "@/components/ui/ds";

type CeoDecisionType = "seo_fix" | "content_improve" | "experiment" | "publish";

type GrowthAction = {
  id: string;
  decisionType: CeoDecisionType;
  label: string;
  description: string;
  confidence: number;
};

type ApiOk = { ok: true; rid: string; data: { actions?: GrowthAction[] } };
type ApiErr = { ok: false; rid: string; message?: string; error?: string };
type ApiEnvelope = ApiOk | ApiErr;

function isApiErr(x: ApiEnvelope): x is ApiErr {
  return x.ok === false;
}

export function EditorCeoRecommendationsPanel() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<GrowthAction[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/ceo/recommendations", { credentials: "include" });
      const j = (await res.json()) as ApiEnvelope;
      if (isApiErr(j)) {
        setError(j.message ?? j.error ?? "Kunne ikke hente anbefalinger");
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

  async function sendFeedback(a: GrowthAction, intent: "execute" | "ignore") {
    setPendingId(a.id);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/ceo/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ actionId: a.id, decisionType: a.decisionType, intent }),
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
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
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
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {busy && actions.length === 0 ? <p className="mt-2 text-xs text-slate-500">Laster…</p> : null}
      {!busy && actions.length === 0 && !error ? (
        <p className="mt-2 text-xs text-slate-500">Ingen anbefalinger akkurat nå.</p>
      ) : null}
      <ul className="mt-2 space-y-3">
        {actions.map((a) => (
          <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-2">
            <p className="text-sm font-medium text-slate-900">{a.label}</p>
            <p className="mt-1 text-xs text-slate-600">{a.description}</p>
            <p className="mt-1 text-xs text-slate-500">
              Tillit: {Math.round(a.confidence * 100)}% · {a.decisionType}
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
