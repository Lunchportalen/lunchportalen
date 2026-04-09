export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { runMonopoly } from "@/lib/monopoly/engine";
import { superadminControlTowerJsonGet } from "@/lib/http/superadminControlTowerGet";

export type CategoryDominancePayload = {
  generatedAt: string;
  ownershipScore: number;
  categoryStrength: number;
  positionClarity: number;
  distributionCoverage: number;
  moatStrength: number;
  explain: string[];
  /** Varsler avledet av siste kjøring (sammenligning med forrige baseline). */
  alertItems: Array<{ id: string; label: string }>;
  engineReasons: string[];
};

function mapAlerts(payload: ReturnType<typeof runMonopoly>): CategoryDominancePayload["alertItems"] {
  const items: CategoryDominancePayload["alertItems"] = [];
  const a = payload.alert;
  if (!a?.deltas) return items;

  if (a.deltas.position != null) {
    items.push({ id: "position_weakening", label: "Position weakening" });
  }
  if (a.deltas.distribution != null || a.deltas.moat != null) {
    items.push({ id: "competitor_gaining_ground", label: "Competitor gaining ground" });
  }

  return items;
}

/** GET: kategori-eierskap (monopol-motor) — superadmin. */
export async function GET(req: NextRequest): Promise<Response> {
  return superadminControlTowerJsonGet(req, "ct_monopoly", () => {
    const result = runMonopoly();
    const o = result.ownership;

    const alertItems = mapAlerts(result);

    const data: CategoryDominancePayload = {
      generatedAt: new Date().toISOString(),
      ownershipScore: o.ownershipScore,
      categoryStrength: o.categoryScore,
      positionClarity: o.positionScore,
      distributionCoverage: o.distributionScore,
      moatStrength: o.moatScore,
      explain: o.explain,
      alertItems,
      engineReasons: result.alert?.reasons ?? [],
    };

    return data;
  });
}
