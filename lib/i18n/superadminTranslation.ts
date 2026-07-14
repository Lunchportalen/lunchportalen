// lib/i18n/superadminTranslation.ts
//
// FASE 11 — norsk kontrollspråk for superadmin.
// Utenlandsk innhold (registreringer, avtaler, meldinger, fritekst) speiles
// til norsk med full sporbarhet: original bevart immutabelt, kilde
// (machine/manual), review-tilstand, confidence, tidsstempler og append-only
// hendelseslogg. Maskinoversettelse er ALLTID kun utkast.
//
// OVERSETTES ALDRI (maskeres før MT og gjenopprettes etterpå):
// juridiske identifikatorer, firmanavn (egennavnsmønstre håndteres av
// maskeringen der de er strukturelle), fakturanumre, beløp, valutakoder,
// kanoniske statuser (STORE_BOKSTAVER) og audit-/UUID-er.
import "server-only";

import crypto from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { opsLog } from "@/lib/ops/log";

function admin() {
  return supabaseAdmin() as any;
}

export type SuperadminTranslationRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  field_name: string;
  original_language: string;
  original_text: string;
  translated_text_nb: string | null;
  translation_source: "none" | "machine" | "manual";
  review_state: "pending" | "machine_draft" | "reviewed" | "approved";
  confidence: number | null;
  translated_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

/* =========================================================
   Ikke-oversettbare tokens (krav: aldri oversett)
========================================================= */

const NON_TRANSLATABLE_PATTERNS: RegExp[] = [
  // Audit-/entitets-ID-er (UUID)
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  // Fakturanumre (LPK-2026-0001, LPKN-…, F-…, AGR-…)
  /\b(?:LPKN?|AGR|F|KN)-[A-Z0-9-]{3,}\b/g,
  // Beløp med valutakode (1 234,50 EUR / EUR 1,234.50)
  /\b\d[\d\s.,]*\s?(?:NOK|SEK|DKK|EUR|GBP|CHF|PLN|RON|CZK|USD|CAD)\b/g,
  /\b(?:NOK|SEK|DKK|EUR|GBP|CHF|PLN|RON|CZK|USD|CAD)\s?\d[\d\s.,]*\b/g,
  // Valutakoder alene
  /\b(?:NOK|SEK|DKK|EUR|GBP|CHF|PLN|RON|CZK|USD|CAD)\b/g,
  // Juridiske identifikatorer (orgnr/VAT-ID-er)
  /\b(?:NO|SE|DK|FI|GB|DE|FR|ES|IT|NL|BE|CHE|ATU|IE|PL|RO|CZ|PT|GR|EL)[\d.\- ]{7,14}(?:MVA|MWST)?\b/g,
  /\b\d{9}(?:MVA)?\b/g,
  // Kanoniske statuser (2+ ord i CAPS med underscore, eller kjente statusord)
  /\b[A-Z][A-Z_]{3,}\b/g,
  // E-postadresser
  /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g,
];

/** Maskerer ikke-oversettbare tokens: returnerer maskert tekst + token-kart. */
export function protectNonTranslatables(text: string): { masked: string; tokens: Map<string, string> } {
  const tokens = new Map<string, string>();
  let masked = text;
  let n = 0;
  for (const pattern of NON_TRANSLATABLE_PATTERNS) {
    masked = masked.replace(pattern, (match) => {
      const key = `⟦LP${n++}⟧`;
      tokens.set(key, match);
      return key;
    });
  }
  return { masked, tokens };
}

export function restoreNonTranslatables(text: string, tokens: Map<string, string>): string {
  let restored = text;
  for (const [key, original] of tokens) {
    restored = restored.split(key).join(original);
  }
  return restored;
}

/* =========================================================
   Registrering + maskinutkast (draft only)
========================================================= */

