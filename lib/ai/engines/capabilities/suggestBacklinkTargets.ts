/**
 * AI link-building capability: suggestBacklinkTargets.
 * Suggests backlink target types and strategies (resource pages, roundups, broken links, guest posts, etc.)
 * with criteria and actions. Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "suggestBacklinkTargets";

const suggestBacklinkTargetsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Suggests backlink target types and link-building strategies: resource pages, roundups, broken-link prospects, guest posts, skyscraper content, competitor backlink replication. Returns criteria and actions per type.",
  requiredContext: ["topic"],
  inputSchema: {
    type: "object",
    description: "Backlink targets suggestion input",
    properties: {
      topic: { type: "string", description: "Topic, niche, or vertical to find targets for" },
      yourUrl: { type: "string", description: "Optional: your site URL for contextual suggestions" },
      locale: { type: "string", description: "Locale (nb | en) for labels and copy" },
      limit: { type: "number", description: "Max number of target types to return (default all)" },
    },
    required: ["topic"],
  },
  outputSchema: {
    type: "object",
    description: "Backlink target suggestions",
    required: ["topic", "targets", "summary"],
    properties: {
      topic: { type: "string" },
      targets: {
        type: "array",
        items: {
          type: "object",
          required: ["type", "label", "description", "criteria", "priority", "action"],
          properties: {
            type: { type: "string" },
            label: { type: "string" },
            description: { type: "string" },
            criteria: { type: "string" },
            priority: { type: "number" },
            action: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(suggestBacklinkTargetsCapability);

export type SuggestBacklinkTargetsInput = {
  topic: string;
  yourUrl?: string | null;
  locale?: "nb" | "en" | null;
  limit?: number | null;
};

export type BacklinkTargetSuggestion = {
  type: string;
  label: string;
  description: string;
  criteria: string;
  priority: number;
  action: string;
};

export type SuggestBacklinkTargetsOutput = {
  topic: string;
  targets: BacklinkTargetSuggestion[];
  summary: string;
};

type TargetDef = {
  type: string;
  labelEn: string;
  labelNb: string;
  descriptionEn: string;
  descriptionNb: string;
  criteriaEn: string;
  criteriaNb: string;
  actionEn: string;
  actionNb: string;
  priority: number;
};

const TARGET_DEFS: TargetDef[] = [
  {
    type: "resource_page",
    labelEn: "Resource / list pages",
    labelNb: "Ressurssider / listesider",
    descriptionEn: "Pages that curate links to tools, guides, or references in your niche.",
    descriptionNb: "Sider som samler lenker til verktøy, guider eller referanser i ditt nisje.",
    criteriaEn: "Search '[topic] resources', 'best [topic] tools', ' [topic] list'. Look for pages that accept suggestions.",
    criteriaNb: "Søk «[topic] ressurser», «beste [topic] verktøy», «[topic] liste». Finn sider som tar imot forslag.",
    actionEn: "Identify list owners; offer your content as a relevant, quality addition.",
    actionNb: "Identifiser liste-eiere; tilby ditt innhold som et relevant, kvalitetsbidrag.",
    priority: 1,
  },
  {
    type: "roundup",
    labelEn: "Roundup and expert quote posts",
    labelNb: "Roundup- og ekspertinnlegg",
    descriptionEn: "Articles that collect expert quotes or recommendations; often accept contributions.",
    descriptionNb: "Artikler som samler ekspertuttalelser eller anbefalinger; tar ofte imot bidrag.",
    criteriaEn: "Search '[topic] expert roundup', 'best [topic] 2024', '[topic] experts say'.",
    criteriaNb: "Søk «[topic] ekspert roundup», «beste [topic] 2024», «eksperter om [topic]».",
    actionEn: "Pitch a concise, unique quote or tip; link to your relevant page.",
    actionNb: "Foreslå et kort, unikt sitat eller tips; lenk til din relevante side.",
    priority: 2,
  },
  {
    type: "broken_link",
    labelEn: "Broken-link building",
    labelNb: "Broken link-bygging",
    descriptionEn: "Find pages in your niche with broken outbound links; suggest your content as a replacement.",
    descriptionNb: "Finn sider i nisjen med døde utlenker; foreslå ditt innhold som erstatning.",
    criteriaEn: "Use tools to find broken links on relevant sites, or manually check 'links to' pages.",
    criteriaNb: "Bruk verktøy for å finne ødelagte lenker på relevante sider, eller sjekk manuelt.",
    actionEn: "Notify webmaster with your working, relevant URL as a replacement.",
    actionNb: "Varsle webmaster med din fungerende, relevante URL som erstatning.",
    priority: 3,
  },
  {
    type: "guest_post",
    labelEn: "Guest post opportunities",
    labelNb: "Gjesteblogg-muligheter",
    descriptionEn: "Sites that accept guest posts in your topic; you get a byline and link.",
    descriptionNb: "Sider som tar imot gjesteblogger i ditt tema; du får kreditering og lenke.",
    criteriaEn: "Search '[topic] write for us', 'guest post [topic]', '[niche] contributor guidelines'.",
    criteriaNb: "Søk «[topic] skriv for oss», «gjesteblogg [topic]», «bidragsgiver [nisje]».",
    actionEn: "Pitch a unique angle; follow guidelines; include one contextual link to your site.",
    actionNb: "Foreslå en unik vinkel; følg retningslinjer; inkluder én kontekstuell lenke til din side.",
    priority: 4,
  },
  {
    type: "skyscraper",
    labelEn: "Skyscraper / better content",
    labelNb: "Skyscraper / bedre innhold",
    descriptionEn: "Outreach to pages that link to similar but weaker content; offer your superior piece.",
    descriptionNb: "Ta kontakt med sider som lenker til lignende men svakere innhold; tilby din bedre side.",
    criteriaEn: "Find top-ranking content for your keyword; see who links to it; create something better.",
    criteriaNb: "Finn topprangerende innhold for søkeordet; se hvem som lenker til det; lag noe bedre.",
    actionEn: "Create a more complete, updated, or clearer resource; ask linkers to consider it.",
    actionNb: "Lag en mer komplett, oppdatert eller tydeligere ressurs; be linkere vurdere den.",
    priority: 5,
  },
  {
    type: "competitor_backlinks",
    labelEn: "Competitor backlink replication",
    labelNb: "Replikere konkurrentens backlinks",
    descriptionEn: "Sites linking to competitors are often willing to link to you if you offer similar value.",
    descriptionNb: "Sider som lenker til konkurrenter er ofte villige til å lenke til deg med tilsvarende verdi.",
    criteriaEn: "Use backlink tools to see who links to top competitors; filter by relevance and authority.",
    criteriaNb: "Bruk backlink-verktøy for å se hvem som lenker til toppkonkurrenter; filtrer på relevans.",
    actionEn: "Audit their content; offer a comparable or better resource and request a link.",
    actionNb: "Gjennomgå deres innhold; tilby en tilsvarende eller bedre ressurs og be om lenke.",
    priority: 6,
  },
  {
    type: "haro_pr",
    labelEn: "HARO / PR and journalist requests",
    labelNb: "HARO / PR og journalistforespørsler",
    descriptionEn: "Respond to journalist and PR requests; get cited and linked as a source.",
    descriptionNb: "Svar på forespørsler fra journalister og PR; bli sitert og lenket som kilde.",
    criteriaEn: "Sign up for HARO, Qwoted, or similar; filter for [topic]; respond quickly with value.",
    criteriaNb: "Registrer deg for HARO, Qwoted eller tilsvarende; filtrer på [topic]; svar raskt med verdi.",
    actionEn: "Provide a short, quotable, expert response with your credentials and link.",
    actionNb: "Gi et kort, siterbart ekspertsvar med din kompetanse og lenke.",
    priority: 7,
  },
];

function interpolateTopic(text: string, topic: string): string {
  const t = (topic ?? "").trim() || "topic";
  return text.replace(/\[topic\]/gi, t).replace(/\[niche\]/gi, t);
}

/**
 * Suggests backlink target types and strategies for a topic. Deterministic; no external calls.
 */
