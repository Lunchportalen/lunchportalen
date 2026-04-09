export function buildNarrative(alignmentActions: string[]): string[] {
  const narrative: string[] = [];
  if (alignmentActions.includes("IMPROVE_MESSAGING")) {
    narrative.push("CLEAR_VALUE_PROPOSITION");
  }
  if (alignmentActions.includes("ADD_TRUST_SIGNALS")) {
    narrative.push("SOCIAL_PROOF");
  }
  if (alignmentActions.includes("STRENGTHEN_POSITIONING")) {
    narrative.push("CATEGORY_AUTHORITY");
  }
  if (alignmentActions.includes("REDUCE_FRICTION")) {
    narrative.push("SIMPLIFY_DECISION_PATH");
  }
  return narrative;
}
