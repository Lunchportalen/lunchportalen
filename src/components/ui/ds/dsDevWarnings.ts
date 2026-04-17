/**
 * Dev-only hints when primitives bypass the design system.
 * Prefer DsButton / Ds* from this package in product UI.
 */
export function warnDesignSystemBypass(tag: string, context: string): void {
  if (process.env.NODE_ENV === "production") return;
  console.warn(`[DS] Raw <${tag}> in ${context} — prefer DsButton or other components from @/components/ui/ds.`);
}
