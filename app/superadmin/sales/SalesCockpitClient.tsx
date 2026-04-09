"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const AUTONOMY_LS_KEY = "lp_sales_autonomy_prefs_v1";

type AutonomyRunResponse = {
  simulated: boolean;
  envUnlocked: boolean;
  config: {
    enabled: boolean;
    mode: string;
    maxEmailsPerDay: number;
    maxActionsPerRun: number;
    requireApproval: boolean;
  };
  prepared: Array<{
    id: string;
    type: string;
    approved: boolean;
    risk: string;
    deals: unknown[];
  }>;
  results: Array<{ id: string; type: string; status: string; reason?: string; simulated?: boolean; result?: string }>;
};

import type { CeoSnapshotPayload } from "@/lib/ceo/buildSnapshot";
import type { CeoAction } from "@/lib/ceo/actions";
import type { CeoEngineRunResult } from "@/lib/ceo/run";
import type { EnrichedPipelineDeal } from "@/lib/pipeline/enrichDeal";
import { PIPELINE_STAGES, type PipelineStageId } from "@/lib/pipeline/stages";
import { CHANNELS } from "@/lib/growth/channels";
import type { GrowthOptimizationUiPayload } from "@/lib/growth/loadGrowthOptimization";
import type { ProfitOptimizationResult } from "@/lib/growth/profitOptimizationPipeline";
import type { SalesCockpitServerPayload } from "@/lib/sales/cockpitServerData";
import { createInitialAgentQueue } from "@/lib/sales/cockpitState";
import type { SalesOutreachQueueItem } from "@/lib/sales/outreachQueueTypes";

import PipelineKanbanClient from "../pipeline/PipelineKanbanClient";

async function logCockpit(action: string, metadata?: Record<string, unknown>): Promise<void> {
  try {
    await fetch("/api/sales/cockpit/log", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ action, metadata }),
    });
  } catch {
    /* best-effort */
  }
}

function formatKr(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(n);
}

type PipelineActionApiItem = {
  id: string;
  leadId: string;
  company: string;
  priority_score: number;
  predicted_probability: number;
  action: { type: string; message: string; priority: number };
};

function actionAccent(type: string): string {
  if (type === "follow_up_now") return "border-emerald-300 bg-emerald-50/90";
  if (type === "revive") return "border-amber-300 bg-amber-50/90";
  if (type === "book_meeting") return "border-violet-300 bg-violet-50/90";
  if (type === "deprioritize") return "border-rose-300 bg-rose-50/90";
  return "border-neutral-200 bg-white/80";
}

type ClosingOpportunityRow = {
  leadId: string;
  company: string;
  priority_score: number;
  predicted_probability: number;
  preview: string;
  bookingUrl: string;
  callSuggestion: { type: string; message: string } | null;
};

