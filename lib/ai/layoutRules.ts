/**
 * Deterministic section plan from intent.goal.
 * Section ids are logical — mapped to real CMS block types in blockFactory.
 */

export type LayoutSectionId =
  | "hero"
  | "valueProps"
  | "socialProof"
  | "cta"
  | "productDetails"
  | "benefits"
  | "faq"
  | "richText"
  | "sections";

type IntentLike = { goal: "sell" | "inform" | "landing" | "product" };

export function getLayoutForIntent(intent: IntentLike): LayoutSectionId[] {
  switch (intent.goal) {
    case "landing":
      return ["hero", "valueProps", "socialProof", "cta"];
    case "product":
      return ["hero", "productDetails", "benefits", "faq", "cta"];
    case "inform":
      return ["hero", "richText", "sections", "faq"];
    case "sell":
    default:
      return ["hero", "valueProps", "richText", "cta"];
  }
}
