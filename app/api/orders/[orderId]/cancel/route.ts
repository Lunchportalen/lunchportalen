// app/api/orders/[orderId]/cancel/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { osloTodayISODate } from "@/lib/date/oslo";
import { assertBeforeCutoffForDeliveryDate } from "@/lib/guards/cutoff";
import { supabaseServer } from "@/lib/supabase/server";

// ✅ Konsistent logging + kontekst
function logApiError(scope: string, err: any, extra?: Record<string, any>) {
  try {
    console.error(`[${scope}]`, err?.message || err, { ...extra, err });
  } catch {
    console.error(`[${scope}]`, err?.message || err);
  }
}

function jsonError(
  status: number,
  error: string,
  message: string,
  rid: string,
  extra?: Record<string, any>
) {
  return NextResponse.json(
    { ok: false, error, message, rid, canAct: false, ...extra },
    { status }
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: { orderId: string } }
) {
  const rid = `order_cancel_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  try {
    const orderId = params.orderId;
    if (!orderId) {
      return jsonError(400, "BAD_REQUEST", "orderId mangler", rid);
    }

    const supabase = await supabaseServer();

    // ✅ Auth
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      logApiError("PATCH /orders/[id]/cancel auth failed", userErr, { rid, orderId });
      return jsonError(401, "UNAUTH", "Ikke innlogget", rid);
    }

    // ✅ Hent ordre (for dato + eierskap)
    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("id, date, user_id, status, company_id, location_id")
      .eq("id", orderId)
      .maybeSingle();

    if (oErr) {
      logApiError("PATCH /orders/[id]/cancel lookup failed", oErr, { rid, orderId });
      return jsonError(500, "DB_ERROR", oErr.message, rid);
    }

    if (!order) {
      return jsonError(404, "NOT_FOUND", "Ordre ikke funnet", rid);
    }

    // ✅ Eier-sjekk (ansatt kan kun avbestille egen ordre)
    if (order.user_id !== userRes.user.id) {
      return jsonError(403, "FORBIDDEN", "Du kan kun avbestille egen ordre", rid);
    }

    // ✅ Idempotens: allerede kansellert
    if (order.status === "canceled") {
      return NextResponse.json({
        ok: true,
        rid,
        orderId: order.id,
        date: order.date,
        status: "canceled",
        alreadyCanceled: true,
        canAct: true,
      });
    }

    // ✅ HARD CUTOFF (kun for samme dag)
    assertBeforeCutoffForDeliveryDate("Avbestilling", order.date);

    // ✅ Avbestill = UPDATE status (ikke DELETE)
    const { data: updated, error: uErr } = await supabase
      .from("orders")
      .update({ status: "canceled" }) // enum: active | canceled
      .eq("id", order.id)
      .select("id, date, status, updated_at")
      .single();

    if (uErr) {
      logApiError("PATCH /orders/[id]/cancel update failed", uErr, {
        rid,
        orderId,
        date: order.date,
      });
      return jsonError(500, "DB_ERROR", uErr.message, rid);
    }

    return NextResponse.json({
      ok: true,
      rid,
      orderId: updated.id,
      date: updated.date,
      status: updated.status,
      updatedAt: updated.updated_at,
      canAct: true,
    });
  } catch (err: any) {
    // 🎯 Cutoff-feil (forretningsregel)
    if (err?.code === "CUTOFF") {
      return NextResponse.json(
        {
          ok: false,
          error: "LOCKED_AFTER_0800",
          message: err.message,
          rid,
          date: osloTodayISODate(),
          canAct: false,
        },
        { status: 409 }
      );
    }

    logApiError("PATCH /orders/[id]/cancel failed", err, { rid });
    return jsonError(
      500,
      "SERVER_ERROR",
      err?.message || String(err),
      rid
    );
  }
}
