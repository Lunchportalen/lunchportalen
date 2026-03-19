/**
 * Block list validation – single source of truth for editor block validation.
 * Used by useBlockValidation and save/preview gates.
 * Uses media metadata limits so oversized alt/caption are surfaced (same as API).
 */

import type { BlockList } from "@/lib/cms/model/blockTypes";
import { MEDIA_ALT_MAX, MEDIA_CAPTION_MAX } from "@/lib/media/validation";

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : String(v ?? "").trim();
}

type ValidatableNode = {
  id: string;
  type: string;
  data: Record<string, unknown>;
};

function normalizeModelToNodes(model: BlockList | unknown[] | null): ValidatableNode[] {
  if (!model) return [];

  if (Array.isArray(model)) {
    return model
      .map((raw) => {
        if (!raw || typeof raw !== "object") return null;
        const node = raw as { id?: unknown; type?: unknown; data?: unknown };
        const id = safeStr(node.id || "");
        const type = safeStr(node.type || "");
        const data =
          node.data && typeof node.data === "object" && !Array.isArray(node.data)
            ? (node.data as Record<string, unknown>)
            : {};
        if (!id || !type) return null;
        return { id, type, data: data as Record<string, unknown> };
      })
      .filter((n): n is ValidatableNode => n !== null);
  }

  const list = model as BlockList;
  if (!Array.isArray(list.blocks)) return [];
  return (list.blocks as { id?: unknown; type?: unknown; data?: unknown }[]).map((b) => ({
    id: safeStr(b.id || ""),
    type: safeStr(b.type || ""),
    data: (b.data ?? {}) as Record<string, unknown>,
  }));
}

export type ValidationResult = {
  byId: Record<string, string[]>;
  total: number;
  firstId: string | null;
};

export function validateModel(model: BlockList | unknown[] | null): ValidationResult {
  const nodes = normalizeModelToNodes(model);
  const byId: Record<string, string[]> = {};
  let total = 0;
  let firstId: string | null = null;

  const registerError = (id: string, message: string) => {
    if (!byId[id]) byId[id] = [];
    byId[id].push(message);
    total += 1;
    if (!firstId) firstId = id;
  };

  for (const node of nodes) {
    const id = node.id || "unknown";
    const type = node.type;
    const data = node.data ?? {};

    if (!type) {
      registerError(id, "type: Mangler blokktype.");
      continue;
    }

    if (type === "hero") {
      const title = safeStr((data as { title?: unknown }).title);
      if (!title) registerError(id, "title: Hero må ha tittel.");
      const ctaLabel = safeStr((data as { ctaLabel?: unknown }).ctaLabel);
      const ctaHref = safeStr((data as { ctaHref?: unknown }).ctaHref);
      if (ctaLabel && !ctaHref) registerError(id, "ctaHref: CTA-tekst krever lenke.");
    } else if (type === "richText") {
      const heading = safeStr((data as { heading?: unknown }).heading);
      const body = safeStr((data as { body?: unknown }).body);
      if (!heading && !body) registerError(id, "body: Rich text må ha overskrift eller brødtekst.");
    } else if (type === "image") {
      const assetPath = safeStr((data as { assetPath?: unknown }).assetPath);
      const url = safeStr((data as { url?: unknown }).url);
      const alt = safeStr((data as { alt?: unknown }).alt);
      const caption = safeStr((data as { caption?: unknown }).caption);
      if (!assetPath && !url) registerError(id, "assetPath: Bildeblokk må peke på et bilde.");
      if ((assetPath || url) && !alt)
        registerError(id, "alt: Anbefalt – fyll inn alt-tekst for tilgjengelighet (kan hentes fra mediearkiv).");
      if (alt.length > MEDIA_ALT_MAX)
        registerError(id, `alt: Maks ${MEDIA_ALT_MAX} tegn (kortes ned ved visning).`);
      if (caption.length > MEDIA_CAPTION_MAX)
        registerError(id, `caption: Maks ${MEDIA_CAPTION_MAX} tegn (kortes ned ved visning).`);
    } else if (type === "cta") {
      const title = safeStr((data as { title?: unknown }).title);
      const buttonLabel = safeStr((data as { buttonLabel?: unknown }).buttonLabel);
      const buttonHref = safeStr((data as { buttonHref?: unknown }).buttonHref);
      if (!title && !buttonLabel) registerError(id, "title: CTA må ha tittel eller knappetekst.");
      if (buttonLabel && !buttonHref) registerError(id, "buttonHref: CTA-knapp krever lenke.");
    } else if (type === "banners") {
      const items = (data as { items?: unknown }).items;
      if (!Array.isArray(items) || items.length === 0) registerError(id, "items: Bannere må ha minst ett element.");
    } else if (type === "code") {
      const code = safeStr((data as { code?: unknown }).code);
      if (!code) registerError(id, "code: Code-blokk må ha innhold.");
    }
  }

  return { byId, total, firstId };
}