function hashText(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Registrerer utenlandsk originaltekst idempotent (per hash) og produserer et
 * norsk MASKINUTKAST når mulig. Norsk originaltekst hoppes over (ingen rad).
 */
export async function ensureNorwegianTranslation(p: {
  entityType: string;
  entityId: string;
  fieldName: string;
  originalText: string;
  originalLanguage: string;
  actor?: string | null;
}): Promise<{ ok: true; id: string | null; created: boolean } | { ok: false; code: string }> {
  const lang = String(p.originalLanguage ?? "").trim().toLowerCase().slice(0, 2);
  const text = String(p.originalText ?? "").trim();
  if (!text) return { ok: false, code: "ORIGINAL_TEXT_REQUIRED" };
  if (!/^[a-z]{2}$/.test(lang)) return { ok: false, code: "ORIGINAL_LANGUAGE_REQUIRED" };
  if (lang === "nb" || lang === "no") return { ok: true, id: null, created: false };

  const a = admin();
  const hash = hashText(text);

  const { data: existing } = await a
    .from("superadmin_translations")
    .select("id")
    .eq("entity_type", p.entityType)
    .eq("entity_id", p.entityId)
    .eq("field_name", p.fieldName)
    .eq("original_text_hash", hash)
    .maybeSingle();
  if (existing?.id) return { ok: true, id: String(existing.id), created: false };

  const { data: row, error } = await a
    .from("superadmin_translations")
    .insert({
      entity_type: p.entityType,
      entity_id: p.entityId,
      field_name: p.fieldName,
      original_language: lang,
      original_text: text,
      original_text_hash: hash,
      translation_source: "none",
      review_state: "pending",
    })
    .select("id")
    .single();
  if (error || !row?.id) return { ok: false, code: String(error?.message ?? "INSERT_FAILED") };

  const id = String(row.id);
  await a.from("superadmin_translation_events").insert({
    translation_id: id,
    action: "created",
    actor_user_id: p.actor ?? null,
    detail: { original_language: lang, field: p.fieldName },
  });

  // Best-effort maskinutkast — feiler stille (raden forblir 'pending').
  await machineDraftTranslation(id).catch(() => null);

  return { ok: true, id, created: true };
}

/**
 * Norsk maskinutkast via plattformens AI-klient. ALLTID kun utkast
 * (review_state=machine_draft) — aldri auto-godkjent. Fail-closed uten nøkkel.
 */
export async function machineDraftTranslation(translationId: string): Promise<{ ok: boolean; code?: string }> {
  const a = admin();
  const { data: row } = await a
    .from("superadmin_translations")
    .select("id, original_text, original_language, review_state")
    .eq("id", translationId)
    .maybeSingle();
  if (!row) return { ok: false, code: "NOT_FOUND" };
  if (row.review_state !== "pending") return { ok: true };

  let client;
  try {
    const { getAIClient } = await import("@/lib/ai/getClient");
    client = getAIClient();
  } catch {
    return { ok: false, code: "AI_NOT_CONFIGURED" };
  }

  const { masked, tokens } = protectNonTranslatables(String(row.original_text));
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Du er en profesjonell oversetter for et norsk driftsteam. Oversett teksten til norsk bokmål. Behold plassholdere på formen ⟦LP0⟧ NØYAKTIG som de er (de representerer identifikatorer, beløp og statuser som aldri skal oversettes). Behold firmanavn og egennavn uendret. Svar kun med oversettelsen.",
        },
        { role: "user", content: `Kildespråk: ${row.original_language}\n\n${masked}` },
      ],
    });
    const translated = String(completion.choices?.[0]?.message?.content ?? "").trim();
    if (!translated) return { ok: false, code: "EMPTY_TRANSLATION" };

    const restored = restoreNonTranslatables(translated, tokens);
    await a
      .from("superadmin_translations")
      .update({
        translated_text_nb: restored,
        translation_source: "machine",
        review_state: "machine_draft",
        confidence: 0.7,
        translated_at: new Date().toISOString(),
      })
      .eq("id", translationId);
    await a.from("superadmin_translation_events").insert({
      translation_id: translationId,
      action: "machine_translated",
      detail: { model: "gpt-4o-mini", masked_tokens: tokens.size },
    });
    return { ok: true };
  } catch (e) {
    opsLog("superadmin.translation.machine_failed", { translationId, detail: String((e as Error)?.message).slice(0, 200) });
    return { ok: false, code: "MACHINE_TRANSLATION_FAILED" };
  }
}

/** Manuell norsk oversettelse (review_state=reviewed, kilde=manual). */
export async function setManualTranslation(p: { translationId: string; translatedText: string; actor: string | null }) {
  const text = String(p.translatedText ?? "").trim();
  if (!text) return { ok: false as const, code: "TRANSLATION_REQUIRED" };
  const a = admin();
  const { error } = await a
    .from("superadmin_translations")
    .update({
      translated_text_nb: text,
      translation_source: "manual",
      review_state: "reviewed",
      confidence: 1,
      translated_at: new Date().toISOString(),
      reviewed_by: p.actor,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", p.translationId);
  if (error) return { ok: false as const, code: String(error.message) };
  await a.from("superadmin_translation_events").insert({
    translation_id: p.translationId,
    action: "manually_translated",
    actor_user_id: p.actor,
  });
  return { ok: true as const };
}

/** Godkjenning krever menneskelig aktør (maskinutkast kan aldri auto-godkjennes). */
export async function approveTranslation(p: { translationId: string; actor: string }) {
  if (!p.actor) return { ok: false as const, code: "REVIEWER_REQUIRED" };
  const a = admin();
  const { error } = await a
    .from("superadmin_translations")
    .update({ review_state: "approved", reviewed_by: p.actor, reviewed_at: new Date().toISOString() })
    .eq("id", p.translationId)
    .not("translated_text_nb", "is", null);
  if (error) return { ok: false as const, code: String(error.message) };
  await a.from("superadmin_translation_events").insert({
    translation_id: p.translationId,
    action: "approved",
    actor_user_id: p.actor,
  });
  return { ok: true as const };
}

export async function listTranslations(filter?: { entityType?: string; entityId?: string }): Promise<SuperadminTranslationRow[]> {
  const a = admin();
  let q = a
    .from("superadmin_translations")
    .select(
      "id, entity_type, entity_id, field_name, original_language, original_text, translated_text_nb, translation_source, review_state, confidence, translated_at, reviewed_at, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter?.entityType) q = q.eq("entity_type", filter.entityType);
  if (filter?.entityId) q = q.eq("entity_id", filter.entityId);
  const { data, error } = await q;
  if (error) throw new Error(`listTranslations failed: ${error.message}`);
  return (data ?? []) as SuperadminTranslationRow[];
}
