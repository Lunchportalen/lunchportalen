/**
 * Who may receive economic columns on orders / items / menu rows.
 * Fail-closed: unknown roles → no prices.
 *
 * Forretningsregel: kun `company_admin` får prisfelt i projections som bruker denne flaggen.
 * (Superadmin har egne admin-endepunkt med eksplisitte selects — f.eks. `/api/admin/orders`.)
 */
export function showOrderPricesForApiRole(role: string | null | undefined): boolean {
  const r = String(role ?? "")
    .trim()
    .toLowerCase();
  return r === "company_admin";
}
