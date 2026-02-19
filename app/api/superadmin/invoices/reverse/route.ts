export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function isCreditNoteFlowEnabled(): boolean {
  return safeStr(process.env.TRIPLETEX_ENABLE_CREDIT_NOTE_FLOW).toLowerCase() === "true";
}

function readReference(req: NextRequest): string {
  const url = new URL(req.url);
  const queryReference = safeStr(url.searchParams.get("reference"));
  return queryReference;
}

export async function POST(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return s?.response ?? s?.res;

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.invoices.reverse.POST", ["superadmin"]);
  if (deny) return deny;

  const reference = readReference(req);
  if (!reference) return jsonErr(ctx.rid, "reference er paakrevd.", 400, "BAD_REQUEST");

  const admin = supabaseAdmin();

  try {
    const { data: line, error: lineError } = await admin
      .from("invoice_lines")
      .select("reference,locked,export_status")
      .eq("reference", reference)
      .maybeSingle();

    if (lineError) {
      return jsonErr(ctx.rid, "Kunne ikke lese fakturalinje.", 500, {
        code: "INVOICE_LINE_LOOKUP_FAILED",
        detail: { message: safeStr(lineError?.message ?? lineError) },
      });
    }

    if (!line) {
      return jsonErr(ctx.rid, "Fant ikke fakturalinje.", 404, "NOT_FOUND");
    }

    if (!Boolean((line as any).locked)) {
      return jsonOk(ctx.rid, {
        reference,
        reversed: false,
        reason: "NOT_LOCKED",
      });
    }

    if (!isCreditNoteFlowEnabled()) {
      return jsonErr(
        ctx.rid,
        "Reversal er blokkert: kreditnota-flyt er ikke aktivert. Eksportert periode forblir laast.",
        409,
        "CREDIT_NOTE_FLOW_NOT_ENABLED"
      );
    }

    const eventKey = `invoice.reverse:${reference}`;
    const { error: enqueueError } = await admin.from("outbox").upsert(
      {
        event_key: eventKey,
        payload: {
          event: "invoice.reverse",
          reference,
          requestedAt: new Date().toISOString(),
          requestedBy: safeStr(ctx?.scope?.userId),
        },
        status: "PENDING",
        attempts: 0,
        last_error: null,
        locked_at: null,
        locked_by: null,
      },
      { onConflict: "event_key" }
    );

    if (enqueueError) {
      return jsonErr(ctx.rid, "Kunne ikke enqueue reversal i outbox.", 500, {
        code: "OUTBOX_ENQUEUE_FAILED",
        detail: { message: safeStr(enqueueError?.message ?? enqueueError) },
      });
    }

    return jsonOk(ctx.rid, {
      reference,
      reversed: true,
      queued: true,
      event_key: eventKey,
    });
  } catch (error: any) {
    return jsonErr(ctx.rid, "Reversal feilet.", 500, {
      code: "INVOICE_REVERSE_FAILED",
      detail: { message: safeStr(error?.message ?? error) },
    });
  }
}
