// app/superadmin/oversettelser/page.tsx — FASE 11: norsk oversettelsesflate.
// Superadmin håndterer ALT utenlandsk innhold på norsk: original og norsk
// oversettelse side ved side, med kilde, review-tilstand, confidence,
// tidsstempler og full hendelseslogg. Utenlandske provider-registreringer
// registreres automatisk (idempotent) ved sidelast.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { requireSuperadmin } from "@/lib/superadmin/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureNorwegianTranslation, listTranslations } from "@/lib/i18n/superadminTranslation";
import { allLanguageReviewStatuses } from "@/lib/i18n/languageReviewStatus";
import { APP_LOCALES, getLocaleLabel, type AppLocale } from "@/lib/i18n/localeRegistry";
import TranslationReviewClient from "@/components/superadmin/TranslationReviewClient";

function safeLocaleLabel(lang: string): string {
  return (APP_LOCALES as readonly string[]).includes(lang) ? getLocaleLabel(lang as AppLocale) : lang;
}

const SOURCE_LABELS: Record<string, string> = {
  none: "Ingen oversettelse ennå",
  machine: "Maskinutkast",
  manual: "Manuell",
};

const REVIEW_LABELS: Record<string, string> = {
  pending: "Venter",
  machine_draft: "Maskinutkast — krever review",
  reviewed: "Manuelt oversatt",
  approved: "Godkjent",
};

const ENTITY_LABELS: Record<string, string> = {
  provider_registration: "Leverandørregistrering",
  company_registration: "Firmaregistrering",
  agreement: "Avtale",
  message: "Melding",
  freetext: "Fritekst",
};

export default async function SuperadminTranslationsPage() {
  await requireSuperadmin();
  const admin = supabaseAdmin() as any;

  // Idempotent registrering av utenlandske provider-registreringers fritekst.
  const { data: foreignRegs } = await admin
    .from("provider_registrations")
    .select("id, company_name, operating_language, coverage_wish, created_at")
    .not("operating_language", "in", '("nb","no")')
    .order("created_at", { ascending: false })
    .limit(50);
  for (const reg of (foreignRegs ?? []) as any[]) {
    const wish = String(reg.coverage_wish ?? "").trim();
    if (wish) {
      await ensureNorwegianTranslation({
        entityType: "provider_registration",
        entityId: String(reg.id),
        fieldName: "coverage_wish",
        originalText: wish,
        originalLanguage: String(reg.operating_language ?? ""),
      }).catch(() => null);
    }
  }

  const [translations, { data: events }] = await Promise.all([
    listTranslations(),
    admin
      .from("superadmin_translation_events")
      .select("translation_id, action, created_at")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);
  const eventsByTranslation = new Map<string, Array<{ action: string; created_at: string }>>();
  for (const e of ((events ?? []) as any[]).reverse()) {
    const list = eventsByTranslation.get(String(e.translation_id)) ?? [];
    list.push({ action: String(e.action), created_at: String(e.created_at) });
    eventsByTranslation.set(String(e.translation_id), list);
  }

  const reviewStatuses = allLanguageReviewStatuses();
  const df = new Intl.DateTimeFormat("nb-NO", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pt-[27px]">
      <h1 className="text-2xl font-semibold tracking-tight">Oversettelser</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Utenlandsk innhold vist på norsk med original bevart. Maskinoversettelse er alltid kun utkast — godkjenning
        krever menneskelig review. Identifikatorer, firmanavn, fakturanumre, beløp, valutakoder og statuser oversettes
        aldri.
      </p>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Utenlandsk innhold</h2>
        {translations.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-neutral-50 px-4 py-6 text-sm text-neutral-600">
            Ingen utenlandske tekster registrert ennå.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {translations.map((t) => (
              <li key={t.id} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-neutral-900">
                    {ENTITY_LABELS[t.entity_type] ?? t.entity_type} · {t.field_name} ·{" "}
                    {safeLocaleLabel(t.original_language)}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {SOURCE_LABELS[t.translation_source]} ·{" "}
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-semibold">
                      {REVIEW_LABELS[t.review_state] ?? t.review_state}
                    </span>
                    {typeof t.confidence === "number" ? ` · konfidens ${(Number(t.confidence) * 100).toFixed(0)} %` : ""} ·{" "}
                    {df.format(new Date(t.created_at))}
                  </span>
                </div>

                {/* Side-ved-side: original og norsk oversettelse. */}
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-neutral-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Original ({t.original_language})
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-900">{t.original_text}</p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Norsk</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-900">
                      {t.translated_text_nb ?? <span className="text-neutral-400">Ikke oversatt ennå.</span>}
                    </p>
                  </div>
                </div>

                <TranslationReviewClient
                  translationId={t.id}
                  reviewState={t.review_state}
                  hasTranslation={Boolean(t.translated_text_nb)}
                />

                {eventsByTranslation.has(t.id) ? (
                  <p className="mt-2 text-xs text-neutral-500">
                    Audit:{" "}
                    {eventsByTranslation
                      .get(t.id)!
                      .map((e) => `${e.action} ${df.format(new Date(e.created_at))}`)
                      .join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Språkstatus (15 grunnspråk)</h2>
        <p className="mt-1 text-sm text-neutral-600">Native- og legal-review per katalog. Kilde: messages/review-status.json.</p>
        <ul className="mt-3 space-y-1">
          {Object.entries(reviewStatuses).map(([lang, s]) => (
            <li key={lang} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-100 bg-white px-3 py-2 text-sm">
              <span className="font-semibold">{safeLocaleLabel(lang)}</span>
              <span className="text-xs text-neutral-600">
                Native: <span className="font-semibold">{s.nativeReview}</span> · Legal:{" "}
                <span className="font-semibold">{s.legalReview}</span>
                {s.reviewedAt ? ` · ${s.reviewedAt}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
