import { getIndustryMessage } from "@/lib/social/industryMessaging";
import { getIndustryRoleMessage } from "@/lib/social/roleMessaging";
import type { OutboundLead } from "@/lib/outbound/lead";
import { toIndustryFromOutbound } from "@/lib/outbound/normalizeSegment";

export type PersonalizedOutbound = {
  intro: string;
  pain: string;
  value: string;
};

export function personalizeLead(lead: OutboundLead): PersonalizedOutbound {
  const ctx = `${lead.companyName} ${lead.industry} ${lead.role}`;
  const ind = toIndustryFromOutbound(lead.industry, ctx);
  const industryMsg = getIndustryMessage(ind);
  const roleMsg = getIndustryRoleMessage(lead.industry, lead.role);

  return {
    intro: roleMsg,
    pain: industryMsg.pain,
    value: industryMsg.value,
  };
}
