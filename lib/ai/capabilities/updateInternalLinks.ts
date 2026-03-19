/**
 * AI internal-link refresher capability: updateInternalLinks.
 * Compares current internal links (per page) to site graph and suggests updates:
 * add missing links, remove broken or invalid targets, update generic anchor text.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "updateInternalLinks";

const updateInternalLinksCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "AI internal-link refresher: compares current internal links (per page) to site graph. Suggests add (missing relevant links), remove (broken or invalid targets), update_anchor (generic anchor → target title). Returns update suggestions per page. Deterministic; no LLM.",
  requiredContext: ["currentLinks", "siteGraph"],
  inputSchema: {
    type: "object",
    description: "Update internal links input",
    properties: {
      currentLinks: {
        type: "array",
        description: "Per-page current outbound links",
        items: {
          type: "object",
          required: ["fromPath", "links"],
          properties: {
            fromPath: { type: "string" },
            links: {
              type: "array",
              items: {
                type: "object",
                required: ["toPath"],
                properties: {
                  toPath: { type: "string" },
                  anchorText: { type: "string" },
                },
              },
            },
          },
        },
      },
      siteGraph: {
        type: "array",
        description: "Valid pages (path, title) to match links against",
        items: {
          type: "object",
          required: ["path", "title"],
          properties: {
            path: { type: "string" },
            title: { type: "string" },
          },
        },
      },
      newOrUpdatedPaths: {
        type: "array",
        description: "Optional: recently added/updated paths to suggest linking to",
        items: { type: "string" },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
      maxSuggestionsPerPage: { type: "number", description: "Max add/update suggestions per page (default 10)" },
    },
    required: ["currentLinks", "siteGraph"],
  },
  outputSchema: {
    type: "object",
    description: "Internal link update suggestions",
    required: ["updates", "summary"],
    properties: {
      updates: {
        type: "array",
        items: {
          type: "object",
          required: ["fromPath", "add", "remove", "updateAnchor"],
          properties: {
            fromPath: { type: "string" },
            add: {
              type: "array",
              items: {
                type: "object",
                required: ["toPath", "suggestedAnchorText", "reason"],
                properties: {
                  toPath: { type: "string" },
                  suggestedAnchorText: { type: "string" },
                  reason: { type: "string" },
                },
              },
            },
            remove: {
              type: "array",
              items: {
                type: "object",
                required: ["toPath", "reason"],
                properties: {
                  toPath: { type: "string" },
                  reason: { type: "string" },
                },
              },
            },
            updateAnchor: {
              type: "array",
              items: {
                type: "object",
                required: ["toPath", "currentAnchor", "suggestedAnchor", "reason"],
                properties: {
                  toPath: { type: "string" },
                  currentAnchor: { type: "string" },
                  suggestedAnchor: { type: "string" },
                  reason: { type: "string" },
                },
              },
            },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is update suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(updateInternalLinksCapability);

export type CurrentLinkItem = {
  toPath: string;
  anchorText?: string | null;
};

export type PageCurrentLinks = {
  fromPath: string;
  links: CurrentLinkItem[];
};

export type SiteGraphNodeRef = {
  path: string;
  title: string;
};

export type UpdateInternalLinksInput = {
  currentLinks: PageCurrentLinks[];
  siteGraph: SiteGraphNodeRef[];
  newOrUpdatedPaths?: string[] | null;
  locale?: "nb" | "en" | null;
  maxSuggestionsPerPage?: number | null;
};

export type LinkAddSuggestion = {
  toPath: string;
  suggestedAnchorText: string;
  reason: string;
};

export type LinkRemoveSuggestion = {
  toPath: string;
  reason: string;
};

export type LinkUpdateAnchorSuggestion = {
  toPath: string;
  currentAnchor: string;
  suggestedAnchor: string;
  reason: string;
};

export type PageLinkUpdates = {
  fromPath: string;
  add: LinkAddSuggestion[];
  remove: LinkRemoveSuggestion[];
  updateAnchor: LinkUpdateAnchorSuggestion[];
};

export type UpdateInternalLinksOutput = {
  updates: PageLinkUpdates[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normPath(p: string): string {
  return (p ?? "").trim().replace(/\/$/, "") || "/";
}

const GENERIC_ANCHORS = new Set([
  "click here", "les mer", "se mer", "klikk her", "read more", "here", "her",
  "link", "lenke", "more", "mer", "this page", "denne siden",
]);

function isGenericAnchor(anchor: string): boolean {
  return GENERIC_ANCHORS.has(anchor.toLowerCase().trim());
}

/**
 * Suggests internal link updates (add, remove, update anchor) per page. Deterministic; no external calls.
 */
