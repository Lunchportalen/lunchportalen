/**
 * Knowledge graph builder: extract topic words from pages and insert entities + relations.
 */

export async function buildKnowledgeGraph(args: {
  pages: Array<{ id: string; title?: string; blocks?: unknown[] }>;
  supabase: unknown;
}): Promise<void> {
  const { pages, supabase } = args;
  const seenEntities = new Set();
  const entityRows = [];
  const relationRows = [];
  for (const page of pages) {
    const pageId = page.id;
    const title = (typeof page.title === "string" ? page.title : "") + "";
    const words = new Set();
    title.split(/\s+/).forEach((w) => {
      const cleaned = w.replace(/\W/g, "").toLowerCase();
      if (cleaned.length >= 3) words.add(cleaned);
    });
    const blocks = Array.isArray(page.blocks) ? page.blocks : [];
    for (const b of blocks) {
      const block = (b && typeof b === "object" && !Array.isArray(b) ? b : {}) as { data?: { body?: string } };
      const body = block.data && typeof block.data === "object" ? block.data.body : undefined;
      if (typeof body === "string") {
        body.split(/\s+/).forEach((w) => {
          const cleaned = w.replace(/\W/g, "").toLowerCase();
          if (cleaned.length >= 3) words.add(cleaned);
        });
      }
    }
    for (const word of words) {
      if (!seenEntities.has(word)) {
        seenEntities.add(word);
        entityRows.push({ name: word, type: "topic" });
      }
      relationRows.push({ from_entity: pageId, to_entity: word, relation: "mentions" });
    }
    if (title.trim().length >= 3) {
      const titleKey = title.trim().toLowerCase();
      if (!seenEntities.has(titleKey)) {
        seenEntities.add(titleKey);
        entityRows.push({ name: titleKey, type: "topic" });
      }
      relationRows.push({ from_entity: pageId, to_entity: titleKey, relation: "part_of" });
    }
  }
  const db = supabase as { from: (t: string) => { insert: (rows: unknown) => Promise<unknown> } };
  if (entityRows.length > 0) await db.from("entities").insert(entityRows);
  if (relationRows.length > 0) await db.from("entity_relations").insert(relationRows);
}
