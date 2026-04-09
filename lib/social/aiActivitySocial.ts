import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "social_ai_activity";

export type SocialAiActivityAction = "social_click" | "conversion" | "learning_pattern";

/**
 * Best-effort logging til ai_activity_log (service role). Aldri kast til kaller.
 */
export async function logSocialAiActivity(opts: {
  action: SocialAiActivityAction;
  rid?: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
    if (!ok) return;

    const row = buildAiActivityLogRow({
      action: opts.action,
      metadata: {
        ...opts.metadata,
        source: "social_attribution",
      },
    });

    const { error } = await admin.from("ai_activity_log").insert({
      ...row,
      rid: opts.rid ?? null,
      status: "success" as const,
    } as Record<string, unknown>);

    if (error) console.error("[logSocialAiActivity]", opts.action, error.message);
  } catch (e) {
    console.error("[logSocialAiActivity]", e instanceof Error ? e.message : String(e));
  }
}
