export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { listQualifiedLeads, type Lead } from "@/lib/golive/leads";
import {
  countPipelinePhases,
  listPipelineLeads,
  type PipelinePhaseCounts,
} from "@/lib/golive/pipelineRegistry";
import { getRevenueOverview } from "@/lib/golive/revenue";
import { superadminControlTowerJsonGet } from "@/lib/http/superadminControlTowerGet";

export type GoLiveEnginePayload = {
  generatedAt: string;
  leads: Lead[];
  phaseCounts: PipelinePhaseCounts;
  qualifiedCount: number;
  conversionRate: number | null;
  revenue: {
    mrrNok: number;
    arrNok: number;
    recordCount: number;
  };
};

/** GET: Go Live-snapshot (leads, faser, konvertering, omsetning) — superadmin. */
export async function GET(req: NextRequest): Promise<Response> {
  return superadminControlTowerJsonGet(req, "ct_golive", async () => {
    const leads = listPipelineLeads();
    const phaseCounts = countPipelinePhases(leads);
    const qualifiedCount = listQualifiedLeads(leads).length;
    const rev = getRevenueOverview();
    const conversionRate = rev.conversionRate;

    const data: GoLiveEnginePayload = {
      generatedAt: new Date().toISOString(),
      leads,
      phaseCounts,
      qualifiedCount,
      conversionRate,
      revenue: {
        mrrNok: rev.mrrNok,
        arrNok: rev.arrNok,
        recordCount: rev.recordCount,
      },
    };

    return data;
  });
}
