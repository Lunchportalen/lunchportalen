/**
 * Semantisk kart over hele nettstedet.
 * Kobler: sider, produkter, topics, keywords, interne lenker.
 * Bygges fra input (ingen direkte DB-kall); kallere henter data og sender inn.
 */

export type KnowledgeNodeType = "page" | "product" | "topic" | "keyword";

export type KnowledgeGraphNode = {
  id: string;
  type: KnowledgeNodeType;
  /** Lesbar label (tittel, navn). */
  label: string;
  /** For sider: slug (path). */
  slug?: string;
  /** Ekstra felter (f.eks. title, primaryKeyword). */
  payload?: Record<string, unknown>;
};

export type KnowledgeRelation =
  | "internal_link"
  | "has_topic"
  | "has_keyword"
  | "parent"
  | "targets";

export type KnowledgeGraphEdge = {
  sourceId: string;
  targetId: string;
  relation: KnowledgeRelation;
  /** Valgfri vekt eller metadata. */
  payload?: Record<string, unknown>;
};

export type SiteKnowledgeGraph = {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
};

/** Input: én side for å bygge noder/kanter. */
export type PageInput = {
  id: string;
  slug?: string | null;
  title?: string | null;
  /** primaryKeyword, secondaryKeywords, contentGoals fra meta.intent. */
  primaryKeyword?: string | null;
  secondaryKeywords?: string[] | null;
  topics?: string[] | null;
  /** UUID av forelder i tre (content_pages.tree_parent_id). */
  parentId?: string | null;
};

/** Input: produkt (f.eks. tjeneste, pakke). */
export type ProductInput = {
  id: string;
  name: string;
  slug?: string | null;
  topics?: string[] | null;
  keywords?: string[] | null;
};

/** Input: én intern lenke (fra side A til side B). */
export type InternalLinkInput = {
  fromPageId: string;
  toPageId: string;
  /** Kontekst: f.eks. "cta", "nav", "body". */
  context?: string | null;
};

export type BuildKnowledgeGraphInput = {
  pages?: PageInput[];
  products?: ProductInput[];
  /** Unike topic-navn (bygges som noder). */
  topics?: string[];
  /** Unike keyword-navn (bygges som noder). */
  keywords?: string[];
  /** Interne lenker mellom sider. */
  internalLinks?: InternalLinkInput[];
};

function nodeId(type: KnowledgeNodeType, key: string): string {
  return `${type}:${key}`;
}

function ensureNode(
  nodes: Map<string, KnowledgeGraphNode>,
  type: KnowledgeNodeType,
  id: string,
  label: string,
  extra?: { slug?: string; payload?: Record<string, unknown> }
): void {
  const key = type === "page" || type === "product" ? id : nodeId(type, id);
  if (nodes.has(key)) return;
  nodes.set(key, {
    id: key,
    type,
    label,
    ...(extra?.slug !== undefined && { slug: extra.slug }),
    ...(extra?.payload && { payload: extra.payload }),
  });
}

function ensureEdge(
  edges: KnowledgeGraphEdge[],
  sourceId: string,
  targetId: string,
  relation: KnowledgeRelation,
  payload?: Record<string, unknown>
): void {
  const exists = edges.some(
    (e) => e.sourceId === sourceId && e.targetId === targetId && e.relation === relation
  );
  if (!exists) {
    edges.push({ sourceId, targetId, relation, ...(payload && Object.keys(payload).length > 0 && { payload }) });
  }
}

/**
 * Bygger semantisk kart fra sider, produkter, topics, keywords og interne lenker.
 * Ingen eksterne kall; alt kommer fra input.
 */
