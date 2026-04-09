"use client";

import { useCallback, useEffect, useState } from "react";

type AiDecision = {
  id: string;
  type: string;
  action: string;
  impact: number;
  confidence: number;
  explanation: string;
  dataUsed: string[];
  expectedOutcome: string;
  policyAllowed: boolean;
  policyReasons: string[];
  observeOnly: boolean;
  showApproveReject: boolean;
  assistPrefill: Record<string, unknown> | null;
};

type TowerAi = {
  autonomy: {
    level: number;
    mode: string;
    effectiveLevel: number;
    transparency: string[];
  };
  decisions: AiDecision[];
  decisionsBlocked: Array<{
    id: string;
    type: string;
    action: string;
    impact: number;
    confidence: number;
    explanation: string;
    dataUsed: string[];
    expectedOutcome: string;
    policyReasons: string[];
    effectiveAutonomyLevel: number;
  }>;
  menuSuggestion: {
    week: Array<{ dayLabel: string; suggestedMain: string; why: string }>;
    transparency: string[];
  };
  pricingSuggestions: {
    suggestions: Array<{ targetLabel: string; deltaPercent: number; reason: string; dataUsed: string[] }>;
    transparency: string[];
  };
  opsMonitor: {
    alerts: Array<{ severity: string; code: string; message: string; dataUsed: string[] }>;
    transparency: string[];
  };
  supplierSimulations: Array<{
    ingredientLabel: string;
    quote: { unitPriceNok: number | null; available: boolean; leadTimeDays: number; simulated: boolean; supplierName: string };
  }>;
  explainability: { why: string; dataUsed: string[]; expectedOutcomeNote: string };
};

type TowerData = {
  planRid: string;
  autonomyLevel: number;
  transparencyRoot: string[];
  ai?: TowerAi;
  dataUsed: {
    ordersWindow: { from: string; to: string };
    nextTargetDate: string;
    choiceKeysDistinct: number;
    locations: number;
  };
  demand: {
    forecast: {
      date: string;
      predictedOrders: number;
      confidence: number;
      marginOfError: number;
      plannedWithBuffer: number;
      bufferPercent: number;
      explanation: string[];
      transparencyNote: string;
    };
    portionMix: Record<string, number>;
    explain: string[];
  };
  procurement: {
    lines: Array<{ ingredient: string; requiredAmount: number; safetyBuffer: number; unit: string; totalWithBuffer: number }>;
    transparency: string[];
  };
  purchase: { lines: string[]; transparencyNote: string };
  suppliers: { lines: string[]; transparencyNote: string };
  production: {
    dateLabel: string;
    steps: Array<{ time: string; task: string }>;
    transparency: string[];
  };
  delivery: {
    ordered: Array<{ id: string; name: string; windowStart: string; windowEnd: string }>;
    transparency: string[];
    routeSummary: string[];
  };
  feedback: {
    evaluationDate: string;
    hindcastPredicted: number;
    actualActive: number;
    error: number;
    explain: string[];
  } | null;
  cost: { lines: string[]; transparency: string[] };
  menuSignals: Array<{ choiceKey: string; count: number; signal: string }>;
  globalOs?: {
    schemaVersion: number;
    snapshotAsOf: string;
    operationsVersion: string;
    transparency: string[];
    layers: {
      demand: {
        multiCity: Array<{ city: string; demand: number; capacity: number; loadBalanceSuggestion: string }>;
      };
      inventory: { lines: Array<{ ingredient: string; stock: number; risk: string }> };
      suppliers: {
        comparisons: Array<{
          ingredient: string;
          quotes: Array<{ supplierName: string; unitPriceNok: number | null; leadTimeDays: number; available: boolean }>;
          recommended: { supplierName: string } | null;
          fallback: { supplierName: string } | null;
        }>;
      };
      distribution: {
        assignments: Array<{ fromKitchenName: string; toZoneLabel: string; portions: number; rationale: string }>;
        explain: string[];
        totalCostIndexLoad: number;
      };
      decisionStream: Array<{ id: string; kind: string; summary: string; priority: number }>;
      profit: {
        costPerMealNok: number | null;
        marginPerCompanyNok: number | null;
        wasteCostNok: number | null;
        transparency: string[];
      };
      anomalies: Array<{ code: string; severity: string; message: string }>;
      remediations: Array<{ id: string; category: string; summary: string }>;
      simulations: Array<{ scenario: string; headline: string; deltas: Record<string, number>; explain: string[] }>;
      learning: { scope: string; hints: string[]; transparency: string[] };
      policy: { notes: string[] };
    };
  };
};

