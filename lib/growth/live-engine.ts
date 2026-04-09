import "server-only";

import { randomUUID } from "node:crypto";

import { addToApproval } from "@/lib/approval/queue";
import { trackCampaignEvent } from "@/lib/campaign/track";
import { getLeads } from "@/lib/growth/engine";
import { generateMessage } from "@/lib/gtm/outboundTemplates";
import { generateSocialPost } from "@/lib/social/livePostTemplate";
import { opsLog } from "@/lib/ops/log";

/**
 * Køer kun utkast — ingen ekte e-post/sosial før manuell godkjenning i approval-kø.
 */
export async function runLiveEngine(): Promise<{ status: "queued"; emailsQueued: number; socialQueued: number }> {
  const leads = await getLeads();
  const slice = leads.slice(0, 10);
  let emailsQueued = 0;

  for (const lead of slice) {
    const msg = generateMessage({
      company: lead.company,
      name: lead.name,
    });
    addToApproval({
      id: randomUUID(),
      type: "email",
      payload: { lead, msg },
    });
    trackCampaignEvent({ name: "live_engine_email_draft", leadId: lead.id });
    emailsQueued += 1;
  }

  const post = generateSocialPost({});
  addToApproval({
    id: randomUUID(),
    type: "social",
    payload: post,
  });
  trackCampaignEvent({ name: "live_engine_social_draft" });

  opsLog("live_engine_queued", { emailsQueued, socialQueued: 1 });
  return { status: "queued", emailsQueued, socialQueued: 1 };
}
