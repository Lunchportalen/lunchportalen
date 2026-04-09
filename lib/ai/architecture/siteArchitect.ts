// STATUS: KEEP

/**
 * AI SITE ARCHITECT
 * Dette er den mest undervurderte motoren.
 * Den designer: hele nettstedstrukturen, topic clusters, navigasjon, intern linking.
 * Dette gjør AI til en strateg. Kun design/anbefaling; ingen mutasjon.
 */

import { generateSiteArchitecture } from "@/lib/ai/architecture/generateSiteArchitecture";
import type {
  GenerateSiteArchitectureInput,
  GenerateSiteArchitectureOutput,
  PageTreeNode,
  PrimaryNavItem,
  SecondaryNavItem,
  LandingPageRecommendation,
} from "@/lib/ai/architecture/generateSiteArchitecture";
import { generateFullSite } from "@/lib/ai/engines/capabilities/generateFullSite";
import type {
  GenerateFullSiteInput,
  GenerateFullSiteOutput,
  GeneratedSitePage,
} from "@/lib/ai/engines/capabilities/generateFullSite";
import { evolveSiteStructure } from "@/lib/ai/engines/capabilities/evolveSiteStructure";
import type {
  EvolveSiteStructureInput,
  EvolveSiteStructureOutput,
  CurrentPageInput,
  StructureEvolution,
} from "@/lib/ai/engines/capabilities/evolveSiteStructure";
import { generateTopicCluster } from "@/lib/ai/engines/capabilities/generateTopicCluster";
import type {
  GenerateTopicClusterInput,
  GenerateTopicClusterOutput,
} from "@/lib/ai/engines/capabilities/generateTopicCluster";
import { generateNavigation } from "@/lib/ai/engines/capabilities/generateNavigation";
import type {
  GenerateNavigationInput,
  GenerateNavigationOutput,
} from "@/lib/ai/engines/capabilities/generateNavigation";
import { generateInternalLinks } from "@/lib/ai/engines/capabilities/generateInternalLinks";
import type {
  GenerateInternalLinksInput,
  GenerateInternalLinksOutput,
  PageContentInput,
  SiteGraphNode,
  SuggestedInternalLink,
} from "@/lib/ai/engines/capabilities/generateInternalLinks";

export type {
  PageTreeNode,
  PrimaryNavItem,
  SecondaryNavItem,
  LandingPageRecommendation,
  GeneratedSitePage,
  CurrentPageInput,
  StructureEvolution,
  PageContentInput,
  SiteGraphNode,
  SuggestedInternalLink,
};

/** Designer hele nettstedstrukturen: sidetre, primær/secondary navigasjon, landingssider. */
export function designSiteStructure(input: GenerateSiteArchitectureInput): GenerateSiteArchitectureOutput {
  return generateSiteArchitecture(input);
}

/**
 * Designer fullt nettsted med sidetyper: sider (path, title, purpose, pageType, suggestedBlockTypes),
 * primær og secondary navigasjon, landingssider.
 */
export function designFullSite(input: GenerateFullSiteInput = {}): GenerateFullSiteOutput {
  return generateFullSite(input);
}

/** Foreslår inkrementell evolusjon av strukturen: legg til/slå sammen/avslutt sider, omrokkering av nav. */
export function evolveSite(input: EvolveSiteStructureInput = {}): EvolveSiteStructureOutput {
  return evolveSiteStructure(input);
}

/** Designer topic clusters: pillar-side, støttesider, interne lenker, content depth map. */
export function designTopicClusters(input: GenerateTopicClusterInput): GenerateTopicClusterOutput {
  return generateTopicCluster(input);
}

/** Designer navigasjon: primær og sekundær nav fra sideliste. */
export function designNavigation(input: GenerateNavigationInput): GenerateNavigationOutput {
  return generateNavigation(input);
}

/** Designer intern linking: forslag fra sideinnhold og site-graf. */
export function designInternalLinking(input: GenerateInternalLinksInput): GenerateInternalLinksOutput {
  return generateInternalLinks(input);
}

/** Type for dispatch. */
export type SiteArchitectKind =
  | "architecture"
  | "full_site"
  | "evolve"
  | "topic_clusters"
  | "navigation"
  | "internal_links";

export type SiteArchitectInput =
  | { kind: "architecture"; input: GenerateSiteArchitectureInput }
  | { kind: "full_site"; input?: GenerateFullSiteInput }
  | { kind: "evolve"; input?: EvolveSiteStructureInput }
  | { kind: "topic_clusters"; input: GenerateTopicClusterInput }
  | { kind: "navigation"; input: GenerateNavigationInput }
  | { kind: "internal_links"; input: GenerateInternalLinksInput };

export type SiteArchitectResult =
  | { kind: "architecture"; data: GenerateSiteArchitectureOutput }
  | { kind: "full_site"; data: GenerateFullSiteOutput }
  | { kind: "evolve"; data: EvolveSiteStructureOutput }
  | { kind: "topic_clusters"; data: GenerateTopicClusterOutput }
  | { kind: "navigation"; data: GenerateNavigationOutput }
  | { kind: "internal_links"; data: GenerateInternalLinksOutput };

/**
 * Samlet dispatch: nettstedstruktur, topic clusters, navigasjon, intern linking, full site, evolusjon.
 */
export function runSiteArchitect(req: SiteArchitectInput): SiteArchitectResult {
  switch (req.kind) {
    case "architecture":
      return { kind: "architecture", data: designSiteStructure(req.input) };
    case "full_site":
      return { kind: "full_site", data: designFullSite(req.input) };
    case "evolve":
      return { kind: "evolve", data: evolveSite(req.input) };
    case "topic_clusters":
      return { kind: "topic_clusters", data: designTopicClusters(req.input) };
    case "navigation":
      return { kind: "navigation", data: designNavigation(req.input) };
    case "internal_links":
      return { kind: "internal_links", data: designInternalLinking(req.input) };
    default:
      throw new Error(`Unknown site architect kind: ${(req as SiteArchitectInput).kind}`);
  }
}
