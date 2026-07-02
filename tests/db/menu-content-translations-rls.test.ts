/**
 * SMART-1 — RLS + constraint integration for menu_content_translations.
 * Requires RUN_SUPABASE_INTEGRATION_TESTS=1 and migration applied on target DB.
 * Skips when table is not present (pre-migration staging).
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { hashOriginalText } from "@/lib/smart-menu/translationStatus";
import { closeFixturePgPool, fixturePgQuery } from "@/tests/_helpers/fixturePg";
import {
  buildProviderTestFixtures,
  type ProviderTestFixtures,
} from "@/tests/_helpers/providerTestFixtures";
import {
  hasRemoteSupabaseIntegrationEnv,
  readRemoteSupabaseIntegrationEnv,
} from "@/tests/_helpers/remoteSupabaseIntegration";
import { authenticatedClient } from "@/tests/_helpers/supabaseTestClient";

const TABLE = "menu_content_translations";
const CHECK_VIOLATION = "23514";

const hasDb = hasRemoteSupabaseIntegrationEnv({ requireAnon: true, requirePostgres: true });

function rowCount(res: { data: unknown; error: unknown }) {
  if (res.error) return NaN;
  const d = res.data;
  return Array.isArray(d) ? d.length : 0;
}

function sampleTranslationRow(
  providerId: string,
  overrides: Record<string, unknown> = {},
) {
  const originalText = "Påsmurt med ost";
  return {
    provider_id: providerId,
    source_kind: "menu_day_item",
    source_ref: "sanity:fx-meal-1",
    field: "title",
    locale: "en",
    original_text: originalText,
    original_text_hash: hashOriginalText(originalText),
    translated_text: "Open sandwich with cheese",
    status: "draft",
    ...overrides,
  };
}

let pfx: ProviderTestFixtures;
let tableReady = false;

describe.skipIf(!hasDb)("SMART-1 menu_content_translations RLS (integration)", () => {
  beforeAll(async () => {
    const { rows } = await fixturePgQuery(
      `SELECT to_regclass('public.${TABLE}') IS NOT NULL AS ready`,
    );
    tableReady = Boolean(rows[0]?.ready);
    if (!tableReady) return;

    pfx = await buildProviderTestFixtures({
      includeRegistrations: false,
      includeCompanyAdmin: false,
      includeProviderNonAdminRoles: true,
    });

    for (const [providerId, slug] of [
      [pfx.providerA, `fx-provider-a-${pfx.rid}`],
      [pfx.providerB, `fx-provider-b-${pfx.rid}`],
    ] as const) {
      await fixturePgQuery(
        `INSERT INTO public.organizations (id, type, name, slug, status, legacy_source, created_at, updated_at)
         SELECT $1, 'provider'::public.org_type, $2, $2, 'ACTIVE', 'provider', now(), now()
         WHERE NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = $1)`,
        [providerId, slug],
      );
    }
  }, 180_000);

  afterAll(async () => {
    if (pfx?.cleanup) await pfx.cleanup();
    await closeFixturePgPool();
  }, 60_000);

  test("table exists when migration is applied", () => {
    expect(tableReady).toBe(true);
  });

  test.skipIf(!tableReady)("provider_admin can insert own provider translation row", async () => {
    const sb = authenticatedClient(pfx.providerAdminA.accessToken);
    const res = await (sb as any).from(TABLE).insert(sampleTranslationRow(pfx.providerA)).select("id");
    expect(res.error).toBeNull();
    expect(rowCount(res)).toBe(1);
  });

  test.skipIf(!tableReady)("provider_admin cannot insert translation for other provider", async () => {
    const sb = authenticatedClient(pfx.providerAdminA.accessToken);
    const res = await (sb as any).from(TABLE).insert(sampleTranslationRow(pfx.providerB)).select("id");
    expect(res.error).not.toBeNull();
    expect(rowCount(res)).toBe(0);
  });

  test.skipIf(!tableReady)("provider_admin can select own translations only", async () => {
    const sbA = authenticatedClient(pfx.providerAdminA.accessToken);
    const own = await (sbA as any).from(TABLE).select("id").eq("provider_id", pfx.providerA);
    expect(own.error).toBeNull();
    expect(rowCount(own)).toBeGreaterThanOrEqual(1);

    const other = await (sbA as any).from(TABLE).select("id").eq("provider_id", pfx.providerB);
    expect(other.error).toBeNull();
    expect(rowCount(other)).toBe(0);
  });

  test.skipIf(!tableReady)("employee outsider cannot select translations", async () => {
    const sb = authenticatedClient(pfx.outsider.accessToken);
    const res = await (sb as any).from(TABLE).select("id").limit(5);
    expect(res.error).toBeNull();
    expect(rowCount(res)).toBe(0);
  });

  test.skipIf(!tableReady)("anon cannot read translations", async () => {
    const { url, anonKey } = readRemoteSupabaseIntegrationEnv({ requireAnon: true });
    const anon = createClient<Database>(url, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const res = await (anon as any).from(TABLE).select("id").limit(1);
    expect(res.error).toBeNull();
    expect(rowCount(res)).toBe(0);
  });

  test.skipIf(!tableReady)("invalid source_kind rejected by CHECK", async () => {
    const sb = authenticatedClient(pfx.providerAdminA.accessToken);
    const res = await (sb as any).from(TABLE).insert({
      ...sampleTranslationRow(pfx.providerA),
      source_kind: "invalid_kind",
    }).select("id");
    expect(res.error).not.toBeNull();
    expect(String((res.error as { code?: string })?.code ?? "")).toBe(CHECK_VIOLATION);
  });

  test.skipIf(!tableReady)("authenticated provider_admin cannot DELETE translations", async () => {
    const sb = authenticatedClient(pfx.providerAdminA.accessToken);
    const { data: rows } = await (sb as any).from(TABLE).select("id").eq("provider_id", pfx.providerA).limit(1);
    const id = rows?.[0]?.id;
    if (!id) return;
    const del = await (sb as any).from(TABLE).delete().eq("id", id);
    expect(del.error).not.toBeNull();
  });
});
