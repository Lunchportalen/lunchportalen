import type { GtmDeal } from "@/lib/crm/pipeline";

const flow: Partial<Record<GtmDeal["stage"], GtmDeal["stage"]>> = {
  new: "contacted",
  contacted: "meeting",
  meeting: "proposal",
  proposal: "closed",
};

export function advanceDeal(deal: GtmDeal, _action: string): GtmDeal {
  void _action;
  const next = flow[deal.stage];
  return {
    ...deal,
    stage: next ?? deal.stage,
  };
}
