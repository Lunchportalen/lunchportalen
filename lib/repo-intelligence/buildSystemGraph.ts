/**
 * Builds graph nodes/edges from repo-intelligence JSON (no repo parsing).
 *
 * IMPORTANT: Do not import `reactflow` here — it pulls React context into the API bundle
 * and breaks server route collection (`createContext is not a function`). Shapes match
 * what `reactflow` expects on the client (structural typing).
 */

export type NodeKind = "route" | "api" | "table" | "lib";

/** JSON-serializable node (compatible with reactflow `Node` on the client). */
export type SystemGraphRfNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

/** JSON-serializable edge (compatible with reactflow `Edge` on the client). */
export type SystemGraphRfEdge = {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  label?: string;
  style?: Record<string, unknown>;
  markerEnd?: { type: string; color?: string };
};

/** Same marker string as `MarkerType.ArrowClosed` in reactflow — no runtime import. */
const MARKER_ARROW_CLOSED = "arrowclosed" as const;

export type NodeDetail = {
  id: string;
  kind: NodeKind;
  label: string;
  file?: string;
  uses_tables?: string[];
  rpc_calls?: string[];
  fetch_urls?: string[];
  imports?: string[];
  /** Files referencing this table (from db-map). */
  used_in_files?: string[];
  dependencies_out?: string[];
};

export type SystemGraphPayload = {
  nodes: SystemGraphRfNode[];
  edges: SystemGraphRfEdge[];
  flowEdgeIds: string[];
  /** Node ids that appear in flows.json (for “flow only” filter). */
  flowNodeIds: string[];
  detailsById: Record<string, NodeDetail>;
  stats: {
    routes: number;
    apis: number;
    tables: number;
    libs: number;
    edges: number;
    flowSteps: number;
  };
};

type RouteRow = {
  file: string;
  url_path: string;
  fetch_urls: string[];
  uses_tables: string[];
};

type EndpointRow = {
  route: string;
  file: string;
  methods: string[];
  uses_tables: string[];
  rpc_calls: string[];
};

type RepoFile = {
  path: string;
  type?: string;
  imports?: string[];
  exports?: string[];
  uses_tables?: string[];
  rpc_calls?: string[];
  fetch_urls?: string[];
};

const COL_W = 420;
const ROW_H = 26;
const ROWS_PER_STRIP = 52;

function stripPos(n: number, col: number): { x: number; y: number } {
  const strip = Math.floor(n / ROWS_PER_STRIP);
  return {
    x: col * COL_W + strip * 36,
    y: (n % ROWS_PER_STRIP) * ROW_H,
  };
}

function rid(kind: string, key: string): string {
  return `${kind}:${key}`;
}

function normApiPath(p: string): string {
  const s = p.split("?")[0].trim();
  if (!s) return "";
  if (s.startsWith("http")) {
    try {
      const u = new URL(s);
      return u.pathname || "";
    } catch {
      return "";
    }
  }
  return s.startsWith("/") ? s : `/${s}`;
}

function stepToNodeId(step: string): string | null {
  const t = step.trim();
  if (!t) return null;
  if (t.startsWith("/api/")) return rid("api", t);
  if (t.startsWith("/")) return rid("route", t);
  if (/^[a-z_][a-z0-9_]*$/i.test(t)) return rid("table", t);
  return null;
}