export function updateInternalLinks(input: UpdateInternalLinksInput): UpdateInternalLinksOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const maxPerPage = Math.min(20, Math.max(1, Math.floor(Number(input.maxSuggestionsPerPage) ?? 10)));

  const currentLinks = Array.isArray(input.currentLinks)
    ? input.currentLinks.filter(
        (p): p is PageCurrentLinks =>
          p != null && typeof p === "object" && typeof (p as PageCurrentLinks).fromPath === "string" && Array.isArray((p as PageCurrentLinks).links)
      )
    : [];
  const graph = Array.isArray(input.siteGraph)
    ? input.siteGraph.filter(
        (n): n is SiteGraphNodeRef =>
          n != null && typeof n === "object" && typeof (n as SiteGraphNodeRef).path === "string" && typeof (n as SiteGraphNodeRef).title === "string"
      )
    : [];
  const validPaths = new Set(graph.map((n) => normPath(n.path)));
  const titleByPath = new Map(graph.map((n) => [normPath(n.path), safeStr(n.title) || n.path]));
  const newPaths = new Set(
    (Array.isArray(input.newOrUpdatedPaths) ? input.newOrUpdatedPaths : []).map((p) => normPath(p))
  );

  const updates: PageLinkUpdates[] = [];

  for (const page of currentLinks) {
    const fromPath = normPath(page.fromPath);
    const links = Array.isArray(page.links) ? page.links : [];
    const linkedTo = new Set(links.map((l) => normPath((l as CurrentLinkItem).toPath)));

    const add: LinkAddSuggestion[] = [];
    const remove: LinkRemoveSuggestion[] = [];
    const updateAnchor: LinkUpdateAnchorSuggestion[] = [];

    for (const link of links) {
      const toPath = normPath(link.toPath);
      const anchor = safeStr(link.anchorText);
      if (!validPaths.has(toPath)) {
        remove.push({
          toPath,
          reason: isEn ? "Target path not in site graph; remove or fix link." : "Målpath finnes ikke i nettstedsgrafen; fjern eller rett lenken.",
        });
        continue;
      }
      const targetTitle = titleByPath.get(toPath);
      if (targetTitle && anchor && isGenericAnchor(anchor)) {
        updateAnchor.push({
          toPath,
          currentAnchor: anchor,
          suggestedAnchor: targetTitle,
          reason: isEn ? "Replace generic anchor with target page title for SEO." : "Erstatt generisk anker med malsidens tittel for SEO.",
        });
      }
    }

    const keyPaths = ["/", "/kontakt", "/contact", "/om-oss", "/about"];
    for (const p of keyPaths) {
      const norm = normPath(p);
      if (norm === fromPath) continue;
      if (!validPaths.has(norm)) continue;
      if (linkedTo.has(norm)) continue;
      if (add.length >= maxPerPage) break;
      const title = titleByPath.get(norm) || (norm === "/" ? (isEn ? "Home" : "Hjem") : norm);
      const reason = newPaths.has(norm)
        ? (isEn ? "New or updated page; add link for discoverability." : "Ny eller oppdatert side; legg til lenke for finnbarhet.")
        : (isEn ? "Key page not linked; consider adding." : "Viktig side ikke lenket; vurder å legge til.");
      add.push({ toPath: norm, suggestedAnchorText: title, reason });
    }

    for (const p of newPaths) {
      if (p === fromPath || !validPaths.has(p)) continue;
      if (linkedTo.has(p)) continue;
      if (add.length >= maxPerPage) break;
      const title = titleByPath.get(p) || p;
      add.push({
        toPath: p,
        suggestedAnchorText: title,
        reason: isEn ? "New or updated content; add internal link." : "Nytt eller oppdatert innhold; legg til intern lenke.",
      });
    }

    updates.push({
      fromPath,
      add: add.slice(0, maxPerPage),
      remove,
      updateAnchor,
    });
  }

  const totalAdd = updates.reduce((s, u) => s + u.add.length, 0);
  const totalRemove = updates.reduce((s, u) => s + u.remove.length, 0);
  const totalAnchor = updates.reduce((s, u) => s + u.updateAnchor.length, 0);
  const summary = isEn
    ? `Internal link updates: ${updates.length} page(s). ${totalAdd} add, ${totalRemove} remove, ${totalAnchor} anchor update(s).`
    : `Oppdateringer av interne lenker: ${updates.length} side(r). ${totalAdd} legg til, ${totalRemove} fjern, ${totalAnchor} ankeroppdatering(er).`;

  return {
    updates,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { updateInternalLinksCapability, CAPABILITY_NAME };
