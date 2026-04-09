/**
 * Kobler lead_pipeline.source_post_id → orders.social_post_id og oppdaterer SoMe-metrics (best-effort).
 * Kjøres etter vellykket lp_order_set. Skal aldri kaste til kaller.
 */
import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import type { StandardSocialContentV1 } from "@/lib/social/socialPostContent";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

function normEmail(v: string | null | undefined): string | null {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  return s || null;
}

function parseLineTotal(row: { line_total?: unknown }): number {
  const lt = row.line_total;
  if (typeof lt === "number" && Number.isFinite(lt)) return lt;
  if (typeof lt === "string" && lt.trim()) {
    const n = Number(lt);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/** Syntetisk kilde-id fra kontaktskjema uten SoMe-post — ikke FK til social_posts. */
function isSyntheticKontaktSourceId(sourcePostId: string): boolean {
  return sourcePostId.startsWith("kontakt:");
}

/**
 * Etter ordre-opprettelse: slå opp lead på profil-e-post, sett orders.social_post_id hvis tomt,
 * oppdater social_posts.content.metrics (orders, revenue), logg ai_activity_log.
 */
export async function applyLeadPipelineOrderAttribution(opts: {
  orderId: string;
  userEmail: string | null | undefined;
  rid: string;
}): Promise<void> {
  if (!hasSupabaseAdminConfig()) {
    console.log("[ORDER_ATTRIBUTION_SKIP]", { reason: "no_admin", rid: opts.rid });
    return;
  }

  try {
    const email = normEmail(opts.userEmail);
    const orderId = String(opts.orderId ?? "").trim();
    if (!email || !orderId) {
      console.log("[ORDER_ATTRIBUTION_SKIP]", { reason: "no_email_or_order", rid: opts.rid });
      return;
    }

    const admin = supabaseAdmin();
    const lpOk = await verifyTable(admin, "lead_pipeline", "apply_lead_order_attr");
    const spOk = await verifyTable(admin, "social_posts", "apply_lead_order_attr");
    if (!lpOk) {
      console.log("[ORDER_ATTRIBUTION_SKIP]", { reason: "lead_pipeline_unavailable", rid: opts.rid });
      return;
    }

    const { data: orderRow, error: orderErr } = await admin
      .from("orders")
      .select("id, social_post_id, line_total")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr) {
      console.error("[ORDER_ATTRIBUTION_ORDER_FETCH]", orderErr.message, { rid: opts.rid, orderId });
      return;
    }
    if (!orderRow || typeof orderRow !== "object") {
      console.error("[ORDER_ATTRIBUTION_ORDER_FETCH]", "empty", { rid: opts.rid, orderId });
      return;
    }

    const existingSocial =
      typeof (orderRow as { social_post_id?: unknown }).social_post_id === "string"
        ? String((orderRow as { social_post_id: string }).social_post_id).trim()
        : "";
    const amount = parseLineTotal(orderRow as { line_total?: unknown });

    const { data: lead, error: leadErr } = await admin
      .from("lead_pipeline")
      .select("id, source_post_id, meta")
      .eq("contact_email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (leadErr) {
      console.error("[LEAD_LOOKUP_ERROR]", leadErr.message, { rid: opts.rid, email: email.replace(/(^.).*(@.*$)/, "$1***$2") });
      return;
    }

    if (lead && typeof lead.id === "string") {
      const rawMeta = (lead as { meta?: unknown }).meta;
      const meta =
        rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)
          ? (rawMeta as Record<string, unknown>)
          : {};
      const alreadyWon = meta.pipeline_stage === "won";

      if (!alreadyWon) {
        const closedAt = new Date().toISOString();
        const nextMeta = {
          ...meta,
          pipeline_stage: "won",
          probability: 1,
          closed_at: closedAt,
          closed_order_id: orderId,
        };
        const { error: closeErr } = await admin
          .from("lead_pipeline")
          .update({
            status: "closed",
            meta: nextMeta,
          })
          .eq("id", lead.id);

        if (closeErr) {
          console.error("[LEAD_CLOSE_ERROR]", closeErr.message, { rid: opts.rid, leadId: lead.id });
        } else {
          console.log("[LEAD_CLOSED]", { leadId: lead.id, orderId, rid: opts.rid });
          const logOkClose = await verifyTable(admin, "ai_activity_log", "apply_lead_order_attr");
          if (logOkClose) {
            const rowClosed = buildAiActivityLogRow({
              action: "lead_closed",
              metadata: {
                leadId: lead.id,
                orderId,
                amount,
                source: "order_conversion",
              },
            });
            const { error: logCloseErr } = await admin.from("ai_activity_log").insert({
              ...rowClosed,
              rid: opts.rid,
              status: "success" as const,
            } as Record<string, unknown>);
            if (logCloseErr) {
              console.error("[LEAD_CLOSED_LOG]", logCloseErr.message, { rid: opts.rid });
            }
          }
        }
      } else {
        console.log("[LEAD_CLOSED_SKIP]", { reason: "already_won", leadId: lead.id, rid: opts.rid });
      }
    }

    let resolvedPostId: string | null = null;
    if (lead && typeof lead.source_post_id === "string") {
      const raw = lead.source_post_id.trim();
      if (raw && !isSyntheticKontaktSourceId(raw)) {
        resolvedPostId = raw;
      }
    }

    if (resolvedPostId && spOk) {
      const { data: postExists } = await admin.from("social_posts").select("id").eq("id", resolvedPostId).maybeSingle();
      if (!postExists?.id) {
        console.log("[ORDER_ATTRIBUTION_SKIP]", {
          reason: "source_post_not_in_social_posts",
          postId: resolvedPostId,
          rid: opts.rid,
        });
        resolvedPostId = null;
      }
    } else if (resolvedPostId && !spOk) {
      resolvedPostId = null;
    }

    if (resolvedPostId && !existingSocial) {
      const { error: updErr } = await admin.from("orders").update({ social_post_id: resolvedPostId }).eq("id", orderId);
      if (updErr) {
        console.error("[ORDER_SOCIAL_POST_UPDATE]", updErr.message, { rid: opts.rid, orderId });
      } else {
        console.log("[ORDER_CREATED]", {
          postId: resolvedPostId,
          leadId: lead && typeof lead.id === "string" ? lead.id : null,
          orderId,
          rid: opts.rid,
        });
      }
    } else if (resolvedPostId && existingSocial) {
      console.log("[ORDER_ATTRIBUTION_LEAD_SKIPPED]", {
        reason: "social_post_id_already_set",
        orderId,
        rid: opts.rid,
      });
    }

    const { data: finalOrder } = await admin
      .from("orders")
      .select("social_post_id, line_total")
      .eq("id", orderId)
      .maybeSingle();

    const postIdForMetrics =
      typeof finalOrder?.social_post_id === "string" && finalOrder.social_post_id.trim()
        ? finalOrder.social_post_id.trim()
        : null;
    const revenueAmount = finalOrder ? parseLineTotal(finalOrder as { line_total?: unknown }) : amount;

    if (postIdForMetrics && spOk) {
      const { data: spRow, error: spErr } = await admin.from("social_posts").select("content").eq("id", postIdForMetrics).maybeSingle();
      if (spErr || !spRow) {
        console.error("[METRICS_FETCH]", spErr?.message ?? "empty", { postId: postIdForMetrics, rid: opts.rid });
      } else {
        const raw = (spRow as { content?: unknown }).content;
        const base =
          raw && typeof raw === "object" && !Array.isArray(raw)
            ? (raw as Record<string, unknown>)
            : {};

        let content: StandardSocialContentV1;
        if (base.v === 1 && typeof base.metrics === "object" && base.metrics !== null) {
          content = base as unknown as StandardSocialContentV1;
        } else {
          content = {
            v: 1,
            text: typeof base.text === "string" ? base.text : "",
            hashtags: [],
            images: [],
            source: "deterministic",
            platform: "linkedin",
            metrics: { views: 0, clicks: 0, conversions: 0 },
            data: {},
          };
        }

        const m = content.metrics as unknown as Record<string, number>;
        const prevOrders = typeof m.orders === "number" && Number.isFinite(m.orders) ? m.orders : 0;
        const prevRev = typeof m.revenue === "number" && Number.isFinite(m.revenue) ? m.revenue : 0;

        const nextMetrics: Record<string, number> = {
          ...(content.metrics as unknown as Record<string, number>),
          orders: prevOrders + 1,
          revenue: prevRev + revenueAmount,
        };
        const nextContent = { ...content, metrics: nextMetrics as unknown as typeof content.metrics };

        const { error: upErr } = await admin
          .from("social_posts")
          .update({
            content: nextContent as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          } as Record<string, unknown>)
          .eq("id", postIdForMetrics);

        if (upErr) {
          console.error("[METRICS_UPDATED_FAIL]", upErr.message, { postId: postIdForMetrics, rid: opts.rid });
        } else {
          console.log("[METRICS_UPDATED]", { postId: postIdForMetrics, rid: opts.rid, revenueDelta: revenueAmount });
        }
      }
    }

    const logOk = await verifyTable(admin, "ai_activity_log", "apply_lead_order_attr");
    if (logOk && postIdForMetrics) {
      const row = buildAiActivityLogRow({
        action: "order_attributed",
        metadata: {
          postId: postIdForMetrics,
          leadId: lead && typeof lead.id === "string" ? lead.id : null,
          orderId,
          amount: revenueAmount,
          source: "lead_pipeline",
        },
      });
      const { error: logErr } = await admin.from("ai_activity_log").insert({
        ...row,
        rid: opts.rid,
        status: "success" as const,
      } as Record<string, unknown>);
      if (logErr) {
        console.error("[ORDER_ATTRIBUTED_LOG]", logErr.message, { rid: opts.rid });
      }
    }
  } catch (e) {
    console.error("[applyLeadPipelineOrderAttribution]", e instanceof Error ? e.message : String(e), {
      rid: opts.rid,
    });
  }
}
