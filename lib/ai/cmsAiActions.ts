import "server-only";

/**
 * CMS AI — action surface for routes. No persistence; callers apply in editor explicitly.
 */
export {
  improveMenuCopy,
  generateMenuFromIntent,
  validateMenuQuality,
  suggestWeeklyVariation,
  scoreMenuQuality,
  heuristicImproveMenu,
} from "@/lib/ai/cmsAiEngine";
