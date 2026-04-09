"use client";

import { memo, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";

import type { NodeDetail, NodeKind, SystemGraphPayload } from "@/lib/repo-intelligence/buildSystemGraph";

type ApiMetric = {
  errors: number;
  latency: number | null;
  successRate: number;
  count?: number;
  lastError?: string | null;
  lastActivityAt?: string | null;
};

type DbMetric = {
  rows: number | null;
  recentWrites: number;
};

type RevenueMetric = { revenue: number };

type SystemAlertRow = {
  id: string;
  severity: string;
  message: string;
  explain: string;
  alertType: string;
  createdAt: string;
  rid: string | null;
};

type SelfHealHistoryRow = {
  id: string;
  createdAt: string;
  monitoringRid: string | null;
  mode: string | null;
  enabled: boolean | null;
  hadExecution: boolean | null;
  note: string | null;
  planned: unknown;
  results: unknown;
  verification: unknown;
};

export type LiveMetricsBundle = {
  api: Record<string, ApiMetric>;
  db: Record<string, DbMetric>;
  revenue: Record<string, RevenueMetric>;
  graphMeta?: { windowHours?: number; generatedAt?: string; error?: boolean };
  graphHealth?: { aiLogOk?: boolean; databaseReachable?: boolean };
};

type ProcessTelemetry = {
  metrics: {
    requests: number;
    errors: number;
    revenue: number;
    avgLatencyMs: number;
    latencySamples: number;
  };
  health: { errorRate: number; avgLatency: number };
};

type Health = "green" | "yellow" | "red";

type EnrichedNodeData = {
  kind: NodeKind;
  label: string;
  health: Health;
  metrics?: {
    errors?: number;
    latency?: number | null;
    successRate?: number;
    rows?: number | null;
    recentWrites?: number;
    revenue?: number;
  };
  tooltip: string;
  emphasis: "high" | "low" | "normal";
};

const KIND_COLORS: Record<NodeKind, string> = {
  route: "#2563eb",
  api: "#16a34a",
  table: "#ea580c",
  lib: "#6b7280",
};

function normApiPath(p: string): string {
  const s = p.split("?")[0].trim();
  if (s.startsWith("http")) {
    try {
      return new URL(s).pathname || "";
    } catch {
      return "";
    }
  }
  return s.startsWith("/") ? s : `/${s}`;
}

function healthFromApi(m?: ApiMetric): Health {
  if (!m) return "green";
  if (m.errors > 0) return "red";
  if (m.successRate < 0.9) return "yellow";
  return "green";
}

function healthFromDb(m?: DbMetric): Health {
  if (!m) return "green";
  if (m.rows === null) return "green";
  return "green";
}

function maxRevenueValue(rev: Record<string, RevenueMetric>): number {
  let m = 1;
  for (const v of Object.values(rev)) {
    if (v.revenue > m) m = v.revenue;
  }
  return m;
}

function enrichNode(
  id: string,
  kind: NodeKind,
  label: string,
  detail: NodeDetail | undefined,
  live: LiveMetricsBundle | null
): EnrichedNodeData {
  const api = live?.api ?? {};
  const db = live?.db ?? {};
  const revenue = live?.revenue ?? {};

  let health: Health = "green";
  let metrics: EnrichedNodeData["metrics"];
  let emphasis: EnrichedNodeData["emphasis"] = "normal";

  if (kind === "api") {
    const m = api[label];
    metrics = m
      ? {
          errors: m.errors,
          latency: m.latency,
          successRate: m.successRate,
        }
      : undefined;
    health = healthFromApi(m);
  } else if (kind === "table") {
    const m = db[label];
    metrics = m
      ? {
          rows: m.rows,
          recentWrites: m.recentWrites,
        }
      : undefined;
    health = healthFromDb(m);
    const rev = revenue[label]?.revenue ?? 0;
    metrics = { ...metrics, revenue: rev };
    const maxR = maxRevenueValue(revenue);
    emphasis = rev > maxR * 0.25 && maxR > 0 ? "high" : rev <= 0 ? "low" : "normal";
  } else if (kind === "route") {
    const urls = detail?.fetch_urls ?? [];
    let worst: Health = "green";
    let sumErr = 0;
    let sumCount = 0;
    let weightedSr = 0;
    for (const u of urls) {
      const p = normApiPath(u);
      if (!p.startsWith("/api/")) continue;
      const m = api[p];
      if (!m) continue;
      const h = healthFromApi(m);
      if (h === "red") worst = "red";
      else if (h === "yellow" && worst !== "red") worst = "yellow";
      sumErr += m.errors;
      sumCount += m.count ?? 0;
      weightedSr += m.successRate * (m.count ?? 1);
    }
    health = worst;
    if (sumCount > 0) {
      metrics = {
        errors: sumErr,
        successRate: weightedSr / sumCount,
      };
    }
  } else {
    const rev = Object.values(revenue).reduce((a, b) => a + b.revenue, 0);
    emphasis = rev > 0 ? "normal" : "low";
  }

  const lines: string[] = [];
  lines.push(`${kind} · ${label}`);
  if (metrics?.errors != null) lines.push(`Feil (vindu): ${metrics.errors}`);
  if (metrics?.successRate != null) lines.push(`Suksessrate: ${(metrics.successRate * 100).toFixed(1)}%`);
  if (metrics?.latency != null) lines.push(`Latency: ${metrics.latency} ms`);
  if (metrics?.rows != null) lines.push(`Rader: ${metrics.rows}`);
  if (metrics?.recentWrites != null) lines.push(`Skriv siste time: ${metrics.recentWrites}`);
  if (metrics?.revenue != null) lines.push(`Omsetning (attribuert): ${metrics.revenue.toFixed(0)}`);
  if (kind === "api") {
    const m = api[label];
    if (m?.lastError) lines.push(`Siste feil: ${m.lastError}`);
    if (m?.lastActivityAt) lines.push(`Siste aktivitet: ${m.lastActivityAt}`);
  }

  return {
    kind,
    label,
    health,
    metrics,
    tooltip: lines.join("\n"),
    emphasis,
  };
}

function enrichEdges(
  edges: Edge[],
  live: LiveMetricsBundle | null,
  nodeData: Map<string, EnrichedNodeData>
): Edge[] {
  const rev = live?.revenue ?? {};
  const maxR = maxRevenueValue(rev);
  return edges.map((e) => {
    const s = nodeData.get(e.source);
    const t = nodeData.get(e.target);
    const rS = s?.kind === "table" ? rev[s.label]?.revenue ?? 0 : 0;
    const rT = t?.kind === "table" ? rev[t.label]?.revenue ?? 0 : 0;
    const r = Math.max(rS, rT);
    const thick = 1 + Math.min(7, (r / maxR) * 7);
    const sh = s?.health ?? "green";
    const th = t?.health ?? "green";
    const edgeHealth = sh === "red" || th === "red" ? "red" : sh === "yellow" || th === "yellow" ? "yellow" : "green";
    const stroke =
      e.style && (e.style as { stroke?: string }).stroke === "#ca8a04"
        ? "#ca8a04"
        : edgeHealth === "red"
          ? "#ef4444"
          : edgeHealth === "yellow"
            ? "#eab308"
            : "#94a3b8";
    const baseW = (e.style as { strokeWidth?: number })?.strokeWidth ?? 1;
    const isFlow = (e.style as { stroke?: string })?.stroke === "#ca8a04";
    return {
      ...e,
      style: {
        ...e.style,
        stroke,
        strokeWidth: isFlow ? Math.max(thick, 3) : Math.max(thick, baseW),
      },
    };
  });
}

const SystemNode = memo(function SystemNodeInner({ data, selected }: NodeProps) {
  const d = data as EnrichedNodeData;
  const kind = d.kind;
  const label = d.label;
  const base = KIND_COLORS[kind] ?? "#64748b";
  const health = d.health;
  const border =
    health === "red" ? "#dc2626" : health === "yellow" ? "#ca8a04" : base;
  const pulse = health === "red";
  const faded = d.emphasis === "low";
  const bold = d.emphasis === "high";

  return (
    <div
      className="rounded-lg border-2 bg-white px-2 py-1.5 text-[11px] shadow-sm"
      title={d.tooltip}
      style={{
        borderColor: border,
        borderWidth: 2,
        borderStyle: "solid",
        opacity: faded ? 0.45 : 1,
        fontWeight: bold ? 700 : 400,
        animation: pulse ? "lp-graph-pulse 1.2s ease-in-out infinite" : undefined,
        outline: selected ? `2px solid ${border}` : undefined,
      }}
    >
      <style>{`
        @keyframes lp-graph-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
          50% { box-shadow: 0 0 0 6px rgba(220, 38, 38, 0); }
        }
      `}</style>
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-slate-400" />
      <div className="font-semibold uppercase tracking-wide" style={{ color: base }}>
        {kind}
      </div>
      <div className="break-all text-slate-900">{label}</div>
      {d.metrics && (
        <div className="mt-1 border-t border-slate-100 pt-1 font-mono text-[9px] text-slate-600">
          {d.metrics.errors != null && d.metrics.errors > 0 && (
            <div className="text-red-600">err {d.metrics.errors}</div>
          )}
          {d.metrics.latency != null && d.metrics.latency > 0 && <div>{d.metrics.latency}ms</div>}
          {d.metrics.successRate != null && (
            <div>{(d.metrics.successRate * 100).toFixed(0)}% ok</div>
          )}
          {d.metrics.rows != null && <div>rows {d.metrics.rows}</div>}
          {d.metrics.recentWrites != null && d.metrics.recentWrites > 0 && (
            <div>w+{d.metrics.recentWrites}/h</div>
          )}
          {d.metrics.revenue != null && d.metrics.revenue > 0 && (
            <div className="text-slate-800">{d.metrics.revenue.toFixed(0)} kr</div>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-slate-400" />
    </div>
  );
});

const nodeTypes = { system: SystemNode };

type Filters = {
  routes: boolean;
  apis: boolean;
  tables: boolean;
  libs: boolean;
  flowOnly: boolean;
};

const defaultFilters: Filters = {
  routes: true,
  apis: true,
  tables: true,
  libs: true,
  flowOnly: false,
};

function GraphCanvas({
  payload,
  filters,
  search,
  onSelectNode,
  liveMetrics,
}: {
  payload: SystemGraphPayload;
  filters: Filters;
  search: string;
  onSelectNode: (id: string | null) => void;
  liveMetrics: LiveMetricsBundle | null;
}) {
  const q = search.trim().toLowerCase();
  const deferredLive = useDeferredValue(liveMetrics);

  const filtered = useMemo(() => {
    const flowSet = new Set(payload.flowNodeIds);
    const nodesOut: Node[] = [];
    for (const n of payload.nodes as Node[]) {
      const kind = (n.data as { kind: NodeKind }).kind;
      if (filters.flowOnly && !flowSet.has(n.id)) continue;
      if (kind === "route" && !filters.routes) continue;
      if (kind === "api" && !filters.apis) continue;
      if (kind === "table" && !filters.tables) continue;
      if (kind === "lib" && !filters.libs) continue;
      if (q) {
        const label = String((n.data as { label: string }).label).toLowerCase();
        const d = payload.detailsById[n.id];
        const file = (d?.file ?? "").toLowerCase();
        const idl = n.id.toLowerCase();
        if (!label.includes(q) && !file.includes(q) && !idl.includes(q)) continue;
      }
      nodesOut.push(n);
    }
    const ids = new Set(nodesOut.map((n) => n.id));
    const edgesOut = payload.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    return { nodes: nodesOut, edges: edgesOut };
  }, [payload, filters, q]);

  const merged = useMemo(() => {
    const nodeMap = new Map<string, EnrichedNodeData>();
    const mergedNodes: Node[] = filtered.nodes.map((n) => {
      const kind = (n.data as { kind: NodeKind }).kind;
      const label = String((n.data as { label: string }).label);
      const detail = payload.detailsById[n.id];
      const enriched = enrichNode(n.id, kind, label, detail, deferredLive);
      nodeMap.set(n.id, enriched);
      return {
        ...n,
        data: enriched,
      };
    });
    const mergedEdges = enrichEdges(filtered.edges as Edge[], deferredLive, nodeMap);
    return { nodes: mergedNodes, edges: mergedEdges };
  }, [filtered.nodes, filtered.edges, payload.detailsById, deferredLive]);

  const [nodes, setNodes, onNodesChange] = useNodesState(merged.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(merged.edges);

  useEffect(() => {
    setNodes(merged.nodes);
    setEdges(merged.edges);
  }, [merged, setNodes, setEdges]);

  const flowKey = `${filters.flowOnly}-${filters.routes}-${filters.apis}-${filters.tables}-${filters.libs}-${q}`;

  return (
    <ReactFlow
      key={flowKey}
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, n) => onSelectNode(n.id)}
      onPaneClick={() => onSelectNode(null)}
      onInit={(inst) => {
        window.setTimeout(() => inst.fitView({ padding: 0.12, duration: 200 }), 40);
      }}
      nodeTypes={nodeTypes}
      fitView
      onlyRenderVisibleElements
      minZoom={0.05}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={16} color="#e2e8f0" />
      <Controls />
      <MiniMap nodeStrokeWidth={2} zoomable pannable style={{ background: "#f8fafc" }} />
    </ReactFlow>
  );
}

export default function SystemGraphClient() {
  const [payload, setPayload] = useState<SystemGraphPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetricsBundle | null>(null);
  const [processTelemetry, setProcessTelemetry] = useState<ProcessTelemetry | null>(null);
  const [metricsError, setMetricsError] = useState(false);
  const [systemAlerts, setSystemAlerts] = useState<SystemAlertRow[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [selfHealRuns, setSelfHealRuns] = useState<SelfHealHistoryRow[]>([]);
  const [selfHealLoading, setSelfHealLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/superadmin/system-graph/data", { cache: "no-store" });
        const json = (await res.json()) as { ok?: boolean; data?: SystemGraphPayload; message?: string };
        if (cancelled) return;
        if (!json.ok || !json.data) {
          setErr(json.message ?? "Kunne ikke laste graf.");
          return;
        }
        setPayload(json.data);
      } catch {
        setErr("Nettverksfeil.");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchObs = async () => {
      try {
        const res = await fetch("/api/observability?graph=1", { cache: "no-store", credentials: "same-origin" });
        const raw = (await res.json()) as {
          ok?: boolean;
          data?: LiveMetricsBundle & { processMetrics?: ProcessTelemetry };
          api?: LiveMetricsBundle["api"];
          db?: LiveMetricsBundle["db"];
          revenue?: LiveMetricsBundle["revenue"];
          graphMeta?: LiveMetricsBundle["graphMeta"];
          graphHealth?: LiveMetricsBundle["graphHealth"];
          processMetrics?: ProcessTelemetry;
        };
        if (cancelled) return;
        const json = raw.data ?? (raw as unknown as LiveMetricsBundle & { processMetrics?: ProcessTelemetry });
        if (
          !raw.ok ||
          json.api === undefined ||
          json.db === undefined ||
          json.revenue === undefined
        ) {
          setMetricsError(true);
          setLiveMetrics(null);
          setProcessTelemetry(null);
        } else {
          setMetricsError(false);
          setLiveMetrics({
            api: json.api,
            db: json.db,
            revenue: json.revenue,
            graphMeta: json.graphMeta,
            graphHealth: json.graphHealth,
          });
          setProcessTelemetry(json.processMetrics ?? null);
        }
      } catch {
        if (!cancelled) {
          setMetricsError(true);
          setLiveMetrics(null);
          setProcessTelemetry(null);
        }
      }
    };

    void fetchObs();
    const iv = setInterval(() => void fetchObs(), 8000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  const detail: NodeDetail | null = useMemo(() => {
    if (!payload || !selectedId) return null;
    return payload.detailsById[selectedId] ?? null;
  }, [payload, selectedId]);

  const selectedLive = useMemo(() => {
    if (!payload || !selectedId) return null;
    const d = payload.detailsById[selectedId];
    if (!d) return null;
    if (d.kind === "api") return liveMetrics?.api[d.label];
    if (d.kind === "table") return liveMetrics?.db[d.label];
    return null;
  }, [payload, selectedId, liveMetrics]);

  const stats = payload?.stats;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-4">
        <h1 className="text-xl font-semibold text-slate-900">Systemgraf</h1>
        <p className="text-sm text-slate-600">
          Ruter, API, databasetabeller og bibliotek (fra <code className="rounded bg-slate-100 px-1">repo-intelligence</code>
          ) med live målinger fra <code className="rounded bg-slate-100 px-1">/api/observability?graph=1</code>.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {stats && (
            <span className="text-slate-500">
              Noder: {stats.routes} ruter · {stats.apis} API · {stats.tables} tabeller · {stats.libs} lib · {stats.edges} kanter
            </span>
          )}
          {metricsError && <span className="font-medium text-amber-700">Ingen live-data (observability utilgjengelig)</span>}
          {!metricsError && liveMetrics?.graphMeta?.generatedAt && (
            <span className="text-slate-500">
              Live: {new Date(liveMetrics.graphMeta.generatedAt).toLocaleTimeString("nb-NO")} · vindu{" "}
              {liveMetrics.graphMeta.windowHours ?? "?"}h · auto 8s
            </span>
          )}
          {liveMetrics?.graphHealth && (
            <span className={liveMetrics.graphHealth.databaseReachable ? "text-green-700" : "text-red-600"}>
              DB {liveMetrics.graphHealth.databaseReachable ? "OK" : "NED"}
            </span>
          )}
        </div>
      </div>

      <section
        className="rounded-xl border border-slate-200 bg-white p-4"
        aria-labelledby="process-telemetry-heading"
      >
        <h2 id="process-telemetry-heading" className="mb-2 text-sm font-semibold text-slate-900">
          Prosess (Node)
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Aggregering i minnet for instrumenterte API-kall (forespørsler, feilrate, latency, omsetning).
        </p>
        {!processTelemetry && <p className="text-xs text-slate-500">Ingen prosessdata ennå.</p>}
        {processTelemetry && (
          <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
              <dt className="text-slate-500">Forespørsler</dt>
              <dd className="font-mono text-sm font-semibold text-slate-900">
                {processTelemetry.metrics.requests}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
              <dt className="text-slate-500">Feilrate</dt>
              <dd className="font-mono text-sm font-semibold text-slate-900">
                {(processTelemetry.health.errorRate * 100).toFixed(2)}%
              </dd>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
              <dt className="text-slate-500">Snitt latency</dt>
              <dd className="font-mono text-sm font-semibold text-slate-900">
                {processTelemetry.health.avgLatency.toFixed(1)} ms
              </dd>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
              <dt className="text-slate-500">Omsetning (agg)</dt>
              <dd className="font-mono text-sm font-semibold text-slate-900">
                {processTelemetry.metrics.revenue.toFixed(2)}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section
        className="rounded-xl border border-slate-200 bg-white p-4"
        aria-labelledby="system-alerts-heading"
      >
        <h2 id="system-alerts-heading" className="mb-2 text-sm font-semibold text-slate-900">
          Systemvarsler
        </h2>
        <p className="mb-2 text-xs text-slate-500">
          Anomalier fra overvåkningsjobb (baseline vs. avvik). Oppdateres hvert 30. sekund.
        </p>
        {alertsLoading && <p className="text-xs text-slate-500">Laster varsler…</p>}
        {!alertsLoading && systemAlerts.length === 0 && (
          <p className="text-xs text-slate-500">Ingen nylige varsler (medium/høy).</p>
        )}
        <ul className="max-h-56 space-y-2 overflow-y-auto">
          {systemAlerts.map((a) => (
            <li key={a.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    a.severity === "high"
                      ? "font-medium text-red-700"
                      : a.severity === "medium"
                        ? "font-medium text-amber-800"
                        : "font-medium text-slate-700"
                  }
                >
                  {a.severity.toUpperCase()}
                </span>
                <span className="text-slate-500">
                  {a.createdAt ? new Date(a.createdAt).toLocaleString("nb-NO") : "—"}
                </span>
                {a.alertType ? (
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                    {a.alertType}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 font-medium text-slate-800">{a.message}</p>
              <p className="mt-0.5 text-slate-600">{a.explain}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="rounded-xl border border-slate-200 bg-white p-4"
        aria-labelledby="self-heal-heading"
      >
        <h2 id="self-heal-heading" className="mb-2 text-sm font-semibold text-slate-900">
          Selvhelbredelse
        </h2>
        <p className="mb-2 text-xs text-slate-500">
          Policy-styrt (kill switch + dry-run/semi/auto). Kun tillatte serverhandlinger; ingen skjemaendring eller
          sletting. Siste kjøringer fra audit-logg. Oppdateres hvert 45. sekund.
        </p>
        {selfHealLoading && <p className="text-xs text-slate-500">Laster historikk…</p>}
        {!selfHealLoading && selfHealRuns.length === 0 && (
          <p className="text-xs text-slate-500">Ingen self-heal-rader i loggen ennå.</p>
        )}
        {selfHealRuns.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 text-xs text-slate-600">
            <span>
              Siste modus:{" "}
              <strong className="text-slate-800">{selfHealRuns[0]?.mode ?? "—"}</strong>
            </span>
            <span>
              Aktivert:{" "}
              <strong className="text-slate-800">
                {selfHealRuns[0]?.enabled === true ? "ja" : selfHealRuns[0]?.enabled === false ? "nei (kill switch)" : "—"}
              </strong>
            </span>
          </div>
        )}
        <ul className="max-h-52 space-y-2 overflow-y-auto">
          {selfHealRuns.map((r) => (
            <li key={r.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2 font-mono text-[10px] text-slate-700">
              <div className="mb-1 flex flex-wrap gap-2 text-[10px]">
                <span>{r.createdAt ? new Date(r.createdAt).toLocaleString("nb-NO") : "—"}</span>
                {r.note ? (
                  <span className="rounded bg-slate-200 px-1 py-0.5">{r.note}</span>
                ) : null}
                {r.hadExecution ? (
                  <span className="rounded bg-amber-100 px-1 py-0.5 text-amber-900">utført</span>
                ) : (
                  <span className="rounded bg-slate-200 px-1 py-0.5">sim/ingen kjøring</span>
                )}
              </div>
              <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all text-[9px] leading-snug">
                {JSON.stringify({ planned: r.planned, results: r.results, verification: r.verification }, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.routes}
                onChange={(e) => setFilters((f) => ({ ...f, routes: e.target.checked }))}
              />
              Ruter
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.apis}
                onChange={(e) => setFilters((f) => ({ ...f, apis: e.target.checked }))}
              />
              API
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.tables}
                onChange={(e) => setFilters((f) => ({ ...f, tables: e.target.checked }))}
              />
              DB
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.libs}
                onChange={(e) => setFilters((f) => ({ ...f, libs: e.target.checked }))}
              />
              Lib
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.flowOnly}
                onChange={(e) => setFilters((f) => ({ ...f, flowOnly: e.target.checked }))}
              />
              Kun flyt (JSON)
            </label>
          </div>
          <input
            type="search"
            placeholder="Søk rute, fil, tabell, id…"
            className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading && <p className="text-sm text-slate-500">Laster graf…</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      {!loading && !err && payload && (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div
            className="min-h-[560px] flex-1 min-w-0 rounded-xl border border-slate-200 bg-slate-50"
            style={{ height: "calc(100vh - 320px)" }}
          >
            <ReactFlowProvider>
              <GraphCanvas
                payload={payload}
                filters={filters}
                search={search}
                onSelectNode={setSelectedId}
                liveMetrics={liveMetrics}
              />
            </ReactFlowProvider>
          </div>
          <aside className="w-full shrink-0 rounded-xl border border-slate-200 bg-white p-4 lg:w-80">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Detaljer</h2>
            {!selectedId && <p className="text-xs text-slate-500">Klikk på en node.</p>}
            {detail && (
              <dl className="space-y-2 text-xs text-slate-700">
                <div>
                  <dt className="font-medium text-slate-500">Type</dt>
                  <dd>{detail.kind}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Label</dt>
                  <dd className="break-all">{detail.label}</dd>
                </div>
                {selectedLive && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                    <dt className="font-medium text-slate-500">Live (vindu)</dt>
                    <dd className="mt-1 font-mono text-[10px] whitespace-pre-wrap">
                      {JSON.stringify(selectedLive, null, 2)}
                    </dd>
                  </div>
                )}
                {detail.file && (
                  <div>
                    <dt className="font-medium text-slate-500">Fil</dt>
                    <dd className="break-all font-mono">{detail.file}</dd>
                  </div>
                )}
                {detail.fetch_urls && detail.fetch_urls.length > 0 && (
                  <div>
                    <dt className="font-medium text-slate-500">fetch / API</dt>
                    <dd className="break-all">{detail.fetch_urls.join(", ")}</dd>
                  </div>
                )}
                {detail.uses_tables && detail.uses_tables.length > 0 && (
                  <div>
                    <dt className="font-medium text-slate-500">Tabeller</dt>
                    <dd>{detail.uses_tables.join(", ")}</dd>
                  </div>
                )}
                {detail.rpc_calls && detail.rpc_calls.length > 0 && (
                  <div>
                    <dt className="font-medium text-slate-500">RPC</dt>
                    <dd className="font-mono">{detail.rpc_calls.join(", ")}</dd>
                  </div>
                )}
                {detail.used_in_files && detail.used_in_files.length > 0 && (
                  <div>
                    <dt className="font-medium text-slate-500">Brukes i</dt>
                    <dd className="max-h-40 overflow-y-auto break-all font-mono text-[10px]">
                      {detail.used_in_files.slice(0, 40).join("\n")}
                      {detail.used_in_files.length > 40 ? "\n…" : ""}
                    </dd>
                  </div>
                )}
                {detail.imports && detail.imports.length > 0 && (
                  <div>
                    <dt className="font-medium text-slate-500">Imports (utdrag)</dt>
                    <dd className="max-h-32 overflow-y-auto break-all font-mono text-[10px]">
                      {detail.imports.slice(0, 25).join("\n")}
                      {detail.imports.length > 25 ? "\n…" : ""}
                    </dd>
                  </div>
                )}
                {detail.dependencies_out && detail.dependencies_out.length > 0 && (
                  <div>
                    <dt className="font-medium text-slate-500">Avhengigheter ut</dt>
                    <dd className="max-h-32 overflow-y-auto break-all font-mono text-[10px]">
                      {detail.dependencies_out.slice(0, 30).join("\n")}
                      {detail.dependencies_out.length > 30 ? "\n…" : ""}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
