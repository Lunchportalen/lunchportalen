/**
 * Merges agent action lists with dedupe by `type` (first occurrence wins — deterministic order).
 */

export type OrgActionType = "experiment" | "variant" | "optimize" | "stability_check";

export type OrgAction = { type: OrgActionType };

export function mergeActions(...actionLists: OrgAction[][]): OrgAction[] {
  const flat = actionLists.flat();
  const seen = new Set<OrgActionType>();
  return flat.filter((a) => {
    const t = a.type;
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });
}
