// app/api/superadmin/translations/route.ts
//
// FASE 11 — superadmin norsk oversettelsesflate (API).
// GET: oversettelsesrader (+ hendelseslogg) for utenlandsk innhold.
// POST: register (idempotent original + maskinutkast), manual (norsk tekst),
// approve (krever menneskelig aktør), retry_machine.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { requireSuperadminApi } from "@/lib/superadmin/auth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  approveTranslation,
  ensureNorwegianTranslation,
  listTranslations,
  machineDraftTranslation,
  setManualTranslation,
} from "@/lib/i18n/superadminTranslation";

export async function GET(req: Request) {
  const rid = makeRid();
  const gate = await requireSuperadminApi();
  if (gate.ok === false) return jsonErr(rid, gate.message, gate.status, "forbidden");

  try {
    const url = new URL(req.url);
    const entityType = url.searchParams.get("entityType") ?? undefined;
    const entityId = url.searchParams.get("entityId") ?? undefined;
    const rows = await listTranslations({ entityType: entityType || undefined, entityId: entityId || undefined });

    const admin = supabaseAdmin() as any;
    const ids = rows.map((r) => r.id);
    const { data: events } = ids.length
      ? await admin
          .from("superadmin_translation_events")
          .select("translation_id, action, actor_user_id, created_at")
          .in("translation_id", ids)
          .order("created_at")
      : { data: [] };

    return jsonOk(rid, { translations: rows, events: events ?? [] });
  } catch (e) {
    return jsonErr(rid, "Kunne ikke hente oversettelser.", 500, { detail: String((e as Error)?.message ?? e) });
  }
}

export async function POST(req: Request) {
  const rid = makeRid();
  const gate = await requireSuperadminApi();
  if (gate.ok === false) return jsonErr(rid, gate.message, gate.status, "forbidden");

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr(rid, "Ugyldig JSON.", 400, "invalid_json");
  }

  const action = String(body.action ?? "").trim();

  try {
    if (action === "register") {
      const res = await ensureNorwegianTranslation({
        entityType: String(body.entityType ?? ""),
        entityId: String(body.entityId ?? ""),
        fieldName: String(body.fieldName ?? ""),
        originalText: String(body.originalText ?? ""),
        originalLanguage: String(body.originalLanguage ?? ""),
        actor: gate.userId,
      });
      if (res.ok === false) return jsonErr(rid, `Registrering feilet: ${res.code}`, 422, res.code);
      return jsonOk(rid, res);
    }

    if (action === "manual") {
      const res = await setManualTranslation({
        translationId: String(body.translationId ?? ""),
        translatedText: String(body.translatedText ?? ""),
        actor: gate.userId,
      });
      if (res.ok === false) return jsonErr(rid, `Oversettelse feilet: ${res.code}`, 422, res.code);
      return jsonOk(rid, res);
    }

    if (action === "approve") {
      const res = await approveTranslation({ translationId: String(body.translationId ?? ""), actor: gate.userId });
      if (res.ok === false) return jsonErr(rid, `Godkjenning feilet: ${res.code}`, 409, res.code);
      return jsonOk(rid, res);
    }

    if (action === "retry_machine") {
      const res = await machineDraftTranslation(String(body.translationId ?? ""));
      if (!res.ok) return jsonErr(rid, `Maskinutkast feilet: ${res.code}`, 409, res.code ?? "failed");
      return jsonOk(rid, res);
    }

    return jsonErr(rid, "Ukjent handling.", 422, "unknown_action");
  } catch (e) {
    return jsonErr(rid, "Uventet feil.", 500, { detail: String((e as Error)?.message ?? e) });
  }
}
