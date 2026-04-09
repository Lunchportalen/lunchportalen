export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { getControlTowerData } from "@/lib/controlTower/aggregator";
import { getDominationSnapshot } from "@/lib/domination/engine";
import type { OwnPerformanceSignals } from "@/lib/domination/marketGaps";
import { mapControlTowerToPerformance } from "@/lib/domination/mapControlTowerPerformance";
import { superadminControlTowerJsonGet } from "@/lib/http/superadminControlTowerGet";

/** GET: konkurrenter (rangert), gap og anbefalte tiltak — superadmin, read-only. */
export async function GET(req: NextRequest): Promise<Response> {
  return superadminControlTowerJsonGet(req, "ct_domination", async () => {
    let performance: OwnPerformanceSignals = {};
    try {
      const tower = await getControlTowerData();
      performance = mapControlTowerToPerformance(tower);
    } catch {
      /* fail-closed: tom performance */
    }

    const snap = getDominationSnapshot(performance);

    return {
      generatedAt: new Date().toISOString(),
      ...snap,
    };
  });
}