export function buildSystemGraph(input: {
  routes: { routes: RouteRow[] };
  apiMap: { endpoints: EndpointRow[] };
  dbMap: { tables: Record<string, { used_in: string[] }> };
  flows: { flows: Array<{ name: string; steps: string[] }> };
  repoMap: { files: RepoFile[] };
  deps: { graph: Record<string, string[]> };
}): SystemGraphPayload {
  const filesByPath = new Map<string, RepoFile>();
  for (const f of input.repoMap.files) {
    filesByPath.set(f.path.replace(/\\/g, "/"), f);
  }

  const detailsById: Record<string, NodeDetail> = {};
  const edgeKey = new Set<string>();
  const edges: SystemGraphRfEdge[] = [];

  const pushEdge = (
    source: string,
    target: string,
    opts: { flow?: boolean; label?: string }
  ) => {
    const k = `${source}→${target}`;
    if (edgeKey.has(k)) return;
    edgeKey.add(k);
    edges.push({
      id: `e_${source.replace(/[^a-zA-Z0-9]/g, "_")}_${target.replace(/[^a-zA-Z0-9]/g, "_")}_${edges.length}`,
      source,
      target,
      animated: opts.flow,
      label: opts.label,
      style: opts.flow
        ? { stroke: "#ca8a04", strokeWidth: 3 }
        : { stroke: "#cbd5e1", strokeWidth: 1 },
      markerEnd: { type: MARKER_ARROW_CLOSED, color: opts.flow ? "#ca8a04" : "#94a3b8" },
    });
  };

  const routeNodes: SystemGraphRfNode[] = [];
  const apiNodes: SystemGraphRfNode[] = [];
  const tableNodes: SystemGraphRfNode[] = [];
  const libNodes: SystemGraphRfNode[] = [];

  let ri = 0;
  let ai = 0;
  let ti = 0;
  let li = 0;

  for (const r of input.routes.routes) {
    const id = rid("route", r.url_path);
    const pos = stripPos(ri++, 0);
    routeNodes.push({
      id,
      type: "system",
      position: pos,
      data: { label: r.url_path, kind: "route" as NodeKind },
    });
    detailsById[id] = {
      id,
      kind: "route",
      label: r.url_path,
      file: r.file,
      fetch_urls: r.fetch_urls,
      uses_tables: r.uses_tables,
      imports: filesByPath.get(r.file)?.imports,
    };
    for (const fu of r.fetch_urls) {
      const api = normApiPath(fu);
      if (api.startsWith("/api/")) {
        const tid = rid("api", api);
        pushEdge(id, tid, {});
      }
    }
  }

  for (const e of input.apiMap.endpoints) {
    const id = rid("api", e.route);
    const pos = stripPos(ai++, 1);
    apiNodes.push({
      id,
      type: "system",
      position: pos,
      data: { label: e.route, kind: "api" as NodeKind },
    });
    detailsById[id] = {
      id,
      kind: "api",
      label: e.route,
      file: e.file,
      uses_tables: e.uses_tables,
      rpc_calls: e.rpc_calls,
      imports: filesByPath.get(e.file)?.imports,
    };
    for (const t of e.uses_tables) {
      const tid = rid("table", t);
      pushEdge(id, tid, {});
    }
  }

  for (const tableName of Object.keys(input.dbMap.tables)) {
    const id = rid("table", tableName);
    const pos = stripPos(ti++, 2);
    tableNodes.push({
      id,
      type: "system",
      position: pos,
      data: { label: tableName, kind: "table" as NodeKind },
    });
    detailsById[id] = {
      id,
      kind: "table",
      label: tableName,
      used_in_files: input.dbMap.tables[tableName]?.used_in,
    };
  }

  const libPaths = new Set<string>();
  for (const r of input.routes.routes) {
    const outs = input.deps.graph[r.file];
    if (!outs) continue;
    for (const to of outs) {
      const p = to.replace(/\\/g, "/");
      if (p.startsWith("lib/") || p.startsWith("components/")) libPaths.add(p);
    }
  }
  for (const e of input.apiMap.endpoints) {
    const outs = input.deps.graph[e.file];
    if (!outs) continue;
    for (const to of outs) {
      const p = to.replace(/\\/g, "/");
      if (p.startsWith("lib/") || p.startsWith("components/")) libPaths.add(p);
    }
  }

  const libSorted = [...libPaths].sort();
  const libCap = 900;
  for (let i = 0; i < Math.min(libSorted.length, libCap); i++) {
    const p = libSorted[i];
    const id = rid("lib", p);
    const pos = stripPos(li++, 3);
    libNodes.push({
      id,
      type: "system",
      position: pos,
      data: { label: p.replace(/^(lib|components)\//, ""), kind: "lib" as NodeKind },
    });
    const rf = filesByPath.get(p);
    detailsById[id] = {
      id,
      kind: "lib",
      label: p,
      file: p,
      uses_tables: rf?.uses_tables,
      rpc_calls: rf?.rpc_calls,
      imports: rf?.imports,
      dependencies_out: input.deps.graph[p],
    };
  }

  for (const r of input.routes.routes) {
    const outs = input.deps.graph[r.file];
    if (!outs) continue;
    const src = rid("route", r.url_path);
    for (const to of outs) {
      const p = to.replace(/\\/g, "/");
      if (!libPaths.has(p)) continue;
      if (!detailsById[rid("lib", p)]) continue;
      pushEdge(src, rid("lib", p), { label: "import" });
    }
  }

  for (const e of input.apiMap.endpoints) {
    const outs = input.deps.graph[e.file];
    if (!outs) continue;
    const src = rid("api", e.route);
    for (const to of outs) {
      const p = to.replace(/\\/g, "/");
      if (!libPaths.has(p)) continue;
      if (!detailsById[rid("lib", p)]) continue;
      pushEdge(src, rid("lib", p), { label: "import" });
    }
  }

  const flowEdgeIds: string[] = [];
  const flowNodeIdSet = new Set<string>();
  const flowPairs: { a: string; b: string }[] = [];
  for (const flow of input.flows.flows) {
    const steps = flow.steps;
    for (const s of steps) {
      const id = stepToNodeId(s);
      if (id && detailsById[id]) flowNodeIdSet.add(id);
    }
    for (let i = 0; i < steps.length - 1; i++) {
      const a = stepToNodeId(steps[i]);
      const b = stepToNodeId(steps[i + 1]);
      if (!a || !b || !detailsById[a] || !detailsById[b]) continue;
      flowPairs.push({ a, b });
    }
  }
  const seenFlowPair = new Set<string>();
  for (const { a, b } of flowPairs) {
    const k = `${a}→${b}`;
    if (seenFlowPair.has(k)) continue;
    seenFlowPair.add(k);
    const existing = edges.find((e) => e.source === a && e.target === b);
    if (existing) {
      existing.style = { stroke: "#ca8a04", strokeWidth: 3 };
      existing.animated = true;
      existing.markerEnd = { type: MARKER_ARROW_CLOSED, color: "#ca8a04" };
      flowEdgeIds.push(existing.id);
    } else if (!edgeKey.has(k)) {
      edgeKey.add(k);
      const edge: SystemGraphRfEdge = {
        id: `flow_${a.replace(/[^a-zA-Z0-9]/g, "_")}_${b.replace(/[^a-zA-Z0-9]/g, "_")}_${edges.length}`,
        source: a,
        target: b,
        animated: true,
        style: { stroke: "#ca8a04", strokeWidth: 3 },
        markerEnd: { type: MARKER_ARROW_CLOSED, color: "#ca8a04" },
      };
      edges.push(edge);
      flowEdgeIds.push(edge.id);
    }
  }

  const nodes: SystemGraphRfNode[] = [...routeNodes, ...apiNodes, ...tableNodes, ...libNodes];

  return {
    nodes,
    edges,
    flowEdgeIds,
    flowNodeIds: [...flowNodeIdSet].sort(),
    detailsById,
    stats: {
      routes: routeNodes.length,
      apis: apiNodes.length,
      tables: tableNodes.length,
      libs: libNodes.length,
      edges: edges.length,
      flowSteps: input.flows.flows.reduce((s, f) => s + f.steps.length, 0),
    },
  };
}