export function suggestBacklinkTargets(input: SuggestBacklinkTargetsInput): SuggestBacklinkTargetsOutput {
  const topic = (input.topic ?? "").trim() || "your niche";
  const isEn = input.locale === "en";
  const limit =
    typeof input.limit === "number" && !Number.isNaN(input.limit) && input.limit > 0
      ? Math.min(Math.floor(input.limit), TARGET_DEFS.length)
      : TARGET_DEFS.length;

  const targets: BacklinkTargetSuggestion[] = TARGET_DEFS.slice(0, limit).map((def) => ({
    type: def.type,
    label: isEn ? def.labelEn : def.labelNb,
    description: isEn ? def.descriptionEn : def.descriptionNb,
    criteria: interpolateTopic(isEn ? def.criteriaEn : def.criteriaNb, topic),
    priority: def.priority,
    action: isEn ? def.actionEn : def.actionNb,
  }));

  const summary = isEn
    ? `${targets.length} backlink target types suggested for "${topic}". Prioritize resource pages and roundups first.`
    : `${targets.length} backlink-måltyper foreslått for «${topic}». Prioriter ressurssider og roundups først.`;

  return {
    topic,
    targets,
    summary,
  };
}

export { suggestBacklinkTargetsCapability, CAPABILITY_NAME };
