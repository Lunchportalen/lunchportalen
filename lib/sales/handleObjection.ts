/**
 * Orkestrering: deterministisk klassifisering + strategi, deretter AI-tekst.
 */
import "server-only";

import { buildContext, type LeadContextInput } from "@/lib/sales/context";
import { detectObjection } from "@/lib/sales/objections";
import { getStrategy } from "@/lib/sales/responseStrategy";
import { generateAdaptiveReply } from "@/lib/sales/aiResponse";
import { logObjectionHandled } from "@/lib/sales/objectionAudit";

export type HandleObjectionResult = {
  type: ReturnType<typeof detectObjection>;
  strategy: ReturnType<typeof getStrategy>;
  reply: string;
  fallbackUsed: boolean;
};

export async function handleObjection(
  lead: LeadContextInput,
  incomingMessage: string,
  opts: { rid: string },
): Promise<HandleObjectionResult> {
  const type = detectObjection(incomingMessage);
  const strategy = getStrategy(type);
  const context = buildContext(lead);

  const { text, fallbackUsed } = await generateAdaptiveReply({
    objection: type,
    strategy,
    context,
    message: incomingMessage,
  });

  await logObjectionHandled(opts.rid, {
    leadId: lead.id,
    type,
    strategy,
    fallbackUsed,
    success: null,
    replyPreview: text,
  });

  return {
    type,
    strategy,
    reply: text,
    fallbackUsed,
  };
}
