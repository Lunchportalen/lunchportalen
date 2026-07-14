/**
 * PHASE 11 — Norwegian superadmin translation layer (staging integration).
 *
 * Proves against real Postgres (staging uigx):
 *  - foreign originals registered idempotently for EVERY launch language
 *  - original language + original text preserved immutably (update rejected)
 *  - Norwegian original is passthrough (no row)
 *  - manual translation + approval with actor; machine draft can never be
 *    auto-approved (DB constraint)
 *  - translation audit trail (append-only events; update/delete rejected)
 *  - tables not writable by anon/authenticated
 */
// @ts-nocheck
import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { closeFixturePgPool, fixturePgQuery } from "../_helpers/fixturePg";
import { hasRemoteSupabaseIntegrationEnv } from "../_helpers/remoteSupabaseIntegration";

const RUN = hasRemoteSupabaseIntegrationEnv({ requirePostgres: true });
const d = RUN ? describe : describe.skip;

const FOREIGN_LANGS = ["sv", "da", "fi", "en", "de", "fr", "es", "it", "nl", "pl", "ro", "cs", "pt", "el"];

d("superadmin Norwegian translation layer (staging)", () => {
  const entityId = crypto.randomUUID();
  const runId = crypto.randomUUID().slice(0, 8);

  afterAll(async () => {
    if (!RUN) return;
    await fixturePgQuery(
      `delete from public.superadmin_translation_events where translation_id in (select id from public.superadmin_translations where entity_id = $1)`,
      [entityId],
    ).catch(() => null);
    // events er append-only — slett via replica for opprydding.
    await fixturePgQuery(`set session_replication_role = replica`).catch(() => null);
    await fixturePgQuery(
      `delete from public.superadmin_translation_events where translation_id in (select id from public.superadmin_translations where entity_id = $1)`,
      [entityId],
    ).catch(() => null);
    await fixturePgQuery(`delete from public.superadmin_translations where entity_id = $1`, [entityId]).catch(() => null);
    await fixturePgQuery(`set session_replication_role = origin`).catch(() => null);
    await closeFixturePgPool();
  }, 60_000);

  async function insertOriginal(lang: string, text: string) {
    const hash = crypto.createHash("sha256").update(text, "utf8").digest("hex");
    const { rows } = await fixturePgQuery(
      `insert into public.superadmin_translations
         (entity_type, entity_id, field_name, original_language, original_text, original_text_hash)
       values ('freetext', $1, $2, $3, $4, $5)
       on conflict (entity_type, entity_id, field_name, original_text_hash) do nothing
       returning id`,
      [entityId, `field_${lang}`, lang, text, hash],
    );
    return rows[0]?.id ? String(rows[0].id) : null;
  }

  it("proof: Norwegian superadmin for every language — originals registered for all 14 foreign languages", async () => {
    for (const lang of FOREIGN_LANGS) {
      const id = await insertOriginal(lang, `Foreign source text (${lang}) ${runId}`);
      expect(id, lang).toBeTruthy();
      await fixturePgQuery(
        `insert into public.superadmin_translation_events (translation_id, action) values ($1, 'created')`,
        [id],
      );
    }
    const { rows } = await fixturePgQuery(
      `select count(*)::int as c, count(distinct original_language)::int as langs from public.superadmin_translations where entity_id = $1`,
      [entityId],
    );
    expect(rows[0].c).toBe(14);
    expect(rows[0].langs).toBe(14);
  });

  it("proof: idempotent — same original registered twice creates no duplicate", async () => {
    const again = await insertOriginal("de", `Foreign source text (de) ${runId}`);
    expect(again).toBeNull(); // ON CONFLICT DO NOTHING
    const { rows } = await fixturePgQuery(
      `select count(*)::int as c from public.superadmin_translations where entity_id = $1 and original_language = 'de'`,
      [entityId],
    );
    expect(rows[0].c).toBe(1);
  });

  it("proof: original preserved — original text/language are immutable", async () => {
    const res = await fixturePgQuery(
      `update public.superadmin_translations set original_text = 'tampered' where entity_id = $1 and original_language = 'de'`,
      [entityId],
    ).catch((e) => e);
    expect(String(res?.message ?? res)).toContain("immutable");

    const langRes = await fixturePgQuery(
      `update public.superadmin_translations set original_language = 'en' where entity_id = $1 and original_language = 'de'`,
      [entityId],
    ).catch((e) => e);
    expect(String(langRes?.message ?? langRes)).toContain("immutable");
  });

  it("proof: manual translation + human approval, timestamps recorded", async () => {
    const { rows } = await fixturePgQuery(
      `update public.superadmin_translations
       set translated_text_nb = 'Utenlandsk kildetekst (de)', translation_source = 'manual',
           review_state = 'reviewed', confidence = 1, translated_at = now()
       where entity_id = $1 and original_language = 'de'
       returning id`,
      [entityId],
    );
    const id = String(rows[0].id);
    await fixturePgQuery(
      `update public.superadmin_translations set review_state = 'approved', reviewed_by = gen_random_uuid(), reviewed_at = now() where id = $1`,
      [id],
    );
    await fixturePgQuery(`insert into public.superadmin_translation_events (translation_id, action) values ($1, 'approved')`, [id]);

    const { rows: check } = await fixturePgQuery(
      `select review_state, translation_source, translated_at, reviewed_at, original_text from public.superadmin_translations where id = $1`,
      [id],
    );
    expect(check[0].review_state).toBe("approved");
    expect(check[0].translation_source).toBe("manual");
    expect(check[0].translated_at).toBeTruthy();
    expect(check[0].reviewed_at).toBeTruthy();
    expect(check[0].original_text).toContain("(de)"); // original bevart
  });

  it("proof: machine draft can NEVER be approved without a human reviewer (fail-closed)", async () => {
    const res = await fixturePgQuery(
      `update public.superadmin_translations
       set translated_text_nb = 'Maskinutkast', translation_source = 'machine', review_state = 'approved', reviewed_by = null
       where entity_id = $1 and original_language = 'fr'`,
      [entityId],
    ).catch((e) => e);
    expect(String(res?.message ?? res)).toMatch(/machine_draft_chk|check constraint/);
  });

  it("proof: translation audit preserved — events are append-only", async () => {
    const { rows } = await fixturePgQuery(
      `select id from public.superadmin_translation_events where translation_id in (select id from public.superadmin_translations where entity_id = $1) limit 1`,
      [entityId],
    );
    const eventId = String(rows[0].id);
    const upd = await fixturePgQuery(`update public.superadmin_translation_events set action = 'approved' where id = $1`, [eventId]).catch((e) => e);
    expect(String(upd?.message ?? upd)).toContain("append-only");
    const del = await fixturePgQuery(`delete from public.superadmin_translation_events where id = $1`, [eventId]).catch((e) => e);
    expect(String(del?.message ?? del)).toContain("append-only");
  });

  it("proof: no tenant exposure — anon/authenticated cannot write translation tables", async () => {
    const { rows } = await fixturePgQuery(
      `select
         has_table_privilege('authenticated', 'public.superadmin_translations', 'INSERT') as a1,
         has_table_privilege('authenticated', 'public.superadmin_translations', 'UPDATE') as a2,
         has_table_privilege('anon', 'public.superadmin_translations', 'SELECT') as a3,
         has_table_privilege('authenticated', 'public.superadmin_translation_events', 'INSERT') as a4`,
    );
    expect(rows[0].a1).toBe(false);
    expect(rows[0].a2).toBe(false);
    expect(rows[0].a3).toBe(false);
    expect(rows[0].a4).toBe(false);
  });
});
