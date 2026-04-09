import type { AiBlock, AiPage } from "@/lib/ai/pageBuilderTypes";
import { AI_PAGE_KNOWN_BLOCK_TYPES } from "@/lib/ai/pageBuilderTypes";

const KNOWN = new Set<string>(AI_PAGE_KNOWN_BLOCK_TYPES);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Validates AI page JSON before normalizeLayoutBlocks.
 * Rejects unknown types, missing data objects, and missing required fields per type.
 */
export function validateAiPage(raw: unknown): { ok: true; page: AiPage } | { ok: false; error: string } {
  if (!isPlainObject(raw)) {
    return { ok: false, error: "Ugyldig rot: forventet JSON-objekt." };
  }

  const titleRaw = raw.title;
  const title =
    typeof titleRaw === "string" ? titleRaw.trim().slice(0, 200) : "";

  if (!Array.isArray(raw.blocks)) {
    return { ok: false, error: "Feltet blocks mangler eller er ikke en liste." };
  }

  if (raw.blocks.length === 0) {
    return { ok: false, error: "Ingen blokker i svaret." };
  }

  if (raw.blocks.length > 24) {
    return { ok: false, error: "For mange blokker (maks 24)." };
  }

  const blocks: AiBlock[] = [];

  for (let i = 0; i < raw.blocks.length; i++) {
    const item = raw.blocks[i];
    if (!isPlainObject(item)) {
      return { ok: false, error: `Blokk ${i + 1}: ugyldig form.` };
    }

    const type = str(item.type).trim();
    if (!type) {
      return { ok: false, error: `Blokk ${i + 1}: mangler type.` };
    }
    if (!KNOWN.has(type)) {
      return { ok: false, error: `Ukjent blokktype: «${type}».` };
    }

    if (!isPlainObject(item.data)) {
      return { ok: false, error: `Blokk ${i + 1} (${type}): feltet data mangler eller er ikke et objekt.` };
    }

    const data = item.data;

    if (type === "hero") {
      if (!str(data.title).trim()) {
        return { ok: false, error: `Blokk ${i + 1} (hero): title er påkrevd.` };
      }
    }

    if (type === "richText" || type === "text") {
      const body = str(data.body) || str(data.text);
      if (!body.trim()) {
        return { ok: false, error: `Blokk ${i + 1} (richText): body er påkrevd.` };
      }
    }

    if (type === "image") {
      const path = (str(data.assetPath) || str(data.url)).trim();
      if (!path) {
        return { ok: false, error: `Blokk ${i + 1} (image): assetPath er påkrevd.` };
      }
    }

    if (type === "cta") {
      if (!str(data.title).trim()) {
        return { ok: false, error: `Blokk ${i + 1} (cta): title er påkrevd.` };
      }
      if (!str(data.buttonLabel).trim()) {
        return { ok: false, error: `Blokk ${i + 1} (cta): buttonLabel er påkrevd.` };
      }
      if (!str(data.buttonHref).trim()) {
        return { ok: false, error: `Blokk ${i + 1} (cta): buttonHref er påkrevd.` };
      }
    }

    blocks.push({ type, data });
  }

  return { ok: true, page: { title: title || "Ny side", blocks } };
}
