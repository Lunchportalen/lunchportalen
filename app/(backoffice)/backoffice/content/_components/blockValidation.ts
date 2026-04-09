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

    if (type === "hero" || type === "hero_full") {
      const title = safeStr((data as { title?: unknown }).title);
      if (!title) registerError(id, "title: Hero må ha tittel.");
      const ctaLabel = safeStr((data as { ctaLabel?: unknown }).ctaLabel);
      const ctaHref = safeStr((data as { ctaHref?: unknown }).ctaHref);
      if (ctaLabel && !ctaHref) registerError(id, "ctaHref: CTA-tekst krever lenke.");
      if (ctaHref && !ctaLabel) registerError(id, "ctaLabel: Lenke krever knappetekst.");
    } else if (type === "richText") {
      const heading = safeStr((data as { heading?: unknown }).heading);
      const body = safeStr((data as { body?: unknown }).body);
      if (!heading && !body) registerError(id, "body: Rich text må ha overskrift eller brødtekst.");
    } else if (type === "image") {
      const imageId = safeStr((data as { imageId?: unknown }).imageId);
      const assetPath = safeStr((data as { assetPath?: unknown }).assetPath);
      const url = safeStr((data as { url?: unknown }).url);
      const alt = safeStr((data as { alt?: unknown }).alt);
      const caption = safeStr((data as { caption?: unknown }).caption);
      if (!imageId && !assetPath && !url) registerError(id, "imageId: Bildeblokk må peke på et bilde.");
      if ((imageId || assetPath || url) && !alt)
        registerError(id, "alt: Anbefalt – fyll inn alt-tekst for tilgjengelighet (kan hentes fra mediearkiv).");
      if (alt.length > MEDIA_ALT_MAX)
        registerError(id, `alt: Maks ${MEDIA_ALT_MAX} tegn (kortes ned ved visning).`);
      if (caption.length > MEDIA_CAPTION_MAX)
        registerError(id, `caption: Maks ${MEDIA_CAPTION_MAX} tegn (kortes ned ved visning).`);
    } else if (type === "cta") {
      const title = safeStr((data as { title?: unknown }).title);
      const buttonLabel = safeStr((data as { buttonLabel?: unknown }).buttonLabel);
      const buttonHref = safeStr((data as { buttonHref?: unknown }).buttonHref);
      const secLabel = safeStr((data as { secondaryButtonLabel?: unknown }).secondaryButtonLabel);
      const secHref = safeStr((data as { secondaryButtonHref?: unknown }).secondaryButtonHref);
      if (!title) registerError(id, "title: CTA må ha overskrift.");
      if (!buttonLabel) registerError(id, "buttonLabel: Primærknapp må ha tekst.");
      if (!buttonHref) registerError(id, "buttonHref: Primærknapp må ha lenke.");
      if (secLabel && !secHref) registerError(id, "secondaryButtonHref: Sekundærknapp krever lenke.");
      if (secHref && !secLabel) registerError(id, "secondaryButtonLabel: Sekundær lenke krever tekst.");
    } else if (type === "cards") {
      const items = Array.isArray((data as { items?: unknown }).items) ? (data as { items: unknown[] }).items : [];
      if (items.length < 1) registerError(id, "items: Kort-seksjon må ha minst ett kort.");
      let filled = 0;
      for (const raw of items) {
        const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
        const t = safeStr(o.title);
        const x = safeStr(o.text);
        if (t && x) filled += 1;
      }
      if (items.length > 0 && filled < 1) {
        registerError(id, "items: Fyll ut minst ett kort med tittel og brødtekst.");
      }
    } else if (type === "zigzag") {
      const steps = Array.isArray((data as { steps?: unknown }).steps) ? (data as { steps: unknown[] }).steps : [];
      if (steps.length < 2) registerError(id, "steps: Prosess må ha minst to steg.");
      for (let i = 0; i < steps.length; i++) {
        const raw = steps[i];
        const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
        const t = safeStr(o.title);
        const x = safeStr(o.text);
        const img =
          safeStr(o.imageId) ||
          safeStr(o.mediaItemId) ||
          safeStr(o.image) ||
          safeStr(o.src);
        if (!t) registerError(id, `steps[${i}].title: Steg ${i + 1} mangler tittel.`);
        if (!x) registerError(id, `steps[${i}].text: Steg ${i + 1} mangler tekst.`);
        if (!img) registerError(id, `steps[${i}].imageId: Steg ${i + 1} mangler bilde.`);
      }
    } else if (type === "pricing") {
      const plans = Array.isArray((data as { plans?: unknown }).plans) ? (data as { plans: unknown[] }).plans : [];
      if (plans.length > 0) {
        for (let i = 0; i < plans.length; i++) {
          const raw = plans[i];
          const p = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
          const name = safeStr(p.name);
          const price = safeStr(p.price) || (typeof p.price === "number" ? String(p.price) : "");
          const cl = safeStr(p.ctaLabel);
          const ch = safeStr(p.ctaHref);
          if (!name) registerError(id, `plans[${i}].name: Pakke ${i + 1} mangler navn.`);
          if (!price) registerError(id, `plans[${i}].price: Pakke ${i + 1} mangler pris.`);
          if (cl && !ch) registerError(id, `plans[${i}].ctaHref: CTA krever lenke når etikett er satt.`);
        }
      }
    } else if (type === "grid") {
      const items = Array.isArray((data as { items?: unknown }).items) ? (data as { items: unknown[] }).items : [];
      if (items.length < 1) registerError(id, "items: Rutenett må ha minst én celle.");
      let ok = 0;
      for (const raw of items) {
        const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
        const t = safeStr(o.title);
        const img =
          safeStr(o.imageId) ||
          safeStr(o.mediaItemId) ||
          safeStr(o.image) ||
          safeStr(o.src);
        if (t && img) ok += 1;
      }
      if (ok < 1) registerError(id, "items: Minst én celle må ha tittel og bilde.");
    } else if (type === "relatedLinks") {
      const maxS = (data as { maxSuggestions?: unknown }).maxSuggestions;
      if (typeof maxS === "number" && (!Number.isFinite(maxS) || maxS < 1 || maxS > 12)) {
        registerError(id, "maxSuggestions: Må være mellom 1 og 12.");
      }
    }
  }

  return { byId, total, firstId };
}