export function buildSiteKnowledgeGraph(input: BuildKnowledgeGraphInput): SiteKnowledgeGraph {
  const nodes = new Map<string, KnowledgeGraphNode>();
  const edges: KnowledgeGraphEdge[] = [];

  const pages = Array.isArray(input.pages) ? input.pages : [];
  const products = Array.isArray(input.products) ? input.products : [];
  const topicSet = new Set<string>(Array.isArray(input.topics) ? input.topics : []);
  const keywordSet = new Set<string>(Array.isArray(input.keywords) ? input.keywords : []);
  const internalLinks = Array.isArray(input.internalLinks) ? input.internalLinks : [];

  // Utvid topics/keywords fra sider og produkter
  for (const p of pages) {
    if (p.primaryKeyword) keywordSet.add(p.primaryKeyword.trim());
    if (Array.isArray(p.secondaryKeywords)) p.secondaryKeywords.forEach((k) => keywordSet.add(String(k).trim()));
    if (Array.isArray(p.topics)) p.topics.forEach((t) => topicSet.add(String(t).trim()));
  }
  for (const p of products) {
    if (Array.isArray(p.topics)) p.topics.forEach((t) => topicSet.add(String(t).trim()));
    if (Array.isArray(p.keywords)) p.keywords.forEach((k) => keywordSet.add(String(k).trim()));
  }

  // Noder: topics og keywords
  for (const t of topicSet) {
    if (!t) continue;
    ensureNode(nodes, "topic", t, t);
  }
  for (const k of keywordSet) {
    if (!k) continue;
    ensureNode(nodes, "keyword", k, k);
  }

  // Noder og kanter: sider
  for (const p of pages) {
    const pageNodeId = nodeId("page", p.id);
    ensureNode(nodes, "page", p.id, p.title?.trim() || p.slug || p.id, {
      slug: p.slug ?? undefined,
      payload: {
        title: p.title,
        primaryKeyword: p.primaryKeyword,
      },
    });

    if (p.parentId) {
      const parentNodeId = nodeId("page", p.parentId);
      ensureNode(nodes, "page", p.parentId, p.parentId); // forelder kan mangle i liste; legg til minimal node
      ensureEdge(edges, pageNodeId, parentNodeId, "parent");
    }

    const primary = p.primaryKeyword?.trim();
    if (primary) {
      ensureNode(nodes, "keyword", primary, primary);
      ensureEdge(edges, pageNodeId, nodeId("keyword", primary), "has_keyword", { role: "primary" });
    }
    if (Array.isArray(p.secondaryKeywords)) {
      for (const k of p.secondaryKeywords) {
        const kw = String(k).trim();
        if (!kw) continue;
        ensureNode(nodes, "keyword", kw, kw);
        ensureEdge(edges, pageNodeId, nodeId("keyword", kw), "has_keyword", { role: "secondary" });
      }
    }
    if (Array.isArray(p.topics)) {
      for (const t of p.topics) {
        const topic = String(t).trim();
        if (!topic) continue;
        ensureNode(nodes, "topic", topic, topic);
        ensureEdge(edges, pageNodeId, nodeId("topic", topic), "has_topic");
      }
    }
  }

  // Noder og kanter: produkter
  for (const p of products) {
    const productNodeId = nodeId("product", p.id);
    ensureNode(nodes, "product", p.id, p.name, {
      slug: p.slug ?? undefined,
      payload: { name: p.name },
    });
    if (Array.isArray(p.topics)) {
      for (const t of p.topics) {
        const topic = String(t).trim();
        if (!topic) continue;
        ensureNode(nodes, "topic", topic, topic);
        ensureEdge(edges, productNodeId, nodeId("topic", topic), "has_topic");
      }
    }
    if (Array.isArray(p.keywords)) {
      for (const k of p.keywords) {
        const kw = String(k).trim();
        if (!kw) continue;
        ensureNode(nodes, "keyword", kw, kw);
        ensureEdge(edges, productNodeId, nodeId("keyword", kw), "has_keyword");
      }
    }
  }

  // Interne lenker (sider må allerede være noder)
  for (const link of internalLinks) {
    const fromId = nodeId("page", link.fromPageId);
    const toId = nodeId("page", link.toPageId);
    if (!nodes.has(fromId)) continue;
    if (!nodes.has(toId)) {
      ensureNode(nodes, "page", link.toPageId, link.toPageId);
    }
    ensureEdge(edges, fromId, toId, "internal_link", link.context ? { context: link.context } : undefined);
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
  };
}

/** Henter alle noder av gitt type. */
export function getNodesByType(graph: SiteKnowledgeGraph, type: KnowledgeNodeType): KnowledgeGraphNode[] {
  return graph.nodes.filter((n) => n.type === type);
}

/** Henter alle sider fra grafen. */
export function getPages(graph: SiteKnowledgeGraph): KnowledgeGraphNode[] {
  return getNodesByType(graph, "page");
}

/** Henter alle produkter fra grafen. */
export function getProducts(graph: SiteKnowledgeGraph): KnowledgeGraphNode[] {
  return getNodesByType(graph, "product");
}

/** Henter alle topics fra grafen. */
export function getTopics(graph: SiteKnowledgeGraph): KnowledgeGraphNode[] {
  return getNodesByType(graph, "topic");
}

/** Henter alle keywords fra grafen. */
export function getKeywords(graph: SiteKnowledgeGraph): KnowledgeGraphNode[] {
  return getNodesByType(graph, "keyword");
}

/** Henter alle kanter med relation internal_link. */
export function getInternalLinkEdges(graph: SiteKnowledgeGraph): KnowledgeGraphEdge[] {
  return graph.edges.filter((e) => e.relation === "internal_link");
}

/** Henter interne lenker fra en gitt side (sourceId = page node id). */
export function getInternalLinksFrom(
  graph: SiteKnowledgeGraph,
  pageNodeId: string
): KnowledgeGraphEdge[] {
  return graph.edges.filter(
    (e) => e.relation === "internal_link" && e.sourceId === pageNodeId
  );
}

/** Henter naboer til en node (valgfritt filtrert på relation). */
export function getNeighbors(
  graph: SiteKnowledgeGraph,
  nodeId: string,
  relation?: KnowledgeRelation
): KnowledgeGraphEdge[] {
  return graph.edges.filter(
    (e) =>
      (e.sourceId === nodeId || e.targetId === nodeId) &&
      (relation === undefined || e.relation === relation)
  );
}

/** Finner node etter id (page/product id eller "type:key"). */
export function getNodeById(graph: SiteKnowledgeGraph, id: string): KnowledgeGraphNode | undefined {
  const direct = graph.nodes.find((n) => n.id === id);
  if (direct) return direct;
  const pageId = id.startsWith("page:") ? id : `page:${id}`;
  return graph.nodes.find((n) => n.id === pageId);
}
