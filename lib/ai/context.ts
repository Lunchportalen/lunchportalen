import "server-only";

export type CopilotBlockRef = {
  id: string;
  type: string;
  /** Shallow summary for debugging / future prompts */
  preview?: string;
};

export type CopilotFullPageInput = {
  title?: string;
  blocks: unknown[];
};

export type CopilotBuiltContext = {
  currentBlock: CopilotBlockRef | null;
  surroundingBlocks: CopilotBlockRef[];
  pageIntent: string;
  /** Index of focused block in full `blocks` array, or -1 */
  focusIndex: number;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function blockPreview(b: Record<string, unknown>): string {
  const type = String(b.type ?? "");
  const parts: string[] = [type];
  for (const k of ["title", "heading", "body", "subtitle"]) {
    const raw = b[k];
    if (typeof raw === "string" && raw.trim()) {
      parts.push(raw.trim().slice(0, 80));
      break;
    }
  }
  return parts.join(" · ");
}

function toRef(raw: unknown): CopilotBlockRef | null {
  if (!isPlainObject(raw)) return null;
  const id = String(raw.id ?? "").trim();
  const type = String(raw.type ?? "").trim();
  if (!id || !type) return null;
  return { id, type, preview: blockPreview(raw) };
}

function inferPageIntent(title: string, blocks: unknown[]): string {
  const t = title.trim();
  if (t) return t.slice(0, 200);
  for (const raw of blocks.slice(0, 4)) {
    if (!isPlainObject(raw)) continue;
    const h = typeof raw.heading === "string" ? raw.heading : typeof raw.title === "string" ? raw.title : "";
    if (h.trim()) return h.trim().slice(0, 200);
  }
  return "Uten definert sidetittel — fyll inn tittel for bedre SEO-kontekst.";
}

/**
 * Local awareness for copilot: focused block, neighbours, page intent string.
 */
export function buildContext(focusBlockId: string | null | undefined, fullPage: CopilotFullPageInput): CopilotBuiltContext {
  const blocks = Array.isArray(fullPage.blocks) ? fullPage.blocks : [];
  const title = typeof fullPage.title === "string" ? fullPage.title : "";
  const idx = focusBlockId ? blocks.findIndex((b) => isPlainObject(b) && String((b as { id?: string }).id) === focusBlockId) : -1;

  const currentBlock = idx >= 0 ? toRef(blocks[idx]) : null;
  const surroundingBlocks: CopilotBlockRef[] = [];
  if (idx >= 0) {
    if (idx > 0) {
      const p = toRef(blocks[idx - 1]);
      if (p) surroundingBlocks.push(p);
    }
    if (idx < blocks.length - 1) {
      const n = toRef(blocks[idx + 1]);
      if (n) surroundingBlocks.push(n);
    }
  }

  return {
    currentBlock,
    surroundingBlocks,
    pageIntent: inferPageIntent(title, blocks),
    focusIndex: idx,
  };
}

/**
 * Narrow block list around focus for fast heuristic analyzers (still deterministic).
 */
export function sliceBlocksForFocus(fullPage: CopilotFullPageInput, focusIndex: number, radius = 1): unknown[] {
  const blocks = Array.isArray(fullPage.blocks) ? fullPage.blocks : [];
  if (focusIndex < 0) return blocks;
  const start = Math.max(0, focusIndex - radius);
  const end = Math.min(blocks.length, focusIndex + radius + 1);
  return blocks.slice(start, end);
}
