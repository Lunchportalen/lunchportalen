import type { CeoOpportunity } from "@/lib/ceo/opportunities";

export type CeoAction = {
  id: string;
  action: string;
  message: string;
  autoExecutable: false;
  sourceOpportunityType?: string;
};

export function generateActions(opportunities: CeoOpportunity[]): CeoAction[] {
  return opportunities.map((o, i) => {
    if (o.type === "close_deals") {
      return {
        id: `ceo_act_close_${i}`,
        action: "trigger_outreach",
        message: "Følg opp varme leads",
        autoExecutable: false,
        sourceOpportunityType: o.type,
      };
    }
    if (o.type === "revive_deals") {
      return {
        id: `ceo_act_revive_${i}`,
        action: "send_followups",
        message: "Send oppfølging",
        autoExecutable: false,
        sourceOpportunityType: o.type,
      };
    }
    return {
      id: `ceo_act_observe_${i}`,
      action: "observe",
      message: "Ingen tiltak",
      autoExecutable: false,
    };
  });
}
