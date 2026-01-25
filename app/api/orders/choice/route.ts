// app/api/orders/choice/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/* =========================================================
   Response helpers
========================================================= */

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}

function rid() {
  return crypto.randomBytes(8).toString("hex");
}

function jsonErr(status: number, _rid: string, error: string, message: string, detail?: any) {
  return NextResponse.json(
    { ok: false, rid: _rid, error, message, detail: detail ?? undefined },
    { status, headers: noStore() }
  );
}

function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}

/* =========================================================
   Validators / helpers
========================================================= */

function isIsoDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? ""));
}

function safeText(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

// Note-format: "choice:<key>" (kan ligge sammen med andre linjer)
function setChoiceInNote(note: string | null | undefined, choiceKey: string) {
  const lines = String(note ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const rest = lines.filter((l) => !l.toLowerCase().startsWith("choice:"));
  return [`choice:${choiceKey}`, ...rest].join("\n");
}

/* =========================================================
   Route
========================================================= */

export async function POST(req: NextRequest) {
  const _rid = rid();

  // ✅ supabaseServer() hos dere returnerer Promise<SupabaseClient>
  const sb = await supabaseServer();

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return jsonErr(400, _rid, "bad_json", "Ugyldig JSON i forespørsel.");
  }

  const date = safeText(body?.date);
  const choice_key = safeText(body?.choice_key);

  if (!date || !isIsoDate(date)) return jsonErr(400, _rid, "bad_date", "Ugyldig dato.");
  if (!choice_key) return jsonErr(400, _rid, "bad_choice", "Mangler choice_key.");

  // Auth
  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr || !auth?.user) return jsonErr(401, _rid, "unauthorized", "Du er ikke innlogget.");

  const user_id = auth.user.id;

  // Hent profil (company_id)
  const { data: profile, error: profErr } = await sb
    .from("profiles")
    .select("user_id, company_id")
    .eq("user_id", user_id)
    .maybeSingle();

  if (profErr) return jsonErr(500, _rid, "db_profile", "Kunne ikke hente profil.", profErr);
  if (!profile?.company_id) return jsonErr(403, _rid, "no_company", "Mangler firmatilknytning.");

  const company_id = String(profile.company_id);

  // Finn dagens order for bruker+dato (autosave endrer kun valg på eksisterende ACTIVE)
  const { data: order, error: ordErr } = await sb
    .from("orders")
    .select("id, date, status, note, slot")
    .eq("user_id", user_id)
    .eq("company_id", company_id)
    .eq("date", date)
    .maybeSingle();

  if (ordErr) return jsonErr(500, _rid, "db_order", "Kunne ikke hente bestilling.", ordErr);

  if (!order) {
    return jsonErr(409, _rid, "no_order", "Du må bestille lunsj før du kan velge meny.");
  }

  const status = String(order.status ?? "").toUpperCase();
  if (status !== "ACTIVE") {
    return jsonErr(409, _rid, "not_active", "Du må ha aktiv bestilling for å endre menyvalg.");
  }

  const nextNote = setChoiceInNote(order.note, choice_key);

  const { data: updated, error: updErr } = await sb
    .from("orders")
    .update({ note: nextNote })
    .eq("id", order.id)
    .select("id, date, status, note, slot")
    .single();

  if (updErr) return jsonErr(500, _rid, "db_update", "Kunne ikke lagre menyvalg.", updErr);

  return jsonOk({
    ok: true,
    rid: _rid,
    order: {
      id: updated.id,
      date: updated.date,
      status: updated.status,
      note: updated.note,
      slot: updated.slot ?? null,
    },
  });
}
