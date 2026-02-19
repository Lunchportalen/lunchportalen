// app/superadmin/firms/actions.ts

"use server";
import "server-only";

/**
 * Re-export layer for firm-level actions.
 *
 * All logikk ligger i:
 *   app/superadmin/firms/[companyId]/actions.ts
 */

export type { CompanyStatus } from "./[companyId]/actions";
export { setCompanyStatus } from "./[companyId]/actions";
