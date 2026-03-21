/**
 * Stale-content refresh AI capability: refreshOutdatedContent.
 * Takes outdated/stale content items and suggests concrete refresh actions per item:
 * update intro, refresh stats/dates, update CTA, add last-updated note, review facts, update meta.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "refreshOutdatedContent";

const refreshOutdatedContentCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Stale-content refresh AI: takes outdated/stale content items (path, title, reason, daysSinceUpdate) and suggests concrete refresh actions per item: update intro, refresh stats/dates, update CTA, add last-updated note, review facts, update meta. Returns prioritized actions per item. Deterministic; no LLM.",
  requiredContext: ["outdatedItems"],
  inputSchema: {
    type: "object",
    description: "Refresh outdated content input",
    properties: {
      outdatedItems: {
        type: "array",
        description: "Outdated items (e.g. from detectOutdatedContent)",
        items: {
          type: "object",
          required: ["path", "title"],
          properties: {
            path: { type: "string" },
            title: { type: "string" },
            reason: { type: "string", description: "age | review_overdue | both" },
            daysSinceUpdate: { type: "number" },
            severity: { type: "string", description: "low | medium | high" },
          },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
      maxItems: { type: "number", description: "Max items to process (default 50)" },
      maxActionsPerItem: { type: "number", description: "Max refresh actions per item (default 6)" },
    },
    required: ["outdatedItems"],
  },
  outputSchema: {
    type: "object",
    description: "Refresh suggestions per outdated item",
    required: ["refreshes", "summary"],
    properties: {
      refreshes: {
        type: "array",
        items: {
          type: "object",
          required: ["path", "title", "actions", "priority"],
          properties: {
            path: { type: "string" },
            title: { type: "string" },
            reason: { type: "string" },
            daysSinceUpdate: { type: "number" },
            priority: { type: "string", description: "high | medium | low" },
            actions: {
              type: "array",
              items: {
                type: "object",
                required: ["action", "message", "priority"],
                properties: {
                  action: { type: "string", description: "update_intro | refresh_stats | update_cta | add_last_updated | review_facts | update_meta" },
                  message: { type: "string" },
                  priority: { type: "string", description: "high | medium | low" },
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
    { code: "suggestions_only", description: "Output is refresh suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(refreshOutdatedContentCapability);

export type OutdatedItemInput = {
  path: string;
  title: string;
  reason?: "age" | "review_overdue" | "both" | string | null;
  daysSinceUpdate?: number | null;
  severity?: "low" | "medium" | "high" | null;
};

export type RefreshOutdatedContentInput = {
  outdatedItems: OutdatedItemInput[];
  locale?: "nb" | "en" | null;
  maxItems?: number | null;
  maxActionsPerItem?: number | null;
};

export type RefreshAction = {
  action: "update_intro" | "refresh_stats" | "update_cta" | "add_last_updated" | "review_facts" | "update_meta";
  message: string;
  priority: "high" | "medium" | "low";
};

export type ItemRefreshSuggestions = {
  path: string;
  title: string;
  reason?: string | null;
  daysSinceUpdate?: number | null;
  priority: "high" | "medium" | "low";
  actions: RefreshAction[];
};

export type RefreshOutdatedContentOutput = {
  refreshes: ItemRefreshSuggestions[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Suggests concrete refresh actions for each outdated item. Deterministic; no external calls.
 */
export function refreshOutdatedContent(input: RefreshOutdatedContentInput): RefreshOutdatedContentOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const maxItems = Math.min(100, Math.max(1, Math.floor(Number(input.maxItems) ?? 50)));
  const maxActions = Math.min(10, Math.max(1, Math.floor(Number(input.maxActionsPerItem) ?? 6)));

  const items = Array.isArray(input.outdatedItems)
    ? input.outdatedItems
        .filter(
          (i): i is OutdatedItemInput =>
            i != null && typeof i === "object" && typeof (i as OutdatedItemInput).path === "string" && typeof (i as OutdatedItemInput).title === "string"
        )
        .slice(0, maxItems)
    : [];

  const refreshes: ItemRefreshSuggestions[] = [];

  for (const item of items) {
    const path = safeStr(item.path) || "/";
    const title = safeStr(item.title) || (isEn ? "Page" : "Side");
    const reason = safeStr(item.reason) || "age";
    const daysSinceUpdate = typeof item.daysSinceUpdate === "number" && !Number.isNaN(item.daysSinceUpdate) ? item.daysSinceUpdate : null;
    const severity = (item.severity === "high" || item.severity === "medium" || item.severity === "low" ? item.severity : "medium") as ItemRefreshSuggestions["priority"];

    const actions: RefreshAction[] = [];

    actions.push({
      action: "add_last_updated",
      message: isEn ? "Add or update a 'Last updated' note with the current date." : "Legg til eller oppdater en 'Sist oppdatert'-notis med dagens dato.",
      priority: "high",
    });
    actions.push({
      action: "update_intro",
      message: isEn ? "Refresh the intro paragraph to reflect current relevance and hook." : "Oppdater innledningsavsnittet slik at det reflekterer nåværende relevans.",
      priority: "high",
    });
    actions.push({
      action: "refresh_stats",
      message: isEn ? "Review and update any statistics, numbers, or dates in the body." : "Gå gjennom og oppdater eventuelle tall, statistikk eller datoer i teksten.",
      priority: daysSinceUpdate != null && daysSinceUpdate > 365 ? "high" : "medium",
    });
    actions.push({
      action: "review_facts",
      message: isEn ? "Verify key facts, links, and references are still accurate." : "Verifiser at nøkkelfakta, lenker og referanser fortsatt er korrekte.",
      priority: reason === "review_overdue" || reason === "both" ? "high" : "medium",
    });
    actions.push({
      action: "update_cta",
      message: isEn ? "Ensure CTA copy and links are current and relevant." : "Sikre at CTA-tekst og lenker er oppdatert og relevante.",
      priority: "medium",
    });
    actions.push({
      action: "update_meta",
      message: isEn ? "Update meta title and description if the focus has changed." : "Oppdater meta tittel og beskrivelse dersom fokus har endret seg.",
      priority: "low",
    });

    refreshes.push({
      path,
      title,
      reason: reason || undefined,
      daysSinceUpdate: daysSinceUpdate ?? undefined,
      priority: severity,
      actions: actions.slice(0, maxActions),
    });
  }

  const totalActions = refreshes.reduce((sum, r) => sum + r.actions.length, 0);
  const summary = isEn
    ? `Refresh suggestions for ${refreshes.length} outdated item(s); ${totalActions} action(s) total. Apply in order of priority.`
    : `Oppdateringsforslag for ${refreshes.length} utdatert(e) element(er); ${totalActions} handling(er) totalt. Utfør i prioritert rekkefølge.`;

  return {
    refreshes,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { refreshOutdatedContentCapability, CAPABILITY_NAME };
