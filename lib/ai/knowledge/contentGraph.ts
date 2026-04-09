// STATUS: KEEP

/**
 * Semantic content graph: nodes for pages, topics, and keywords; edges for relationships.
 * In-memory structure for querying and feeding into AI capabilities (internal links, gap detection, etc.).
 */

export type NodeType = "page" | "topic" | "keyword";

export type PageNode = {
  type: "page";
  id: string;
  path: string;
  title: string;
  /** Optional excerpt or short description. */
  excerpt?: string | null;
  /** Optional keywords extracted or assigned to this page. */
  keywords?: string[] | null;
};

export type TopicNode = {
  type: "topic";
  id: string;
  name: string;
  /** Optional parent topic id for hierarchy. */
  parentId?: string | null;
};

export type KeywordNode = {
  type: "keyword";
  id: string;
  term: string;
};

export type ContentGraphNode = PageNode | TopicNode | KeywordNode;

export type EdgeType =
  | "page_has_topic"
  | "page_has_keyword"
  | "topic_has_keyword"
  | "topic_parent_of"
  | "page_links_to";

export type ContentGraphEdge = {
  fromId: string;
  toId: string;
  relation: EdgeType;
  /** Optional weight or strength (e.g. 0–1). */
  weight?: number | null;
};

export type ContentGraphData = {
  nodes: ContentGraphNode[];
  edges: ContentGraphEdge[];
};

const EMPTY_GRAPH: ContentGraphData = { nodes: [], edges: [] };

function nodeId(type: NodeType, key: string): string {
  const k = (key ?? "").trim().toLowerCase();
  return k ? `${type}:${k}` : "";
}

