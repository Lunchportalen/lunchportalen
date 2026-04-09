/**
 * Oppdaterer meta etter lagret sekvensutkast (server-side).
 */
import "server-only";

import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import type { SequenceStepDef } from "@/lib/sales/sequence";
import { detectNegativeInbound } from "@/lib/sales/shouldSend";

const ROUTE = "update_sequence_meta";

export type TimelineEntry = {
  at: string;
  kind: "sequence_draft" | "inbound";
  step?: number;
  preview: string;
};

function appendTimeline(meta: Record<string, unknown>, entry: TimelineEntry): void {
  const raw = meta.sequence_timeline;
  const arr = Array.isArray(raw) ? [...raw] : [];
  arr.push(entry);
  meta.sequence_timeline = arr.slice(-25);
}

export async function applySequenceAdvanceAfterDraft(opts: {
  leadId: string;
  step: SequenceStepDef;
  messagePreview: string;
  rid: string;
}): Promise<void> {
  if (!hasSupabaseAdminConfig()) return;
  const leadId = opts.leadId.trim();
  if (!leadId) return;

  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "lead_pipeline", ROUTE);
    if (!ok) return;

    const { data: row, error: loadErr } = await admin.from("lead_pipeline").select("meta").eq("id", leadId).maybeSingle();
    if (loadErr || !row || typeof row !== "object") return;

    const rawMeta = (row as { meta?: unknown }).meta;
    const meta =
      rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)
        ? { ...(rawMeta as Record<string, unknown>) }
        : {};

    const now = new Date().toISOString();
    meta.sequence_step = opts.step.step;
    meta.sequence_last_message_at = now;
    meta.sequence_last_message_rid = opts.rid;

    appendTimeline(meta, {
      at: now,
      kind: "sequence_draft",
      step: opts.step.step,
      preview: opts.messagePreview.slice(0, 400),
    });

    const { error } = await admin.from("lead_pipeline").update({ meta }).eq("id", leadId);
    if (error) console.error("[applySequenceAdvanceAfterDraft]", leadId, error.message);
  } catch (e) {
    console.error("[applySequenceAdvanceAfterDraft_fatal]", e instanceof Error ? e.message : String(e));
  }
}

export async function applyInboundSequenceMeta(opts: {
  leadId: string;
  message: string;
  rid: string;
  objectionReplyPreview?: string | null;
}): Promise<void> {
  if (!hasSupabaseAdminConfig()) return;
  const leadId = opts.leadId.trim();
  if (!leadId) return;

  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "lead_pipeline", ROUTE);
    if (!ok) return;

    const { data: row, error: loadErr } = await admin.from("lead_pipeline").select("meta").eq("id", leadId).maybeSingle();
    if (loadErr || !row || typeof row !== "object") return;

    const rawMeta = (row as { meta?: unknown }).meta;
    const meta =
      rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)
        ? { ...(rawMeta as Record<string, unknown>) }
        : {};

    const now = new Date().toISOString();
    meta.sequence_last_response = opts.message.trim();
    meta.last_response = opts.message.trim();
    meta.conversation_active = true;

    if (opts.objectionReplyPreview && opts.objectionReplyPreview.trim()) {
      meta.sequence_objection_suggestion = opts.objectionReplyPreview.trim().slice(0, 2000);
    }

    if (detectNegativeInbound(opts.message)) {
      meta.sequence_paused = true;
    }

    appendTimeline(meta, {
      at: now,
      kind: "inbound",
      preview: opts.message.trim().slice(0, 400),
    });

    const { error } = await admin.from("lead_pipeline").update({ meta }).eq("id", leadId);
    if (error) console.error("[applyInboundSequenceMeta]", leadId, error.message);
  } catch (e) {
    console.error("[applyInboundSequenceMeta_fatal]", e instanceof Error ? e.message : String(e));
  }
}