type ApiOk = { ok: true; rid: string; data: TowerData };
type ApiErr = { ok: false; message?: string; error?: string };

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="lp-glass-card rounded-3xl p-6">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-neutral-600">{subtitle}</p> : null}
      <div className="mt-4 space-y-2 text-sm text-neutral-800">{children}</div>
    </section>
  );
}

export default function OperationsTowerClient() {
  const [autonomyParam, setAutonomyParam] = useState<0 | 1 | 2>(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rid, setRid] = useState<string | null>(null);
  const [data, setData] = useState<TowerData | null>(null);
  const [ackLoading, setAckLoading] = useState(false);
  const [ackDone, setAckDone] = useState(false);
  const [ackErr, setAckErr] = useState<string | null>(null);
  const [decisionDone, setDecisionDone] = useState<Record<string, "accepted" | "rejected">>({});
  const [decisionBusy, setDecisionBusy] = useState<string | null>(null);
  const [decisionErr, setDecisionErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setAckDone(false);
    setAckErr(null);
    setDecisionErr(null);
    setDecisionDone({});
    try {
      const res = await fetch(`/api/admin/operations-tower?autonomy=${autonomyParam}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ApiOk | ApiErr | null;
      if (!res.ok || !json || (json as ApiOk).ok !== true) {
        const j = json as ApiErr;
        throw new Error(j?.message || j?.error || `HTTP ${res.status}`);
      }
      const ok = json as ApiOk;
      setData(ok.data);
      setRid(ok.rid || null);
    } catch (e: unknown) {
      setData(null);
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [autonomyParam]);

  useEffect(() => {
    void load();
  }, [load]);

  const onApprove = useCallback(async () => {
    if (!data?.planRid) return;
    setAckLoading(true);
    setAckErr(null);
    try {
      const res = await fetch("/api/admin/operations-tower", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planRid: data.planRid }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!res.ok || !json || json.ok !== true) {
        throw new Error(json?.message || `HTTP ${res.status}`);
      }
      setAckDone(true);
    } catch (e: unknown) {
      setAckErr(String((e as Error)?.message ?? e));
    } finally {
      setAckLoading(false);
    }
  }, [data?.planRid]);

  const onDecisionFeedback = useCallback(
    async (decisionId: string, outcome: "accepted" | "rejected") => {
      if (!data?.planRid) return;
      setDecisionBusy(decisionId);
      setDecisionErr(null);
      try {
        const res = await fetch("/api/admin/operations-tower", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            planRid: data.planRid,
            decisionFeedback: { decisionId, outcome },
          }),
        });
        const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
        if (!res.ok || !json || json.ok !== true) {
          throw new Error(json?.message || `HTTP ${res.status}`);
        }
        setDecisionDone((prev) => ({ ...prev, [decisionId]: outcome }));
      } catch (e: unknown) {
        setDecisionErr(String((e as Error)?.message ?? e));
      } finally {
        setDecisionBusy(null);
      }
    },
    [data?.planRid],
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-black/10 bg-white/60 p-8 text-center text-sm text-neutral-600">
        Laster kontrolltårn …
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
        {err ?? "Ingen data."}
        {rid ? <div className="mt-2 text-xs text-neutral-600">RID: {rid}</div> : null}
      </div>
    );
  }

  const fc = data.demand.forecast;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-dashed border-black/15 bg-white/70 p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Åpenhet og fail-safe</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-neutral-600">
          {data.transparencyRoot.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-neutral-500">
          Data brukt: ordre {data.dataUsed.ordersWindow.from} → {data.dataUsed.ordersWindow.to}, neste mål-dag{" "}
          {data.dataUsed.nextTargetDate}, {data.dataUsed.choiceKeysDistinct} menyvalg-typer, {data.dataUsed.locations}{" "}
          lokasjon(er).
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex items-center gap-2 text-xs text-neutral-700">
            <span className="font-semibold">Autonomi</span>
            <select
              className="rounded-xl border border-black/15 bg-white px-2 py-1.5 text-sm"
              value={autonomyParam}
              onChange={(e) => setAutonomyParam(Number(e.target.value) as 0 | 1 | 2)}
            >
              <option value={0}>0 — Observer</option>
              <option value={1}>1 — Anbefal</option>
              <option value={2}>2 — Assister (prefyll)</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={ackLoading || ackDone}
            onClick={() => void onApprove()}
            className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-black/10 disabled:opacity-50"
          >
            {ackDone ? "Godkjent (logget)" : ackLoading ? "Sender …" : "Godkjenn hele plan (logg)"}
          </button>
          <span className="text-xs text-neutral-600">
            Logger kun i revisjonslogg — ingen auto-innkjøp, ingen auto-produksjon, ingen auto-levering.
          </span>
        </div>
        {ackErr ? <p className="mt-2 text-xs text-rose-700">{ackErr}</p> : null}
      </div>

      {data.ai ? (
        <Section
          title="AI-beslutninger (kontrollert)"
          subtitle="Hvert forslag har forklaring, datagrunnlag og forventet effekt. Avvis eller godkjenn per punkt — logges for læring."
        >
          <p className="text-xs text-neutral-600">{data.ai.explainability.why}</p>
          <p className="text-xs text-neutral-500">
            Data: {data.ai.explainability.dataUsed.join(", ")}. {data.ai.explainability.expectedOutcomeNote}
          </p>
          {decisionErr ? <p className="text-xs text-rose-700">{decisionErr}</p> : null}
          <div className="mt-3 space-y-3">
            {data.ai.decisions.length === 0 ? (
              <p className="text-sm text-neutral-600">Ingen aktive forslag (policy, lav konfidans eller manglende data).</p>
            ) : null}
            {data.ai.decisions.map((d) => (
              <div key={d.id} className="rounded-2xl border border-black/10 bg-white/80 p-4 ring-1 ring-black/5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{d.type}</span>
                  <span className="text-xs text-neutral-600">
                    Konfidans: {Math.round(d.confidence * 100)} % · Effekt (indeks): {d.impact}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-neutral-900">{d.action}</p>
                <p className="mt-1 text-xs text-neutral-600">{d.explanation}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  <span className="font-semibold">Forventet:</span> {d.expectedOutcome}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  <span className="font-semibold">Data brukt:</span> {d.dataUsed.join("; ")}
                </p>
                {d.observeOnly ? (
                  <p className="mt-2 text-xs text-amber-800">Kun observasjon i dette nivået — ingen handlingsknapper.</p>
                ) : null}
                {d.showApproveReject && !d.observeOnly ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {decisionDone[d.id] ? (
                      <span className="text-xs font-semibold text-emerald-800">
                        Registrert: {decisionDone[d.id] === "accepted" ? "Godkjent" : "Avvist"}
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={decisionBusy === d.id}
                          onClick={() => void onDecisionFeedback(d.id, "accepted")}
                          className="rounded-full bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Godkjenn
                        </button>
                        <button
                          type="button"
                          disabled={decisionBusy === d.id}
                          onClick={() => void onDecisionFeedback(d.id, "rejected")}
                          className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 disabled:opacity-50"
                        >
                          Avvis
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
                {d.assistPrefill && autonomyParam >= 2 ? (
                  <p className="mt-2 text-xs text-neutral-500">
                    Prefyll-hint: {JSON.stringify(d.assistPrefill)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          {data.ai.decisionsBlocked.length > 0 ? (
            <div className="mt-4 rounded-2xl bg-amber-50/80 p-3 text-xs text-amber-950 ring-1 ring-amber-200">
              <span className="font-semibold">Blokkert av policy</span>
              <ul className="mt-2 list-disc pl-4">
                {data.ai.decisionsBlocked.map((b) => (
                  <li key={b.id}>
                    [{b.type}] {b.action} — {b.policyReasons.join(" ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Section>
      ) : null}

      {data.ai ? (
        <Section title="Menyforslag (uke)" subtitle="Utkast — ikke skrevet til meny.">
          <ul className="text-xs text-neutral-700">
            {data.ai.menuSuggestion.week.map((w) => (
              <li key={w.dayLabel}>
                <span className="font-semibold">{w.dayLabel}:</span> {w.suggestedMain} — {w.why}
              </li>
            ))}
          </ul>
          <ul className="mt-2 list-disc pl-4 text-xs text-neutral-500">
            {data.ai.menuSuggestion.transparency.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {data.ai && data.ai.pricingSuggestions.suggestions.length > 0 ? (
        <Section title="Prisforslag (sikkert spenn)" subtitle="Innenfor ±policy — manuell sjekk av kontrakt.">
          <ul className="text-xs text-neutral-700">
            {data.ai.pricingSuggestions.suggestions.map((s, i) => (
              <li key={i}>
                {s.targetLabel}: {s.deltaPercent > 0 ? "+" : ""}
                {s.deltaPercent}% — {s.reason}
              </li>
            ))}
          </ul>
          <ul className="mt-2 list-disc pl-4 text-xs text-neutral-500">
            {data.ai.pricingSuggestions.transparency.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {data.ai ? (
        <Section title="Driftsmonitor" subtitle="Ikke-blokkerende varsler.">
          <ul className="text-xs">
            {data.ai.opsMonitor.alerts.map((a, i) => (
              <li key={i} className={a.severity === "warn" ? "text-amber-900" : "text-neutral-700"}>
                [{a.severity}] {a.message}
              </li>
            ))}
          </ul>
          <ul className="mt-2 list-disc pl-4 text-xs text-neutral-500">
            {data.ai.opsMonitor.transparency.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {data.ai && data.ai.supplierSimulations.length > 0 ? (
        <Section title="Leverandør (simulert)" subtitle="Ingen ordre sendt — multi-leverandørnettverk (simulert).">
          <ul className="text-xs text-neutral-700">
            {data.ai.supplierSimulations.map((s, i) => (
              <li key={i}>
                {s.ingredientLabel}: {s.quote.supplierName} — ca. {s.quote.unitPriceNok ?? "—"} NOK/kg, ledetid{" "}
                {s.quote.leadTimeDays} d ({s.quote.available ? "tilgjengelig" : "utilgjengelig"}, simulert)
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {data.globalOs ? (
        <Section
          title="Global OS — kontrolltårn (additivt)"
          subtitle={`Schema v${data.globalOs.schemaVersion} · snapshot ${data.globalOs.snapshotAsOf} · versjon ${data.globalOs.operationsVersion}`}
        >
          <ul className="list-disc pl-5 text-xs text-neutral-600">
            {data.globalOs.transparency.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>

          <p className="mt-4 text-xs font-semibold text-neutral-900">Live etterspørsel (by / soner)</p>
          <ul className="mt-2 space-y-3 text-xs text-neutral-800">
            {data.globalOs.layers.demand.multiCity.map((c) => {
              const ratio = c.capacity > 0 ? Math.min(1, c.demand / c.capacity) : 0;
              return (
                <li key={c.city} className="rounded-2xl border border-black/10 bg-white/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{c.city}</span>
                    <span className="text-neutral-600">
                      {c.demand} / {c.capacity} porsjoner (nominelt)
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-clip rounded-full bg-neutral-200">
                    <div className="h-full rounded-full bg-neutral-800 transition-[width]" style={{ width: `${Math.round(ratio * 100)}%` }} />
                  </div>
                  <p className="mt-2 text-neutral-600">{c.loadBalanceSuggestion}</p>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 text-xs font-semibold text-neutral-900">Lagerstatus (estimat)</p>
          <ul className="mt-1 text-xs text-neutral-700">
            {data.globalOs.layers.inventory.lines.slice(0, 12).map((l) => (
              <li key={l.ingredient}>
                {l.ingredient}: lager ~{l.stock} — risiko{" "}
                <span className={l.risk === "high" ? "font-semibold text-rose-800" : ""}>{l.risk}</span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs font-semibold text-neutral-900">Leverandørsammenligning (simulert)</p>
          <ul className="mt-1 space-y-2 text-xs text-neutral-700">
            {data.globalOs.layers.suppliers.comparisons.map((c) => (
              <li key={c.ingredient} className="rounded-xl bg-neutral-50/90 p-2 ring-1 ring-black/5">
                <span className="font-semibold">{c.ingredient}</span>
                <div className="mt-1 text-neutral-600">
                  Primær: {c.recommended?.supplierName ?? "—"} · Reserve: {c.fallback?.supplierName ?? "—"}
                </div>
                <ul className="mt-1 list-disc pl-4 text-neutral-500">
                  {c.quotes.slice(0, 3).map((q, i) => (
                    <li key={i}>
                      {q.supplierName}: {q.unitPriceNok ?? "—"} NOK/kg, {q.leadTimeDays} d
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs font-semibold text-neutral-900">Distribusjon (forslag)</p>
          <p className="text-xs text-neutral-600">Kost-indeks last (heuristikk): {data.globalOs.layers.distribution.totalCostIndexLoad}</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs text-neutral-700">
            {data.globalOs.layers.distribution.assignments.slice(0, 14).map((a, i) => (
              <li key={i}>
                {a.fromKitchenName} → {a.toZoneLabel}: {a.portions} porsjoner
              </li>
            ))}
          </ol>
          <ul className="mt-1 list-disc pl-5 text-xs text-neutral-500">
            {data.globalOs.layers.distribution.explain.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>

          <p className="mt-4 text-xs font-semibold text-neutral-900">Beslutningsstrøm (snapshot)</p>
          <ul className="mt-1 space-y-1 text-xs text-neutral-700">
            {data.globalOs.layers.decisionStream.slice(0, 12).map((e) => (
              <li key={e.id}>
                <span className="font-mono text-[10px] text-neutral-500">{e.kind}</span> · {e.summary}
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs font-semibold text-neutral-900">Margin og svinn (estimat)</p>
          <ul className="mt-1 text-xs text-neutral-700">
            <li>Kost per måltid (est.): {data.globalOs.layers.profit.costPerMealNok ?? "—"} NOK</li>
            <li>Margin per selskap (est.): {data.globalOs.layers.profit.marginPerCompanyNok ?? "—"} NOK</li>
            <li>Svinnkost (prognosefeil): {data.globalOs.layers.profit.wasteCostNok ?? "—"} NOK</li>
          </ul>
          <ul className="mt-1 list-disc pl-5 text-xs text-neutral-500">
            {data.globalOs.layers.profit.transparency.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>

          <p className="mt-4 text-xs font-semibold text-neutral-900">Anomalier</p>
          <ul className="mt-1 text-xs">
            {data.globalOs.layers.anomalies.map((a, i) => (
              <li key={i} className={a.severity === "critical" ? "text-rose-900" : a.severity === "warn" ? "text-amber-900" : "text-neutral-700"}>
                [{a.code}] {a.message}
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs font-semibold text-neutral-900">Selvhelbredelse — kun forslag (krever godkjenning)</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-neutral-700">
            {data.globalOs.layers.remediations.map((r) => (
              <li key={r.id}>
                [{r.category}] {r.summary}
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs font-semibold text-neutral-900">Simuleringer («hva hvis»)</p>
          <ul className="mt-1 space-y-2 text-xs text-neutral-700">
            {data.globalOs.layers.simulations.map((s) => (
              <li key={s.scenario} className="rounded-xl border border-black/10 bg-white/60 p-2">
                <span className="font-semibold">{s.scenario}</span>: {s.headline}
                <ul className="mt-1 list-disc pl-4 text-neutral-600">
                  {s.explain.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs font-semibold text-neutral-900">Læring (kun tenant)</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-neutral-700">
            {data.globalOs.layers.learning.hints.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
          <ul className="mt-1 list-disc pl-5 text-xs text-neutral-500">
            {data.globalOs.layers.learning.transparency.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>

          <p className="mt-4 text-xs font-semibold text-neutral-900">Policy og styring</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-neutral-700">
            {data.globalOs.layers.policy.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="1. Etterspørselsprognose" subtitle={fc.transparencyNote}>
        <p>
          <span className="font-semibold">Neste dag:</span> {fc.date} — ca. {fc.predictedOrders} porsjoner (±{fc.marginOfError}
          ), plan med buffer ca. {fc.plannedWithBuffer} (+{fc.bufferPercent.toFixed(0)} %).
        </p>
        <ul className="list-disc pl-5 text-xs text-neutral-600">
          {fc.explanation.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
        {data.feedback ? (
          <div className="mt-3 rounded-2xl bg-neutral-50/80 p-3 text-xs text-neutral-700 ring-1 ring-black/5">
            <span className="font-semibold">Tilbakemelding (hindcast {data.feedback.evaluationDate}):</span>
            <ul className="mt-1 list-disc pl-4">
              {data.feedback.explain.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      <Section title="2. Innkjøpsplan" subtitle={data.purchase.transparencyNote}>
        <p className="text-xs text-neutral-600">Fordeling av porsjoner per menyvalg (prognose × historisk miks):</p>
        <ul className="text-xs text-neutral-700">
          {Object.entries(data.demand.portionMix).map(([k, v]) => (
            <li key={k}>
              {k}: {v}
            </li>
          ))}
        </ul>
        <ul className="mt-2 list-disc pl-5">
          {data.procurement.lines.map((l) => (
            <li key={l.ingredient}>
              {l.ingredient}: {l.totalWithBuffer} {l.unit} totalt ({l.requiredAmount} + buffer {l.safetyBuffer})
            </li>
          ))}
        </ul>
        <ul className="mt-2 list-disc pl-5 text-neutral-700">
          {data.purchase.lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
        <ul className="mt-1 list-disc pl-5 text-xs text-neutral-500">
          {data.procurement.transparency.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </Section>

      <Section title="3. Produksjonsplan" subtitle="Forslag — kjøkken overstyrer alltid.">
        <ol className="list-decimal space-y-2 pl-5">
          {data.production.steps.map((s, i) => (
            <li key={i}>
              <span className="font-mono text-xs text-neutral-500">{s.time}</span> — {s.task}
            </li>
          ))}
        </ol>
        <ul className="mt-2 list-disc pl-5 text-xs text-neutral-500">
          {data.production.transparency.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </Section>

      <Section title="4. Leveringsplan" subtitle="Rekkefølge etter vindu og navn.">
        <ol className="list-decimal space-y-1 pl-5">
          {data.delivery.routeSummary.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        <ul className="mt-2 list-disc pl-5 text-xs text-neutral-500">
          {data.delivery.transparency.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </Section>

      <Section title="Leverandørforslag (V1)" subtitle={data.suppliers.transparencyNote}>
        <ul className="list-disc pl-5 text-xs text-neutral-700">
          {data.suppliers.lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </Section>

      <Section title="Kost og meny" subtitle="Kun signaler — ikke auto-endring.">
        <ul className="list-disc pl-5 text-xs text-neutral-700">
          {data.cost.lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
        <ul className="mt-2 list-disc pl-5 text-xs text-neutral-500">
          {data.cost.transparency.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs font-semibold text-neutral-800">Menyvalg (volum)</p>
        <ul className="text-xs text-neutral-600">
          {data.menuSignals.map((m) => (
            <li key={m.choiceKey}>
              {m.choiceKey}: {m.count} ({m.signal})
            </li>
          ))}
        </ul>
      </Section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-neutral-900"
        >
          Oppdater plan
        </button>
      </div>
    </div>
  );
}
