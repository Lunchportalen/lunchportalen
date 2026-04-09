"use client";

import { useCallback, useMemo, useState } from "react";

import { generateFollowUpMessage } from "@/lib/sales/followupGenerator";

type PipelineActionRow = {
  id: string;
  leadId: string;
  company: string;
  priority_score: number;
  predicted_probability: number;
  action: { type: string; message: string; priority: number };
  approved: boolean;
  executed: boolean;
};

type PlanData = {
  dryRun: boolean;
  salesLoopMode: string | null;
  prioritized: Array<Record<string, unknown>>;
  actions: PipelineActionRow[];
  readyToCloseCount: number;
  maxActionsPerRun: number;
};

function actionAccent(type: string): string {
  if (type === "follow_up_now") return "border-emerald-300 bg-emerald-50/90";
  if (type === "revive") return "border-amber-300 bg-amber-50/90";
  return "border-neutral-200 bg-white/80";
}

export default function SalesLoopClient() {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [rid, setRid] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [execBusy, setExecBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [execResult, setExecResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    setExecResult(null);
    try {
      const res = await fetch("/api/sales/loop/run", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ mode: "plan" }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        rid?: string;
        data?: PlanData;
        message?: string;
      };
      setRid(typeof j.rid === "string" ? j.rid : null);
      if (!res.ok || j.ok !== true || !j.data) {
        setPlan(null);
        setSelected({});
        setError(typeof j.message === "string" ? j.message : "Kunne ikke kjøre salgsloop.");
        return;
      }
      setPlan(j.data);
      const next: Record<string, boolean> = {};
      for (const a of j.data.actions) {
        next[a.leadId] = false;
      }
      setSelected(next);
    } catch {
      setPlan(null);
      setError("Nettverksfeil ved lasting.");
    } finally {
      setBusy(false);
    }
  }, []);

  const toggle = useCallback((leadId: string) => {
    setSelected((s) => ({ ...s, [leadId]: !s[leadId] }));
  }, []);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected],
  );

  const runDrafts = useCallback(async () => {
    if (selectedIds.length === 0) {
      setError("Velg minst ett lead.");
      return;
    }
    setExecBusy(true);
    setError(null);
    setExecResult(null);
    try {
      const res = await fetch("/api/sales/loop/run", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ mode: "execute", confirm: true, leadIds: selectedIds }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        message?: string;
        data?: { ok?: boolean; results?: Array<{ leadId: string; status: string }> };
      };
      if (!res.ok || j.ok !== true) {
        setError(typeof j.message === "string" ? j.message : "Utførelse feilet.");
        return;
      }
      const ok = j.data?.ok === true;
      const n = j.data?.results?.filter((r) => r.status === "draft_created").length ?? 0;
      setExecResult(ok ? `Utkast lagret for ${n} lead(s). RID: ${rid ?? "—"}` : "Noen rader feilet — se serverlogg.");
      await load();
    } catch {
      setError("Nettverksfeil ved utførelse.");
    } finally {
      setExecBusy(false);
    }
  }, [load, rid, selectedIds]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 shadow-sm hover:bg-neutral-50 disabled:opacity-60"
        >
          {busy ? "Kjører …" : "Oppdater forslag"}
        </button>
        <button
          type="button"
          onClick={() => void runDrafts()}
          disabled={execBusy || selectedIds.length === 0 || plan?.dryRun === true}
          className="rounded-full border border-[rgb(var(--lp-accent))] bg-[rgb(var(--lp-accent))]/10 px-4 py-2 text-sm font-semibold text-[rgb(var(--lp-fg))] shadow-sm hover:bg-[rgb(var(--lp-accent))]/20 disabled:opacity-50"
        >
          {execBusy ? "Lagrer …" : "Lagre utkast (godkjente)"}
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900" role="alert">
          {error}
        </p>
      ) : null}
      {execResult ? <p className="text-sm text-neutral-700">{execResult}</p> : null}

      {plan ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-neutral-200 bg-white/90 p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Prioriterte (topp 20)</h2>
            <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
              Klar til lukking (cron): {plan.readyToCloseCount}. Modus: {plan.salesLoopMode ?? "normal"}
              {plan.dryRun ? " · DRY RUN (ingen skrivinger)" : ""}
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {plan.prioritized.slice(0, 20).map((row, i) => {
                const id = typeof row.id === "string" ? row.id : "";
                const meta = row.meta && typeof row.meta === "object" && !Array.isArray(row.meta) ? row.meta : {};
                const name =
                  typeof (meta as Record<string, unknown>).company_name === "string"
                    ? (meta as Record<string, unknown>).company_name
                    : id || "Uten navn";
                const score = typeof row.priority_score === "number" ? row.priority_score : null;
                return (
                  <li key={id || String(i)} className="flex justify-between gap-2 border-b border-neutral-100 pb-2">
                    <span className="truncate font-medium text-neutral-800">{String(name)}</span>
                    <span className="shrink-0 text-neutral-500">{score != null ? score.toFixed(1) : "—"}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white/90 p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Foreslåtte handlinger (maks {plan.maxActionsPerRun})</h2>
            <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
              24 t cooldown per lead for nye forslag. Velg og lagre utkast — ingen auto-e-post.
            </p>
            <ul className="mt-3 space-y-3">
              {plan.actions.map((a) => (
                <li
                  key={a.id}
                  className={`rounded-lg border px-3 py-2 ${actionAccent(a.action.type)}`}
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-[rgb(var(--lp-accent))]"
                      checked={selected[a.leadId] === true}
                      onChange={() => toggle(a.leadId)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-neutral-900">{a.company}</span>
                      <span className="ml-2 text-xs text-neutral-500">
                        {a.action.type} · p≈{a.predicted_probability.toFixed(0)}%
                      </span>
                      <span className="mt-1 block text-sm text-neutral-700">{a.action.message}</span>
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-neutral-200 bg-white/90 p-2 text-xs text-neutral-800">
                        {generateFollowUpMessage(a)}
                      </pre>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {plan.actions.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-600">Ingen handlinger i denne runden (cooldown eller filtre).</p>
            ) : null}
          </section>
        </div>
      ) : (
        !busy && <p className="text-sm text-neutral-600">Trykk «Oppdater forslag» for å hente data.</p>
      )}

      <section className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/80 p-4 text-sm text-neutral-700">
        <p className="font-medium text-neutral-900">Utkast i databasen</p>
        <p className="mt-1">
          Tekst lagres på lead i <code className="rounded bg-white px-1">meta.sales_loop_draft_message</code> med tidspunkt
          og RID. Repeter samme tekst = idempotent (ingen duplikat-skriving).
        </p>
      </section>
    </div>
  );
}