function ClosingOpportunitiesSection({ refreshKey, onRefreshAll }: { refreshKey: number; onRefreshAll: () => void }) {
  const [rows, setRows] = useState<ClosingOpportunityRow[]>([]);
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [execBusy, setExecBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sales/closing/ready", { credentials: "same-origin", cache: "no-store" });
      const j = (await res.json()) as {
        ok?: boolean;
        data?: { opportunities?: ClosingOpportunityRow[] };
        message?: string;
      };
      if (!res.ok || j.ok !== true) {
        setRows([]);
        setApproved({});
        setError(typeof j.message === "string" ? j.message : "Kunne ikke laste closing-data.");
        return;
      }
      const op = Array.isArray(j.data?.opportunities) ? j.data!.opportunities! : [];
      setRows(op);
      const next: Record<string, boolean> = {};
      for (const o of op) {
        next[o.leadId] = false;
      }
      setApproved(next);
    } catch {
      setRows([]);
      setError("Kunne ikke laste closing-data.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const runApproved = useCallback(async () => {
    const leadIds = rows.filter((x) => approved[x.leadId]).map((x) => x.leadId);
    if (leadIds.length === 0) return;
    setExecBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sales/closing/execute", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ confirm: true, leadIds }),
        cache: "no-store",
      });
      const j = (await res.json()) as { ok?: boolean; data?: { ok?: boolean }; message?: string };
      if (!res.ok || j.ok !== true || j.data?.ok === false) {
        setError(typeof j.message === "string" ? j.message : "Kunne ikke lagre møteutkast.");
        return;
      }
      await logCockpit("closing_executed", { count: leadIds.length });
      setApproved({});
      onRefreshAll();
      await load();
    } catch {
      setError("Kunne ikke lagre møteutkast.");
    } finally {
      setExecBusy(false);
    }
  }, [approved, load, onRefreshAll, rows]);

  return (
    <section className="rounded-lg border border-black/10 bg-white/70 p-4" aria-label="Closing opportunities">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">Closing opportunities</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="rounded-full border border-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-900 hover:text-white disabled:opacity-50"
          >
            {busy ? "Laster…" : "Oppdater"}
          </button>
          <button
            type="button"
            disabled={execBusy || rows.filter((x) => approved[x.leadId]).length === 0}
            onClick={() => void runApproved()}
            className="rounded-full border border-[#ff007f] bg-[#ff007f]/10 px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-[#ff007f]/20 disabled:opacity-50"
          >
            {execBusy ? "Lagrer…" : "Godkjenn og lagre utkast"}
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
        Høy sannsynlighet + nylig aktivitet (prediksjon fra pipeline). Maks 5 utkast per kjøring, 48 t cooldown per
        lead. Ingen auto-oppringning eller auto-booking.
      </p>
      {error ? (
        <p className="mt-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
      {busy && rows.length === 0 ? (
        <p className="mt-3 text-sm text-[rgb(var(--lp-muted))]">Laster …</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-[rgb(var(--lp-muted))]">Ingen closing opportunities akkurat nå.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li
              key={row.leadId}
              className="rounded-md border border-violet-200 bg-violet-50/90 px-3 py-2 text-sm"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-neutral-900">{row.company}</p>
                  <p className="text-xs text-neutral-700">
                    Score <span className="font-mono tabular-nums">{row.priority_score.toFixed(1)}</span> · prognose{" "}
                    <span className="font-mono tabular-nums">{Math.round(row.predicted_probability)}</span> %
                  </p>
                  {row.callSuggestion ? (
                    <p className="mt-1 text-xs font-medium text-neutral-800">{row.callSuggestion.message}</p>
                  ) : null}
                  <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">
                    Booking: <span className="break-all font-mono">{row.bookingUrl}</span>
                  </p>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-neutral-200 bg-white/90 p-2 text-xs text-neutral-800">
                    {row.preview}
                  </pre>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(approved[row.leadId])}
                    onChange={(e) =>
                      setApproved((prev) => ({
                        ...prev,
                        [row.leadId]: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-neutral-300"
                  />
                  Godkjenn
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ObjectionSection({ selectedDeal }: { selectedDeal: EnrichedPipelineDeal | null }) {
  const [incoming, setIncoming] = useState("");
  const [suggested, setSuggested] = useState("");
  const [meta, setMeta] = useState<{ type?: string; strategy?: string; fallback?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  useEffect(() => {
    setIncoming("");
    setSuggested("");
    setMeta(null);
    setError(null);
  }, [selectedDeal?.id]);

  const generate = useCallback(async () => {
    if (!selectedDeal) return;
    if (!incoming.trim()) {
      setError("Lim inn eller skriv inn kundens melding.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sales/objection/reply", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ leadId: selectedDeal.id, incomingMessage: incoming }),
        cache: "no-store",
      });
      const j = (await res.json()) as {
        ok?: boolean;
        data?: { type?: string; strategy?: string; reply?: string; fallbackUsed?: boolean };
        message?: string;
      };
      if (!res.ok || j.ok !== true || !j.data) {
        setError(typeof j.message === "string" ? j.message : "Kunne ikke generere svar.");
        return;
      }
      setSuggested(j.data.reply ?? "");
      setMeta({
        type: j.data.type,
        strategy: j.data.strategy,
        fallback: j.data.fallbackUsed === true,
      });
    } catch {
      setError("Nettverksfeil.");
    } finally {
      setBusy(false);
    }
  }, [incoming, selectedDeal]);

  const sendLogged = useCallback(async () => {
    if (!selectedDeal || !suggested.trim()) return;
    setSendBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sales/objection/send", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ leadId: selectedDeal.id, replyText: suggested }),
        cache: "no-store",
      });
      const j = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || j.ok !== true) {
        setError(typeof j.message === "string" ? j.message : "Kunne ikke logge.");
        return;
      }
      await logCockpit("objection_reply_confirm", { leadId: selectedDeal.id });
    } catch {
      setError("Nettverksfeil ved logging.");
    } finally {
      setSendBusy(false);
    }
  }, [selectedDeal, suggested]);

  const copy = useCallback(async () => {
    if (!suggested.trim()) return;
    try {
      await navigator.clipboard.writeText(suggested);
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 2000);
    } catch {
      /* ignore */
    }
  }, [suggested]);

  return (
    <section className="rounded-lg border border-black/10 bg-white/70 p-4" aria-label="Innvending og AI-forslag">
      <h2 className="text-sm font-semibold text-neutral-900">Innvending → svar</h2>
      <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
        Klassifisering og strategi er deterministisk; AI brukes kun til tekst. Velg en deal i pipeline, lim inn
        kundens melding, rediger forslaget før du bruker det. «Logg bekreftet» registrerer manuell bruk (ingen
        auto-send).
      </p>
      {!selectedDeal ? (
        <p className="mt-3 text-sm text-[rgb(var(--lp-muted))]">Velg en deal i pipeline til venstre.</p>
      ) : (
        <p className="mt-2 text-xs text-neutral-700">
          Valgt: <span className="font-medium">{selectedDeal.company_name}</span> · {selectedDeal.stage}
        </p>
      )}
      <div className="mt-3 space-y-2">
        <label className="block text-xs font-medium text-neutral-800" htmlFor="lp-incoming-msg">
          Innkommende melding
        </label>
        <textarea
          id="lp-incoming-msg"
          value={incoming}
          onChange={(e) => setIncoming(e.target.value)}
          rows={3}
          disabled={!selectedDeal}
          className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 disabled:opacity-50"
          placeholder="Lim inn kundens e-post eller melding …"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !selectedDeal}
          onClick={() => void generate()}
          className="rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {busy ? "Genererer…" : "Generer AI-forslag"}
        </button>
        <button
          type="button"
          disabled={!suggested.trim()}
          onClick={() => void copy()}
          className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 disabled:opacity-50"
        >
          {copyOk ? "Kopiert" : "Kopier forslag"}
        </button>
        <button
          type="button"
          disabled={sendBusy || !selectedDeal || !suggested.trim()}
          onClick={() => void sendLogged()}
          className="rounded-full border border-[#ff007f] bg-[#ff007f]/10 px-3 py-1.5 text-xs font-medium text-neutral-900 disabled:opacity-50"
        >
          {sendBusy ? "Logger…" : "Logg bekreftet svar"}
        </button>
      </div>
      {meta ? (
        <p className="mt-2 text-[10px] text-[rgb(var(--lp-muted))]">
          Klasse: {meta.type ?? "—"} · strategi: {meta.strategy ?? "—"}
          {meta.fallback ? " · fallback brukt" : ""}
        </p>
      ) : null}
      <div className="mt-3 space-y-2">
        <label className="block text-xs font-medium text-neutral-800" htmlFor="lp-suggested-reply">
          AI-forslag (rediger fritt)
        </label>
        <textarea
          id="lp-suggested-reply"
          value={suggested}
          onChange={(e) => setSuggested(e.target.value)}
          rows={5}
          className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900"
          placeholder="Forslag vises her — rediger før du sender manuelt i e-post/CRM."
        />
      </div>
      {error ? (
        <p className="mt-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function SequenceTimelineSection({
  selectedDeal,
  refreshKey,
}: {
  selectedDeal: EnrichedPipelineDeal | null;
  refreshKey: number;
}) {
  const [timeline, setTimeline] = useState<Array<Record<string, unknown>>>([]);
  const [nextStep, setNextStep] = useState<{ step?: number; type?: string; description?: string } | null>(null);
  const [suggested, setSuggested] = useState("");
  const [paused, setPaused] = useState(false);
  const [lastInbound, setLastInbound] = useState<string | null>(null);
  const [simIncoming, setSimIncoming] = useState("");
  const [simReply, setSimReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadBusy, setLoadBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedDeal) {
      setTimeline([]);
      setNextStep(null);
      setSuggested("");
      setPaused(false);
      setLastInbound(null);
      return;
    }
    setLoadBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/sales/sequence/timeline?leadId=${encodeURIComponent(selectedDeal.id)}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      const j = (await res.json()) as {
        ok?: boolean;
        data?: {
          timeline?: Array<Record<string, unknown>>;
          nextStep?: { step?: number; type?: string; description?: string } | null;
          suggestedReply?: string | null;
          sequencePaused?: boolean;
          lastInbound?: string | null;
        };
        message?: string;
      };
      if (!res.ok || j.ok !== true || !j.data) {
        setTimeline([]);
        setError(typeof j.message === "string" ? j.message : "Kunne ikke laste tidslinje.");
        return;
      }
      setTimeline(Array.isArray(j.data.timeline) ? j.data.timeline : []);
      setNextStep(j.data.nextStep ?? null);
      setSuggested(typeof j.data.suggestedReply === "string" ? j.data.suggestedReply : "");
      setPaused(j.data.sequencePaused === true);
      setLastInbound(typeof j.data.lastInbound === "string" ? j.data.lastInbound : null);
    } catch {
      setError("Nettverksfeil ved lasting av tidslinje.");
    } finally {
      setLoadBusy(false);
    }
  }, [selectedDeal]);

  useEffect(() => {
    void load();
  }, [load, refreshKey, selectedDeal?.id]);

  const runInbound = useCallback(async () => {
    if (!selectedDeal || !simIncoming.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sales/sequence/inbound", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ leadId: selectedDeal.id, message: simIncoming }),
        cache: "no-store",
      });
      const j = (await res.json()) as {
        ok?: boolean;
        data?: { objection?: { reply?: string } };
        message?: string;
      };
      if (!res.ok || j.ok !== true) {
        setError(typeof j.message === "string" ? j.message : "Kunne ikke behandle melding.");
        return;
      }
      setSimReply(j.data?.objection?.reply ?? "");
      setSimIncoming("");
      await load();
      await logCockpit("sequence_inbound_simulated", { leadId: selectedDeal.id });
    } catch {
      setError("Nettverksfeil.");
    } finally {
      setBusy(false);
    }
  }, [load, selectedDeal, simIncoming]);

  return (
    <section className="rounded-lg border border-black/10 bg-white/70 p-4" aria-label="Sekvens og samtale">
      <h2 className="text-sm font-semibold text-neutral-900">Conversation timeline</h2>
      <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
        Multi-touch-sekvens (3–4 steg) med utkast i meta. Maks 10 sekvensutkast per UTC-døgn globalt, minst 48 t
        mellom steg per lead. Stopp ved negativ respons.
      </p>
      {!selectedDeal ? (
        <p className="mt-3 text-sm text-[rgb(var(--lp-muted))]">Velg en deal for å se tidslinje og neste steg.</p>
      ) : (
        <p className="mt-2 text-xs text-neutral-700">
          <span className="font-medium">{selectedDeal.company_name}</span> · {selectedDeal.stage}
          {paused ? (
            <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-amber-900">Sekvens pauset</span>
          ) : null}
        </p>
      )}
      {loadBusy ? <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">Laster tidslinje…</p> : null}
      {nextStep ? (
        <p className="mt-2 text-xs text-neutral-800">
          Neste steg: <span className="font-mono">{nextStep.step}</span> ({nextStep.type}) — {nextStep.description}
        </p>
      ) : selectedDeal ? (
        <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">Ingen flere sekvenssteg (eller ikke startet).</p>
      ) : null}
      {lastInbound ? (
        <p className="mt-2 rounded border border-neutral-200 bg-white/80 px-2 py-1 text-xs text-neutral-700">
          Siste innkommende (lagret): {lastInbound.slice(0, 280)}
          {lastInbound.length > 280 ? "…" : ""}
        </p>
      ) : null}
      <div className="mt-3 space-y-2">
        <label className="block text-xs font-medium text-neutral-800" htmlFor="lp-seq-suggested">
          Foreslått svar / siste utkast (redigerbart)
        </label>
        <textarea
          id="lp-seq-suggested"
          value={suggested}
          onChange={(e) => setSuggested(e.target.value)}
          rows={4}
          disabled={!selectedDeal}
          className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 disabled:opacity-50"
          placeholder="Sekvens- eller innvendingsforslag fra server …"
        />
      </div>
      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Tidslinje</h3>
        {timeline.length === 0 ? (
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Ingen hendelser ennå.</p>
        ) : (
          <ul className="mt-2 max-h-48 space-y-2 overflow-auto text-xs">
            {timeline.map((e, i) => {
              const at = typeof e.at === "string" ? e.at : "";
              const kind = typeof e.kind === "string" ? e.kind : "";
              const prev = typeof e.preview === "string" ? e.preview : "";
              return (
                <li key={`${at}-${i}`} className="rounded border border-neutral-200 bg-white/90 px-2 py-1">
                  <span className="font-mono text-[10px] text-neutral-500">{at}</span> · {kind}
                  {typeof e.step === "number" ? ` · steg ${e.step}` : ""}
                  <pre className="mt-1 whitespace-pre-wrap text-neutral-800">{prev}</pre>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="mt-4 border-t border-black/10 pt-3">
        <h3 className="text-xs font-semibold text-neutral-900">Simuler innkommende svar</h3>
        <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">
          Kjører innvendingsmotor + oppdaterer meta (siste svar, ev. pause). Ingen auto-send.
        </p>
        <textarea
          value={simIncoming}
          onChange={(e) => setSimIncoming(e.target.value)}
          rows={3}
          disabled={!selectedDeal || busy}
          className="mt-2 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 disabled:opacity-50"
          placeholder="Kundens melding …"
        />
        <button
          type="button"
          disabled={busy || !selectedDeal || !simIncoming.trim()}
          onClick={() => void runInbound()}
          className="mt-2 rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {busy ? "Behandler…" : "Kjør svar + oppdater"}
        </button>
        {simReply ? (
          <div className="mt-2 rounded border border-emerald-200 bg-emerald-50/80 px-2 py-2 text-xs text-neutral-900">
            <span className="font-medium">Forslag (innvending):</span>
            <pre className="mt-1 whitespace-pre-wrap">{simReply}</pre>
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function PrioritizedDealsSection({
  refreshKey,
  onRefreshAll,
}: {
  refreshKey: number;
  onRefreshAll: () => void;
}) {
  const [items, setItems] = useState<PipelineActionApiItem[]>([]);
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [execBusy, setExecBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pipeline/actions", { credentials: "same-origin", cache: "no-store" });
      const j = (await res.json()) as {
        ok?: boolean;
        data?: { items?: PipelineActionApiItem[] };
        message?: string;
      };
      if (!res.ok || j.ok !== true) {
        setItems([]);
        setError(typeof j.message === "string" ? j.message : "Kunne ikke laste prioriterte deals.");
        return;
      }
      setItems(Array.isArray(j.data?.items) ? j.data.items : []);
      setApproved({});
    } catch {
      setItems([]);
      setError("Kunne ikke laste prioriterte deals.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const runApproved = useCallback(async () => {
    const leadIds = items.filter((x) => approved[x.leadId]).map((x) => x.leadId);
    if (leadIds.length === 0) return;
    setExecBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pipeline/actions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ confirm: true, leadIds }),
        cache: "no-store",
      });
      const j = (await res.json()) as {
        ok?: boolean;
        data?: { ok?: boolean };
        message?: string;
      };
      if (!res.ok || j.ok !== true || j.data?.ok === false) {
        setError(typeof j.message === "string" ? j.message : "Kunne ikke kjøre handlinger.");
        return;
      }
      await logCockpit("pipeline_actions_executed", { count: leadIds.length });
      setApproved({});
      onRefreshAll();
      await load();
    } catch {
      setError("Kunne ikke kjøre handlinger.");
    } finally {
      setExecBusy(false);
    }
  }, [approved, items, load, onRefreshAll]);

  return (
    <section className="rounded-lg border border-black/10 bg-white/70 p-4" aria-label="Prioriterte deals">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">Prioriterte deals</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="rounded-full border border-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-900 hover:text-white disabled:opacity-50"
          >
            {busy ? "Laster…" : "Oppdater liste"}
          </button>
          <button
            type="button"
            disabled={execBusy || items.filter((x) => approved[x.leadId]).length === 0}
            onClick={() => void runApproved()}
            className="rounded-full border border-[#ff007f] bg-[#ff007f]/10 px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-[#ff007f]/20 disabled:opacity-50"
          >
            {execBusy ? "Kjører…" : "Kjør godkjente (sales agent)"}
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
        Topp 10 etter prioritetsscore. Godkjenn før kjøring — ingen auto-send uten bekreftelse.
      </p>
      {error ? (
        <p className="mt-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
      {busy && items.length === 0 ? (
        <p className="mt-3 text-sm text-[rgb(var(--lp-muted))]">Laster …</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-[rgb(var(--lp-muted))]">Ingen deals i pipeline eller tom liste.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((row) => {
            const title = row.action?.message ?? "";
            const reasons = `${row.action?.type ?? ""}: ${title}`;
            return (
              <li
                key={row.id}
                className={`flex flex-col gap-2 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between ${actionAccent(
                  row.action?.type ?? "",
                )}`}
              >
                <div>
                  <p className="font-medium text-neutral-900">{row.company}</p>
                  <p className="text-xs text-neutral-700">
                    Score <span className="font-mono tabular-nums">{row.priority_score.toFixed(1)}</span> · prognose{" "}
                    <span className="font-mono tabular-nums">{Math.round(row.predicted_probability)}</span> %
                  </p>
                  <p className="mt-1 text-xs text-neutral-600" title={reasons}>
                    {reasons}
                  </p>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(approved[row.leadId])}
                    onChange={(e) =>
                      setApproved((prev) => ({
                        ...prev,
                        [row.leadId]: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-neutral-300"
                  />
                  Godkjenn
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type Props = { initial: SalesCockpitServerPayload };

export default function SalesCockpitClient({ initial }: Props) {
  const [snapshot, setSnapshot] = useState<CeoSnapshotPayload | null>(
    initial.ceo.ok === true ? initial.ceo.snapshot : null,
  );
  const [deals, setDeals] = useState<EnrichedPipelineDeal[]>(initial.deals);
  const [pipelineAvailable, setPipelineAvailable] = useState(initial.pipelineAvailable);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentQueue, setAgentQueue] = useState(createInitialAgentQueue());
  const [queueFilterChannel, setQueueFilterChannel] = useState<"all" | "email" | "linkedin">("all");
  const [queueFilterStatus, setQueueFilterStatus] = useState<string>("all");
  const [moveStage, setMoveStage] = useState<PipelineStageId>("lead");
  const [ceoEngine, setCeoEngine] = useState<CeoEngineRunResult | null>(null);
  const [ceoBusy, setCeoBusy] = useState(false);

  const [autonomyEnabled, setAutonomyEnabled] = useState(false);
  const [autonomyMode, setAutonomyMode] = useState<"dry-run" | "semi" | "full">("dry-run");
  const [autonomyMaxEmails, setAutonomyMaxEmails] = useState(20);
  const [autonomyMaxActions, setAutonomyMaxActions] = useState(10);
  const [autonomyBusy, setAutonomyBusy] = useState(false);
  const [autonomyLast, setAutonomyLast] = useState<AutonomyRunResponse | null>(null);
  const [autonomyApproved, setAutonomyApproved] = useState<Record<string, boolean>>({});
  const [growthOpt, setGrowthOpt] = useState<GrowthOptimizationUiPayload>(initial.growthOptimization);
  const [profitBusy, setProfitBusy] = useState(false);

  const loadCeoRun = useCallback(async () => {
    setCeoBusy(true);
    try {
      const res = await fetch("/api/ceo/run", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      const j = (await res.json()) as { ok?: boolean; data?: CeoEngineRunResult };
      if (res.ok && j.ok === true && j.data && typeof j.data === "object") {
        setCeoEngine(j.data);
      }
    } finally {
      setCeoBusy(false);
    }
  }, []);

  const selectedDeal = useMemo(
    () => (selectedDealId ? deals.find((d) => d.id === selectedDealId) ?? null : null),
    [deals, selectedDealId],
  );

  useEffect(() => {
    if (selectedDeal) setMoveStage(selectedDeal.stage);
  }, [selectedDeal]);

  useEffect(() => {
    void loadCeoRun();
  }, [loadCeoRun]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTONOMY_LS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as {
        enabled?: boolean;
        mode?: string;
        maxEmails?: number;
        maxActions?: number;
      };
      if (typeof p.enabled === "boolean") setAutonomyEnabled(p.enabled);
      if (p.mode === "dry-run" || p.mode === "semi" || p.mode === "full") setAutonomyMode(p.mode);
      if (typeof p.maxEmails === "number" && p.maxEmails >= 0 && p.maxEmails <= 20) setAutonomyMaxEmails(p.maxEmails);
      if (typeof p.maxActions === "number" && p.maxActions >= 0 && p.maxActions <= 50) setAutonomyMaxActions(p.maxActions);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        AUTONOMY_LS_KEY,
        JSON.stringify({
          enabled: autonomyEnabled,
          mode: autonomyMode,
          maxEmails: autonomyMaxEmails,
          maxActions: autonomyMaxActions,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [autonomyEnabled, autonomyMode, autonomyMaxEmails, autonomyMaxActions]);

  const runAutonomy = useCallback(
    async (opts: { simulateOnly: boolean }) => {
      setAutonomyBusy(true);
      try {
        const idem = `autonomy-${Date.now().toString(36)}`;
        const approvedActionIds = opts.simulateOnly
          ? []
          : Object.entries(autonomyApproved)
              .filter(([, v]) => v === true)
              .map(([k]) => k);
        const res = await fetch("/api/autonomy/run", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "content-type": "application/json; charset=utf-8",
            "x-idempotency-key": idem,
          },
          body: JSON.stringify({
            idempotencyKey: idem,
            enabled: opts.simulateOnly ? false : autonomyEnabled,
            mode: opts.simulateOnly ? "dry-run" : autonomyMode,
            maxEmailsPerDay: autonomyMaxEmails,
            maxActionsPerRun: autonomyMaxActions,
            requireApproval: true,
            approvedActionIds,
          }),
          cache: "no-store",
        });
        const j = (await res.json()) as { ok?: boolean; data?: AutonomyRunResponse };
        if (res.ok && j.ok === true && j.data) {
          setAutonomyLast(j.data);
          setAutonomyApproved((prev) => {
            const next = { ...prev };
            for (const p of j.data?.prepared ?? []) {
              if (next[p.id] === undefined) next[p.id] = false;
            }
            return next;
          });
        }
        await logCockpit("autonomy_run", {
          ok: res.ok,
          simulateOnly: opts.simulateOnly,
        });
      } finally {
        setAutonomyBusy(false);
      }
    },
    [autonomyApproved, autonomyEnabled, autonomyMaxActions, autonomyMaxEmails, autonomyMode],
  );

  const runProfitOptimize = useCallback(async () => {
    setProfitBusy(true);
    try {
      const res = await fetch("/api/growth/optimize", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ totalBudget: 100_000, log: true }),
        cache: "no-store",
      });
      const j = (await res.json()) as {
        ok?: boolean;
        data?: {
          roi?: ProfitOptimizationResult["roi"];
          allocation?: Record<string, number>;
          issues?: ProfitOptimizationResult["issues"];
          recommendations?: ProfitOptimizationResult["recommendations"];
          explain?: string;
        };
      };
      if (!res.ok || j.ok !== true || !j.data) return;
      const d = j.data;
      const merged: ProfitOptimizationResult = {
        roi: d.roi ?? {},
        allocation: d.allocation ?? {},
        issues: Array.isArray(d.issues) ? d.issues : [],
        recommendations: Array.isArray(d.recommendations) ? d.recommendations : [],
        mode: "recommendation_only",
        explain: typeof d.explain === "string" ? d.explain : "",
      };
      setSnapshot((prev) => (prev ? { ...prev, profitOptimization: merged } : prev));
    } finally {
      setProfitBusy(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    const [snapRes, pipeRes, growthRes] = await Promise.all([
      fetch("/api/ceo/snapshot", { credentials: "same-origin", cache: "no-store" }),
      fetch("/api/pipeline/deals", { credentials: "same-origin", cache: "no-store" }),
      fetch("/api/superadmin/growth-optimization", { credentials: "same-origin", cache: "no-store" }),
    ]);

    if (snapRes.ok) {
      const j = (await snapRes.json()) as { ok?: boolean; data?: CeoSnapshotPayload };
      if (j.ok === true && j.data && typeof j.data === "object") {
        setSnapshot(j.data);
      }
    }
    if (pipeRes.ok) {
      const j = (await pipeRes.json()) as {
        ok?: boolean;
        data?: { pipelineAvailable?: boolean; deals?: EnrichedPipelineDeal[] };
      };
      if (j.ok === true && j.data) {
        setPipelineAvailable(Boolean(j.data.pipelineAvailable));
        setDeals(Array.isArray(j.data.deals) ? j.data.deals : []);
      }
    }
    setRefreshVersion((v) => v + 1);
    await logCockpit("refresh_all", { rid: "client" });
  }, [loadCeoRun]);

  const onPipelineUpdated = useCallback(() => {
    void refreshAll();
  }, [refreshAll]);

  const runAgent = useCallback(async () => {
    setAgentBusy(true);
    try {
      const idem = `cockpit-agent-${Date.now().toString(36)}`;
      const res = await fetch("/api/sales/agent/run", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-idempotency-key": idem,
        },
        body: JSON.stringify({ idempotencyKey: idem }),
        cache: "no-store",
      });
      const j = (await res.json()) as {
        ok?: boolean;
        data?: { queue?: SalesOutreachQueueItem[] };
      };
      if (res.ok && j.ok === true && Array.isArray(j.data?.queue)) {
        setAgentQueue({ items: j.data.queue, lastRunAt: Date.now() });
      }
      await logCockpit("agent_run", { ok: res.ok });
    } finally {
      setAgentBusy(false);
    }
  }, []);

  const patchDealStage = useCallback(
    async (dealId: string, stage: PipelineStageId) => {
      const res = await fetch("/api/pipeline/update-stage", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ dealId, stage }),
      });
      const j = (await res.json()) as { ok?: boolean };
      const ok = res.ok && j.ok === true;
      await logCockpit("patch_stage", { dealId, stage, ok });
      if (ok) void refreshAll();
    },
    [refreshAll],
  );

  const snap = snapshot;
  const totalPipeline = snap?.pipeline.totalValue ?? 0;
  const weighted = snap?.pipeline.weightedValue ?? 0;
  const activeDeals = snap?.pipeline.deals ?? 0;
  const highRisk = snap?.pipelineInsights.riskyDeals ?? 0;
  const conversion = snap?.pipelineInsights.avgWinProbability ?? 0;
  const avgDealSize = activeDeals > 0 ? totalPipeline / activeDeals : 0;

  const profitOpt = snap?.profitOptimization ?? null;

  const filteredQueue = useMemo(() => {
    let q = agentQueue.items;
    if (queueFilterChannel !== "all") {
      q = q.filter((x) => x.channel === queueFilterChannel);
    }
    if (queueFilterStatus !== "all") {
      q = q.filter((x) => x.status === queueFilterStatus);
    }
    return q;
  }, [agentQueue.items, queueFilterChannel, queueFilterStatus]);

  if (!snap && initial.ceo.ok === false) {
    return (
      <p className="text-sm text-[rgb(var(--lp-muted))]">
        Kunne ikke laste forretningsdata. {initial.ceo.error}
      </p>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void refreshAll()}
            className="rounded-full border border-neutral-900 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-900 hover:text-white"
          >
            Oppdater alt
          </button>
          <span className="text-xs text-[rgb(var(--lp-muted))]">Versjon {refreshVersion}</span>
        </div>

        {/* KPI BAR */}
        <section
          className="grid grid-cols-1 gap-3 rounded-lg border border-black/10 bg-white/70 p-4 sm:grid-cols-2 lg:grid-cols-5"
          aria-label="Nøkkeltall"
        >
          <Kpi label="Total pipeline" value={`${formatKr(totalPipeline)} kr`} />
          <Kpi label="Vektet prognose" value={`${formatKr(weighted)} kr`} />
          <Kpi label="Aktive deals" value={String(activeDeals)} />
          <Kpi label="Høy risiko" value={String(highRisk)} />
          <Kpi label="Konvertering (est.)" value={`${conversion} %`} />
        </section>

        <PrioritizedDealsSection
          refreshKey={refreshVersion}
          onRefreshAll={() => void refreshAll()}
        />

        <ClosingOpportunitiesSection
          refreshKey={refreshVersion}
          onRefreshAll={() => void refreshAll()}
        />

        <ObjectionSection selectedDeal={selectedDeal} />

        <SequenceTimelineSection selectedDeal={selectedDeal} refreshKey={refreshVersion} />

        <section className="rounded-lg border border-black/10 bg-white/70 p-4" aria-label="Growth Optimization">
          <h2 className="text-sm font-semibold text-neutral-900">Growth Optimization</h2>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{growthOpt.explain}</p>
          {growthOpt.experimentId ? (
            <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">
              Eksperiment: {growthOpt.experimentName ?? "—"} · <span className="font-mono">{growthOpt.experimentId}</span>
            </p>
          ) : null}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Beste (RPC)</h3>
              <ul className="mt-2 space-y-2 text-xs">
                {growthOpt.best.length === 0 ? (
                  <li className="text-[rgb(var(--lp-muted))]">Ingen variantdata.</li>
                ) : (
                  growthOpt.best.map((b) => (
                    <li key={b.variantId} className="rounded border border-black/10 bg-white/80 p-2 font-mono text-[11px]">
                      {b.label ?? b.variantId} · RPC {b.revenuePerClick.toFixed(4)} · klikk {b.funnel.clicks} · leads{" "}
                      {b.funnel.leads} · ordre {b.funnel.orders} · {formatKr(b.funnel.revenue)} kr
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Svakeste (RPC)</h3>
              <ul className="mt-2 space-y-2 text-xs">
                {growthOpt.worst.length === 0 ? (
                  <li className="text-[rgb(var(--lp-muted))]">Ingen variantdata.</li>
                ) : (
                  growthOpt.worst.map((w) => (
                    <li key={w.variantId} className="rounded border border-black/10 bg-white/80 p-2 font-mono text-[11px]">
                      {w.label ?? w.variantId} · RPC {w.revenuePerClick.toFixed(4)} · klikk {w.funnel.clicks} · leads{" "}
                      {w.funnel.leads} · ordre {w.funnel.orders} · {formatKr(w.funnel.revenue)} kr
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
          <div className="mt-4 rounded border border-dashed border-black/15 bg-white/60 p-3 text-xs">
            <h3 className="text-xs font-semibold text-neutral-900">Anbefalt neste utkast</h3>
            {growthOpt.recommendation ? (
              <p className="mt-2 whitespace-pre-wrap text-neutral-800">
                <span className="font-medium">{growthOpt.recommendation.suggestion}</span>
                <span className="mt-1 block text-[rgb(var(--lp-muted))]">{growthOpt.recommendation.reason}</span>
              </p>
            ) : (
              <p className="mt-2 text-[rgb(var(--lp-muted))]">Ingen anbefaling uten observerte mønstre.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-black/10 bg-white/70 p-4" aria-label="Profit Optimization">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-neutral-900">Profit Optimization</h2>
            <button
              type="button"
              disabled={profitBusy}
              onClick={() => void runProfitOptimize()}
              className="rounded-full border border-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-900 hover:text-white disabled:opacity-50"
            >
              {profitBusy ? "Kjører…" : "Kjør analyse og logg"}
            </button>
          </div>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            {profitOpt?.explain ??
              "Kanal-ROI fra ordre + SoMe-poster. Ingen automatisk annonsekjøp — kun anbefalinger (manuell godkjenning)."}
          </p>
          <p className="mt-2 text-[10px] text-[rgb(var(--lp-muted))]">
            Kanalmodell:{" "}
            {CHANNELS.map((c) => (
              <span key={c.id} className="mr-2 inline-block">
                {c.id} ({c.type})
              </span>
            ))}
          </p>
          {!profitOpt || Object.keys(profitOpt.roi).length === 0 ? (
            <p className="mt-3 text-xs text-[rgb(var(--lp-muted))]">Ingen kanaldata ennå — eller ikke nok ordre knyttet til poster.</p>
          ) : (
            <div className="mt-4 space-y-4 text-xs">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Omsetning og effektivitet</h3>
                <ul className="mt-2 space-y-1 font-mono text-[11px]">
                  {Object.entries(profitOpt.roi).map(([ch, r]) => (
                    <li key={ch}>
                      {ch}: {formatKr(r.revenue)} kr · {r.orders} ordre · {r.posts} poster · eff. {r.efficiency.toFixed(2)} kr/post
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Foreslått fordeling (100k NOK)</h3>
                <ul className="mt-2 space-y-1 font-mono text-[11px]">
                  {Object.entries(profitOpt.allocation).map(([ch, amt]) => (
                    <li key={ch}>
                      {ch}: {formatKr(amt)} kr
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Observasjoner</h3>
                <ul className="mt-2 space-y-2">
                  {profitOpt.issues.length === 0 ? (
                    <li className="text-[rgb(var(--lp-muted))]">Ingen varsler.</li>
                  ) : (
                    profitOpt.issues.map((i, idx) => (
                      <li key={`${i.channel}-${idx}`} className="rounded border border-amber-100 bg-amber-50/80 p-2 text-amber-950">
                        {i.channel}: {i.problem}
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Anbefalinger</h3>
                <ul className="mt-2 space-y-2">
                  {profitOpt.recommendations.map((r, idx) => (
                    <li key={idx} className="rounded border border-black/10 bg-white/80 p-2">
                      {r.kind === "scale" ? (
                        <>
                          <span className="font-medium">{r.channel}</span>: øk tildeling (forslag) ca. {formatKr(r.suggestedBudget)} kr — {r.note}
                        </>
                      ) : (
                        <>
                          <span className="font-medium">{r.channel}</span>: {r.action} — {r.reason}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-black/10 bg-white/70 p-4" aria-label="AI CEO">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-neutral-900">AI CEO</h2>
            <button
              type="button"
              disabled={ceoBusy}
              onClick={() => void loadCeoRun()}
              className="rounded-full border border-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-900 hover:text-white disabled:opacity-50"
            >
              {ceoBusy ? "Oppdaterer…" : "Oppdater CEO-analyse"}
            </button>
          </div>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Innsikt og neste steg er deterministiske. Utførelse skjer kun etter manuell bekreftelse (trygg modus).
          </p>
          {!ceoEngine ? (
            <p className="mt-3 text-xs text-[rgb(var(--lp-muted))]">Ingen CEO-data lastet — trykk «Oppdater CEO-analyse» eller «Oppdater alt».</p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Varsler</h3>
                <ul className="mt-2 space-y-2 text-xs">
                  {ceoEngine.insights.length === 0 ? (
                    <li className="text-[rgb(var(--lp-muted))]">Ingen varsler.</li>
                  ) : (
                    ceoEngine.insights.map((i, idx) => (
                      <li
                        key={`${i.type}-${idx}`}
                        className="rounded border border-black/10 bg-white/80 p-2"
                      >
                        <span
                          className={
                            i.severity === "high"
                              ? "text-rose-800"
                              : i.severity === "medium"
                                ? "text-amber-800"
                                : "text-neutral-700"
                          }
                        >
                          [{i.severity}] {i.message}
                        </span>
                        {i.revenueImpactKr != null && i.revenueImpactKr > 0 ? (
                          <span className="ml-1 tabular-nums text-neutral-600">
                            (~{formatKr(i.revenueImpactKr)} kr eksponering)
                          </span>
                        ) : null}
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                  Muligheter (prioritet)
                </h3>
                <ol className="mt-2 list-decimal space-y-2 pl-4 text-xs">
                  {ceoEngine.opportunities.length === 0 ? (
                    <li className="list-none pl-0 text-[rgb(var(--lp-muted))]">Ingen muligheter registrert.</li>
                  ) : (
                    ceoEngine.opportunities.map((o, idx) => (
                      <li key={`${o.type}-${idx}`} className="rounded border border-black/10 bg-white/80 p-2">
                        {o.message}
                        {o.revenueImpactKr != null && o.revenueImpactKr > 0 ? (
                          <span className="ml-1 tabular-nums text-neutral-600">
                            (~{formatKr(o.revenueImpactKr)} kr)
                          </span>
                        ) : null}
                      </li>
                    ))
                  )}
                </ol>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Handlinger</h3>
                <ul className="mt-2 space-y-2">
                  {ceoEngine.actions.length === 0 ? (
                    <li className="text-xs text-[rgb(var(--lp-muted))]">Ingen anbefalte handlinger.</li>
                  ) : (
                    ceoEngine.actions.map((a) => (
                      <li key={a.id}>
                        <CeoActionButton
                          action={a}
                          onConfirmed={() => {
                            void runAgent();
                            void logCockpit("ceo_action", { action: a.action, id: a.id });
                          }}
                        />
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-black/10 bg-white/70 p-4" aria-label="Autonom modus">
          <h2 className="text-sm font-semibold text-neutral-900">Autonom modus</h2>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Simulering er alltid trygg. Ekte kjøring krever <code className="text-[11px]">AUTONOMY_ENABLED=true</code> på
            server, aktivert bryter, modus semi/full, og eksplisitt kryss for godkjente handlinger. E-post sender ikke
            automatisk herfra — kun utkast via salgsagent. LinkedIn auto-send er avslått i systemet.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={autonomyEnabled}
                onChange={(e) => setAutonomyEnabled(e.target.checked)}
              />
              Aktivert (krever miljø + policy)
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-[rgb(var(--lp-muted))]">Modus</span>
              <select
                className="rounded border border-black/10 bg-white px-2 py-1.5 text-xs"
                value={autonomyMode}
                onChange={(e) => setAutonomyMode(e.target.value as "dry-run" | "semi" | "full")}
              >
                <option value="dry-run">dry-run (kun simulering)</option>
                <option value="semi">semi (agent utkast)</option>
                <option value="full">full (samme som semi inntil egen utsendelsespolicy)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-[rgb(var(--lp-muted))]">Maks e-post/døgn (policy)</span>
              <input
                type="number"
                min={0}
                max={20}
                className="w-20 rounded border border-black/10 px-2 py-1.5 text-xs tabular-nums"
                value={autonomyMaxEmails}
                onChange={(e) => setAutonomyMaxEmails(Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-[rgb(var(--lp-muted))]">Maks handlinger/kjøring</span>
              <input
                type="number"
                min={0}
                max={50}
                className="w-20 rounded border border-black/10 px-2 py-1.5 text-xs tabular-nums"
                value={autonomyMaxActions}
                onChange={(e) => setAutonomyMaxActions(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={autonomyBusy}
              onClick={() => void runAutonomy({ simulateOnly: true })}
              className="min-h-[44px] rounded-full border border-neutral-900 px-4 py-2 text-xs font-medium text-neutral-900 hover:bg-neutral-900 hover:text-white disabled:opacity-50"
            >
              {autonomyBusy ? "Kjører…" : "Simuler (dry-run)"}
            </button>
            <button
              type="button"
              disabled={autonomyBusy || !autonomyEnabled}
              onClick={() => void runAutonomy({ simulateOnly: false })}
              className="min-h-[44px] rounded-full border border-neutral-900 bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-black disabled:opacity-50"
            >
              Utfør godkjente handlinger
            </button>
          </div>
          {autonomyLast ? (
            <div className="mt-4 space-y-3 text-xs">
              <p>
                <span className="font-medium text-neutral-800">Status:</span>{" "}
                {autonomyLast.simulated ? "Simulert" : "Utført"}{" "}
                {autonomyLast.envUnlocked ? "(miljø låst opp)" : "(miljø ikke låst opp — kun simulering mulig)"}
              </p>
              <div>
                <p className="font-medium text-neutral-800">Godkjenn handlinger (neste kjøring)</p>
                <ul className="mt-2 space-y-2">
                  {(autonomyLast.prepared ?? []).map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={autonomyApproved[p.id] ?? false}
                        onChange={(e) =>
                          setAutonomyApproved((prev) => ({ ...prev, [p.id]: e.target.checked }))
                        }
                      />
                      <span className="font-mono text-[11px]">{p.id}</span>
                      <span>
                        {p.type} · risiko {p.risk} · {Array.isArray(p.deals) ? p.deals.length : 0} deals
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium text-neutral-800">Resultat</p>
                <ul className="mt-1 space-y-1">
                  {(autonomyLast.results ?? []).map((r) => (
                    <li key={`${r.id}-${r.status}`} className="font-mono text-[11px] text-neutral-700">
                      {r.id}: {r.status}
                      {r.reason ? ` (${r.reason})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-[rgb(var(--lp-muted))]">Kjør simulering for å se plan og handlings-ID-er.</p>
          )}
        </section>

        {!pipelineAvailable ? (
          <p className="text-sm text-[rgb(var(--lp-muted))]">Ingen pipeline-data</p>
        ) : null}
        {deals.length === 0 && pipelineAvailable ? (
          <p className="text-sm text-[rgb(var(--lp-muted))]">Ingen leads tilgjengelig</p>
        ) : null}

        {/* GRID: Pipeline 70% | Intelligence 30% */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-10 lg:items-start">
          <div className="min-w-0 lg:col-span-7">
            <h2 className="mb-2 text-sm font-semibold text-neutral-900">Pipeline</h2>
            <PipelineKanbanClient
              hideForecastStrip
              onDealSelect={(d) => setSelectedDealId(d.id)}
              selectedDealId={selectedDealId}
              onPipelineUpdated={onPipelineUpdated}
            />
          </div>
          <div className="min-w-0 lg:col-span-3">
            <h2 className="mb-2 text-sm font-semibold text-neutral-900">AI-dealinnsikt</h2>
            <IntelligencePanel deal={selectedDeal} />
            <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
              Handlinger
            </h3>
            <ActionPanel
              deal={selectedDeal}
              moveStage={moveStage}
              setMoveStage={setMoveStage}
              onMove={() => selectedDeal && patchDealStage(selectedDeal.id, moveStage)}
              onMarkContacted={() => selectedDeal && patchDealStage(selectedDeal.id, "qualified")}
              onCloseWon={() => selectedDeal && patchDealStage(selectedDeal.id, "won")}
              onCloseLost={() => selectedDeal && patchDealStage(selectedDeal.id, "lost")}
              onGenerateAgent={() => void runAgent()}
              agentBusy={agentBusy}
            />
          </div>
        </div>

        {/* Outreach + Revenue */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-black/10 bg-white/50 p-4">
            <h2 className="text-sm font-semibold text-neutral-900">Outreach-agent</h2>
            <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
              Topp leads og utkast — samme motor som salgsagent. Ingen automatisk utsendelse herfra.
            </p>
            <button
              type="button"
              disabled={agentBusy}
              onClick={() => void runAgent()}
              className="mt-3 rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {agentBusy ? "Kjører…" : "Generer utkast (topp leads)"}
            </button>
            <p className="mt-2 text-xs">
              <Link href="/superadmin/sales-agent" className="text-neutral-900 underline underline-offset-2">
                Åpne full salgsagent (godkjenning / utsendelse)
              </Link>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <select
                className="rounded border border-black/10 bg-white px-2 py-1 text-xs"
                value={queueFilterChannel}
                onChange={(e) => setQueueFilterChannel(e.target.value as typeof queueFilterChannel)}
              >
                <option value="all">Alle kanaler</option>
                <option value="email">E-post</option>
                <option value="linkedin">LinkedIn</option>
              </select>
              <select
                className="rounded border border-black/10 bg-white px-2 py-1 text-xs"
                value={queueFilterStatus}
                onChange={(e) => setQueueFilterStatus(e.target.value)}
              >
                <option value="all">Alle status</option>
                <option value="draft">draft</option>
                <option value="approved">approved</option>
                <option value="sent">sent</option>
                <option value="failed">failed</option>
                <option value="ready_manual">ready_manual</option>
              </select>
            </div>
            <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto text-xs">
              {filteredQueue.length === 0 ? (
                <li className="text-[rgb(var(--lp-muted))]">Ingen rader i kø (kjør agent).</li>
              ) : (
                filteredQueue.map((q) => (
                  <li key={q.id} className="rounded border border-black/10 bg-white/80 p-2">
                    <span className="font-medium">{q.company}</span> · {q.channel} ·{" "}
                    <span className="text-neutral-600">{q.status}</span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-lg border border-black/10 bg-white/50 p-4">
            <h2 className="text-sm font-semibold text-neutral-900">Omsetning / pipeline</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-[rgb(var(--lp-muted))]">Total pipeline</dt>
                <dd className="tabular-nums">{formatKr(totalPipeline)} kr</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[rgb(var(--lp-muted))]">Vektet prognose</dt>
                <dd className="tabular-nums">{formatKr(weighted)} kr</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[rgb(var(--lp-muted))]">Snitt deal</dt>
                <dd className="tabular-nums">{formatKr(avgDealSize)} kr</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[rgb(var(--lp-muted))]">Trend</dt>
                <dd className="text-neutral-500">— (kommer)</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
  );
}

function CeoActionButton({
  action,
  onConfirmed,
}: {
  action: CeoAction;
  onConfirmed: () => void;
}) {
  if (action.action === "observe") {
    return <p className="text-xs text-[rgb(var(--lp-muted))]">{action.message}</p>;
  }
  return (
    <button
      type="button"
      onClick={() => {
        if (
          !window.confirm(
            `${action.message}: kjør salgsagent og generere utkast? Ingen automatisk utsendelse.`,
          )
        ) {
          return;
        }
        onConfirmed();
      }}
      className="w-full min-h-[44px] rounded-md border border-neutral-900 bg-white px-2 py-2 text-left text-xs font-medium text-neutral-900 hover:bg-neutral-900 hover:text-white"
    >
      {action.action === "trigger_outreach" ? "Bekreft: følg opp varme leads" : "Bekreft: oppfølging (utkast)"}
    </button>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}

function IntelligencePanel({ deal }: { deal: EnrichedPipelineDeal | null }) {
  if (!deal) {
    return (
      <div className="rounded-lg border border-dashed border-black/15 bg-white/40 p-4 text-sm text-[rgb(var(--lp-muted))]">
        Velg en deal i pipeline.
      </div>
    );
  }
  const p = deal.prediction;
  return (
    <div className="space-y-2 rounded-lg border border-black/10 bg-white/80 p-3 text-sm">
      <p className="font-medium text-neutral-900">{deal.company_name}</p>
      <p>
        <span className="text-[rgb(var(--lp-muted))]">Modell sannsynlighet:</span> {p.winProbability}%
      </p>
      <p>
        <span className="text-[rgb(var(--lp-muted))]">Risiko:</span> {p.risk}
      </p>
      <p className="text-xs text-neutral-700">
        <span className="font-medium">Årsaker:</span> {p.reasons.length ? p.reasons.join(" · ") : "—"}
      </p>
      <p className="text-xs">
        <span className="font-medium">Neste:</span> {deal.nextAction}
      </p>
    </div>
  );
}

function ActionPanel({
  deal,
  moveStage,
  setMoveStage,
  onMove,
  onMarkContacted,
  onCloseWon,
  onCloseLost,
  onGenerateAgent,
  agentBusy,
}: {
  deal: EnrichedPipelineDeal | null;
  moveStage: PipelineStageId;
  setMoveStage: (s: PipelineStageId) => void;
  onMove: () => void;
  onMarkContacted: () => void;
  onCloseWon: () => void;
  onCloseLost: () => void;
  onGenerateAgent: () => void;
  agentBusy: boolean;
}) {
  const disabled = !deal;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded border border-black/10 bg-white px-2 py-1 text-xs"
          value={moveStage}
          disabled={disabled}
          onChange={(e) => setMoveStage(e.target.value as PipelineStageId)}
        >
          {PIPELINE_STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={disabled}
          onClick={onMove}
          className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50"
        >
          Flytt trinn
        </button>
      </div>
      <button
        type="button"
        disabled={disabled || agentBusy}
        onClick={onGenerateAgent}
        className="rounded border border-neutral-300 px-2 py-1 text-left text-xs disabled:opacity-50"
      >
        Generer meldinger (agent)
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onMarkContacted}
        className="rounded border border-neutral-300 px-2 py-1 text-left text-xs disabled:opacity-50"
      >
        Marker kontaktet
      </button>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onCloseWon}
          className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-900 disabled:opacity-50"
        >
          Lukk vunnet
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onCloseLost}
          className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-900 disabled:opacity-50"
        >
          Lukk tapt
        </button>
      </div>
    </div>
  );
}
