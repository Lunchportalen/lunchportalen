import "server-only";

import { getKPIs } from "@/lib/exit/kpi";

export async function prepareExit(): Promise<{
  arr: number;
  ltv: number;
  narrative: string;
}> {
  const kpi = await getKPIs();

  return {
    arr: kpi.arr,
    ltv: kpi.ltv,
    narrative: "High growth SaaS with AI automation",
  };
}
