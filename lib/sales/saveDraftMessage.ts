/**
 * Skriver deterministisk utkast til lead_pipeline.meta — ingen e-post / LinkedIn.
 */
import "server-only";

import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "save_sales_loop_draft";

function hashMessage(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export type SaveDraftMessageResult = { saved: boolean; skipped: boolean; reason?: string };

export type DraftMessageKind = "loop" | "closing" | "sequence";

export async function saveDraftMessage(opts: {
  leadId: string;
  message: string;
  rid: string;
  /** «closing» skriver egne meta-felt + 48h cooldown (`closing_last_touch_at`). */
  kind?: DraftMessageKind;
  /** Ved kind «sequence» — brukes i hash og meta.sequence_draft_step. */
  sequenceStep?: number;
}): Promise<SaveDraftMessageResult> {
  const leadId = opts.leadId.trim();
  if (!leadId) return { saved: false, skipped: true, reason: "empty_lead" };

  if (!hasSupabaseAdminConfig()) {
    return { saved: false, skipped: true, reason: "no_admin" };
  }

  const kind: DraftMessageKind = opts.kind ?? "loop";
  const seqPart = kind === "sequence" ? `:${opts.sequenceStep ?? 0}` : "";
  const nextHash = hashMessage(`${kind}${seqPart}:${opts.message}`);

  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "lead_pipeline", ROUTE);
    if (!ok) return { saved: false, skipped: true, reason: "table_unavailable" };

    const { data: row, error: loadErr } = await admin.from("lead_pipeline").select("meta").eq("id", leadId).maybeSingle();
    if (loadErr || !row || typeof row !== "object") {
      console.error("[saveDraftMessage_load]", leadId, loadErr?.message);
      return { saved: false, skipped: true, reason: "load_failed" };
    }

    const rawMeta = (row as { meta?: unknown }).meta;
    const meta =
      rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)
        ? { ...(rawMeta as Record<string, unknown>) }
        : {};

    const prevHash =
      kind === "closing"
        ? meta.closing_draft_hash
        : kind === "sequence"
          ? meta.sequence_draft_hash
          : meta.sales_loop_draft_hash;
    if (typeof prevHash === "string" && prevHash === nextHash) {
      return { saved: true, skipped: true, reason: "idempotent_same_draft" };
    }

    const now = new Date().toISOString();
    if (kind === "closing") {
      meta.closing_draft_message = opts.message;
      meta.closing_draft_at = now;
      meta.closing_draft_rid = opts.rid;
      meta.closing_draft_hash = nextHash;
      meta.closing_last_touch_at = now;
    } else if (kind === "sequence") {
      meta.sequence_draft_message = opts.message;
      meta.sequence_draft_at = now;
      meta.sequence_draft_rid = opts.rid;
      meta.sequence_draft_hash = nextHash;
      if (typeof opts.sequenceStep === "number" && Number.isFinite(opts.sequenceStep)) {
        meta.sequence_draft_step = opts.sequenceStep;
      }
    } else {
      meta.sales_loop_draft_message = opts.message;
      meta.sales_loop_draft_at = now;
      meta.sales_loop_draft_rid = opts.rid;
      meta.sales_loop_draft_hash = nextHash;
      meta.sales_loop_last_touch_at = now;
    }

    const { error } = await admin.from("lead_pipeline").update({ meta }).eq("id", leadId);
    if (error) {
      console.error("[saveDraftMessage]", leadId, error.message);
      return { saved: false, skipped: false, reason: error.message };
    }

    return { saved: true, skipped: false };
  } catch (e) {
    console.error("[saveDraftMessage_fatal]", e instanceof Error ? e.message : String(e));
    return { saved: false, skipped: false, reason: "exception" };
  }
}
