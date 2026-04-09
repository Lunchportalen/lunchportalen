import type { Industry } from "@/lib/ai/industry";
import type { Role } from "@/lib/ai/role";

/**
 * Lead snapshot for CRM / attributjon (kan speiles til server).
 * `source` = leadSourceId fra ?src= (f.eks. post_cal_…).
 */
export type Lead = {
  id: string;
  source: string;
  industry: Industry;
  role: Role;
  companySize?: string;
  createdAt: number;
};