function normalizeTerm(term: string): string {
  return (term ?? "").trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * Semantic content graph: pages, topics, keywords as nodes; typed edges.
 * Mutable in-memory graph with add/remove and query helpers.
 */
export class ContentGraph {
  private nodes = new Map<string, ContentGraphNode>();
  private edges: ContentGraphEdge[] = [];
  private outEdges = new Map<string, ContentGraphEdge[]>();
  private inEdges = new Map<string, ContentGraphEdge[]>();

  /** Build from serialized data (e.g. after load). */
  static fromData(data: ContentGraphData): ContentGraph {
    const g = new ContentGraph();
    for (const n of data.nodes ?? []) g.addNode(n);
    for (const e of data.edges ?? []) g.addEdge(e);
    return g;
  }

  /** Serialize to plain data for storage or transfer. */
  toData(): ContentGraphData {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: [...this.edges],
    };
  }

  addNode(node: ContentGraphNode): void {
    const id = this.getNodeId(node);
    if (!id) return;
    this.nodes.set(id, { ...node });
  }

  removeNode(id: string): void {
    this.nodes.delete(id);
    this.edges = this.edges.filter((e) => e.fromId !== id && e.toId !== id);
    this.outEdges.delete(id);
    this.inEdges.delete(id);
    this.rebuildEdgeIndex();
  }

  private getNodeId(node: ContentGraphNode): string {
    if (node.type === "page") return (node as PageNode).id ? `page:${(node as PageNode).id}` : "";
    if (node.type === "topic") return nodeId("topic", (node as TopicNode).name);
    if (node.type === "keyword") return nodeId("keyword", (node as KeywordNode).term);
    return "";
  }

  addEdge(edge: ContentGraphEdge): void {
    if (!edge.fromId || !edge.toId) return;
    this.edges.push({ ...edge });
    this.rebuildEdgeIndex();
  }

  private rebuildEdgeIndex(): void {
    this.outEdges.clear();
    this.inEdges.clear();
    for (const e of this.edges) {
      const out = this.outEdges.get(e.fromId) ?? [];
      out.push(e);
      this.outEdges.set(e.fromId, out);
      const inE = this.inEdges.get(e.toId) ?? [];
      inE.push(e);
      this.inEdges.set(e.toId, inE);
    }
  }

  getNode(id: string): ContentGraphNode | undefined {
    return this.nodes.get(id);
  }

  getPage(id: string): PageNode | undefined {
    const n = this.nodes.get(id);
    return n?.type === "page" ? (n as PageNode) : undefined;
  }

  getTopic(id: string): TopicNode | undefined {
    const n = this.nodes.get(id);
    return n?.type === "topic" ? (n as TopicNode) : undefined;
  }

  getKeyword(id: string): KeywordNode | undefined {
    const n = this.nodes.get(id);
    return n?.type === "keyword" ? (n as KeywordNode) : undefined;
  }

  /** All nodes of a given type. */
  getNodesByType(type: NodeType): ContentGraphNode[] {
    return Array.from(this.nodes.values()).filter((n) => n.type === type);
  }

  /** All page nodes. */
  getPages(): PageNode[] {
    return this.getNodesByType("page") as PageNode[];
  }

  /** All topic nodes. */
  getTopics(): TopicNode[] {
    return this.getNodesByType("topic") as TopicNode[];
  }

  /** All keyword nodes. */
  getKeywords(): KeywordNode[] {
    return this.getNodesByType("keyword") as KeywordNode[];
  }

  /** Edges from a node (outgoing). */
  getOutEdges(nodeId: string): ContentGraphEdge[] {
    return this.outEdges.get(nodeId) ?? [];
  }

  /** Edges into a node (incoming). */
  getInEdges(nodeId: string): ContentGraphEdge[] {
    return this.inEdges.get(nodeId) ?? [];
  }

  /** Neighbor node ids reachable by following outgoing edges. */
  getOutNeighbors(nodeId: string): string[] {
    return [...new Set(this.getOutEdges(nodeId).map((e) => e.toId))];
  }

  /** Neighbor node ids that have edges into this node. */
  getInNeighbors(nodeId: string): string[] {
    return [...new Set(this.getInEdges(nodeId).map((e) => e.fromId))];
  }

  /** Add a page and optionally link to topics/keywords. */
  addPage(page: Omit<PageNode, "type">): void {
    const id = page.id ? `page:${page.id}` : nodeId("page", page.path || page.title);
    this.addNode({ type: "page", ...page, id: page.id ?? id.replace(/^page:/, "") });
  }

  /** Add a topic node. */
  addTopic(name: string, parentId?: string | null): TopicNode {
    const id = nodeId("topic", name);
    const node: TopicNode = { type: "topic", id, name: (name ?? "").trim() };
    if (parentId) node.parentId = parentId;
    this.addNode(node);
    if (parentId) this.addEdge({ fromId: parentId, toId: id, relation: "topic_parent_of" });
    return node;
  }

  /** Add a keyword node. */
  addKeyword(term: string): KeywordNode {
    const normalized = normalizeTerm(term);
    const id = nodeId("keyword", normalized);
    const node: KeywordNode = { type: "keyword", id, term: normalized };
    this.addNode(node);
    return node;
  }

  /** Link page to topic (page_has_topic). */
  linkPageToTopic(pageId: string, topicId: string, weight?: number): void {
    const from = pageId.startsWith("page:") ? pageId : `page:${pageId}`;
    this.addEdge({ fromId: from, toId: topicId, relation: "page_has_topic", weight });
  }

  /** Link page to keyword (page_has_keyword). */
  linkPageToKeyword(pageId: string, keywordId: string, weight?: number): void {
    const from = pageId.startsWith("page:") ? pageId : `page:${pageId}`;
    this.addEdge({ fromId: from, toId: keywordId, relation: "page_has_keyword", weight });
  }

  /** Link topic to keyword (topic_has_keyword). */
  linkTopicToKeyword(topicId: string, keywordId: string, weight?: number): void {
    this.addEdge({ fromId: topicId, toId: keywordId, relation: "topic_has_keyword", weight });
  }

  /** Add or get topic by name; returns topic node id. */
  ensureTopic(name: string): string {
    const id = nodeId("topic", name);
    if (!this.nodes.has(id)) this.addTopic(name);
    return id;
  }

  /** Add or get keyword by term; returns keyword node id. */
  ensureKeyword(term: string): string {
    const normalized = normalizeTerm(term);
    const id = nodeId("keyword", normalized);
    if (!this.nodes.has(id)) this.addKeyword(normalized);
    return id;
  }

  /** Convert graph to a flat content-graph shape for capabilities (e.g. detectMissingPages, generateInternalLinks). */
  toContentGraphNodes(): Array<{ path: string; title: string; keywords?: string[]; excerpt?: string }> {
    return this.getPages().map((p) => ({
      path: p.path ?? "",
      title: p.title ?? "",
      ...(p.keywords?.length ? { keywords: p.keywords } : {}),
      ...(p.excerpt ? { excerpt: p.excerpt } : {}),
    }));
  }

  nodeCount(): number {
    return this.nodes.size;
  }

  edgeCount(): number {
    return this.edges.length;
  }
}

/** Create an empty content graph. */
export function createContentGraph(): ContentGraph {
  return new ContentGraph();
}
