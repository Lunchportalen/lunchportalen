import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { lpOrderSet } from "@/lib/orders/rpcWrite";

function makeRid() {
  return crypto.randomUUID();
}

function bad(rid: string, code: string, message: string, status = 400, detail?: any) {
  return NextResponse.json(
    { ok: false, rid, error: { code, message, detail: detail ?? null } },
    { status, headers: { "cache-control": "no-store" } }
  );
}

function ok(rid: string, data: any, status = 200) {
  return NextResponse.json({ ok: true, rid, data }, { status, headers: { "cache-control": "no-store" } });
}

function mustISODate(s: string) {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s);
}

export async function POST(req: NextRequest) {
  const rid = makeRid();
  const routeName = "POST /api/orders/upsert";

  const idemKey = req.headers.get("Idempotency-Key")?.trim() ?? "";
  if (idemKey.length < 8) return bad(rid, "IDEMPOTENCY_REQUIRED", "Idempotency-Key header mangler eller er for kort.", 400);

  const supabase = await supabaseServer();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) return bad(rid, "AUTH_REQUIRED", "Du mÃ¥ vÃ¦re innlogget.", 401);

  {
    const { data: rl, error: rlErr } = await supabase.rpc("rate_limit_allow", {
      p_action: "orders_upsert",
      p_limit: 6,
      p_window_seconds: 60,
    });
    if (rlErr) return bad(rid, "RATE_LIMIT_CHECK_FAILED", "Kunne ikke sjekke rate limit.", 500, { message: rlErr.message });

    const row = Array.isArray(rl) ? rl[0] : rl;
    if (!row?.allowed) {
      return bad(rid, "RATE_LIMITED", "For mange forespÃ¸rsler. PrÃ¸v igjen straks.", 429, {
        retry_after_seconds: row?.retry_after_seconds ?? 30,
      });
    }
  }

  {
    const { data: cached, error: idemErr } = await supabase.rpc("idem_get", { p_route: routeName, p_key: idemKey });
    if (idemErr) return bad(rid, "IDEMPOTENCY_LOOKUP_FAILED", "Kunne ikke slÃ¥ opp idempotency.", 500, { message: idemErr.message });
    const row = Array.isArray(cached) ? cached[0] : cached;
    if (row?.found) {
      return NextResponse.json(row.response, { status: row.status_code, headers: { "cache-control": "no-store" } });
    }
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return bad(rid, "BAD_JSON", "Ugyldig JSON.");
  }

  const date = String(body?.date ?? "").trim();
  const note = body?.note == null ? null : String(body.note);
  const slot = String(body?.slot ?? "lunch").trim() || "lunch";

  if (!mustISODate(date)) return bad(rid, "INVALID_DATE", "Dato mÃ¥ vÃ¦re YYYY-MM-DD.");

  const setRes = await lpOrderSet(supabase as any, {
    p_date: date,
    p_slot: slot,
    p_note: note,
  });

  if (!setRes.ok) {
    const msg = setRes.error?.message ?? "";
    const code =
      msg.includes("CUTOFF_PASSED") ? "CUTOFF_PASSED" :
      msg.includes("AGREEMENT_NOT_ACTIVE") ? "AGREEMENT_NOT_ACTIVE" :
      msg.includes("DELIVERY_DAY_INVALID") ? "DELIVERY_DAY_INVALID" :
      msg.includes("SLOT_INVALID") ? "SLOT_INVALID" :
      msg.includes("EMPLOYEE_NOT_ASSIGNED") ? "EMPLOYEE_NOT_ASSIGNED" :
      "ORDER_UPSERT_FAILED";

    const res = bad(rid, code, "Bestillingen kunne ikke registreres.", 409, { db: msg });
    await supabase.rpc("idem_put", { p_route: routeName, p_key: idemKey, p_status: 409, p_response: await res.clone().json() });
    return res;
  }

  const row = setRes.row ?? null;
  const res = ok(rid, {
    receipt: {
      rid,
      orderId: row?.order_id ?? row?.orderId ?? null,
      status: row?.status ?? null,
      timestamp: new Date().toISOString(),
    },
    order: row ?? null,
  });

  await supabase.rpc("idem_put", { p_route: routeName, p_key: idemKey, p_status: 200, p_response: await res.clone().json() });

  return res;
}
