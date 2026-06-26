/**
 * G5d.3b — RLS + constraint integration for mapping draft table.
 * Requires RUN_SUPABASE_INTEGRATION_TESTS=1 and migration applied on target DB.
 * Skips when table is not present (pre-migration staging).
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
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

const TABLE = "provider_menu_profile_runtime_mapping_drafts";
const CHECK_VIOLATION = "23514";

const hasDb = hasRemoteSupabaseIntegrationEnv({ requireAnon: true, requirePostgres: true });

function rowCount(res: { data: unknown; error: unknown }) {
  if (res.error) return NaN;
  const d = res.data;
  return Array.isArray(d) ? d.length : 0;
}

function sampleDraftRow(providerId: string, userId: string, menuProfileId = "norwegian_company_lunch") {
  return {
    provider_id: providerId,
    menu_profile_id: menuProfileId,
    mapping_version: "g5d.1",
    draft_status: "draft",
    mapping_json: { isRuntimeEnabled: false, isShadowOnly: true },
    unmapped_categories_json: [],
    warm_dish_preview_json: [],
    validation_summary_json: { ok: true },
    created_by: userId,
    updated_by: userId,
  };
}

let pfx: ProviderTestFixtures;
let tableReady = false;

describe.skipIf(!hasDb)("G5d.3b mapping draft RLS (integration)", () => {
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

    await fixturePgQuery(
      `INSERT INTO public.organizations (id, type, name, slug, status, legacy_source, created_at, updated_at)
       SELECT $1, 'provider'::public.org_type, $2, $2, 'ACTIVE', 'provider', now(), now()
       WHERE NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = $1)`,
      [pfx.providerA, `fx-provider-a-${pfx.rid}`],
    );
    await fixturePgQuery(
      `INSERT INTO public.organizations (id, type, name, slug, status, legacy_source, created_at, updated_at)
       SELECT $1, 'provider'::public.org_type, $2, $2, 'ACTIVE', 'provider', now(), now()
       WHERE NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = $1)`,
      [pfx.providerB, `fx-provider-b-${pfx.rid}`],
    );
  }, 180_000);

  afterAll(async () => {
    if (pfx?.cleanup) await pfx.cleanup();
    await closeFixturePgPool();
  }, 60_000);

  test("table exists when migration is applied", () => {
    expect(tableReady).toBe(true);
  });

  test.skipIf(!tableReady)("provider_admin can insert own provider draft", async () => {
    const sb = authenticatedClient(pfx.providerAdminA.accessToken);
    const res = await (sb as any).from(TABLE).insert(
      sampleDraftRow(pfx.providerA, pfx.providerAdminA.user_id),
    ).select("id");
    expect(res.error).toBeNull();
    expect(rowCount(res)).toBe(1);
  });

  test.skipIf(!tableReady)("provider_admin cannot insert draft for other provider", async () => {
    const sb = authenticatedClient(pfx.providerAdminA.accessToken);
    const res = await (sb as any).from(TABLE).insert(
      sampleDraftRow(pfx.providerB, pfx.providerAdminA.user_id),
    ).select("id");
    expect(res.error).not.toBeNull();
    expect(rowCount(res)).toBe(0);
  });

  test.skipIf(!tableReady)("provider_admin can select own drafts only", async () => {
    const sbA = authenticatedClient(pfx.providerAdminA.accessToken);
    const own = await (sbA as any).from(TABLE).select("id").eq("provider_id", pfx.providerA);
    expect(own.error).toBeNull();
    expect(rowCount(own)).toBeGreaterThanOrEqual(1);

    const other = await (sbA as any).from(TABLE).select("id").eq("provider_id", pfx.providerB);
    expect(other.error).toBeNull();
    expect(rowCount(other)).toBe(0);
  });

  test.skipIf(!tableReady)("provider_viewer can select own provider drafts", async () => {
    expect(pfx.providerViewerA).not.toBeNull();
    const sb = authenticatedClient(pfx.providerViewerA!.accessToken);
    const res = await (sb as any).from(TABLE).select("id").eq("provider_id", pfx.providerA);
    expect(res.error).toBeNull();
    expect(rowCount(res)).toBeGreaterThanOrEqual(1);
  });

  test.skipIf(!tableReady)("provider_viewer cannot insert or update drafts", async () => {
    expect(pfx.providerViewerA).not.toBeNull();
    const sb = authenticatedClient(pfx.providerViewerA!.accessToken);
    const insert = await (sb as any).from(TABLE).insert(
      sampleDraftRow(pfx.providerA, pfx.providerViewerA!.user_id),
    ).select("id");
    expect(insert.error).not.toBeNull();

    const { data: rows } = await (sb as any).from(TABLE).select("id").eq("provider_id", pfx.providerA).limit(1);
    const id = rows?.[0]?.id;
    if (!id) return;
    const update = await (sb as any).from(TABLE).update({ notes: "viewer-attempt" }).eq("id", id);
    expect(update.error).not.toBeNull();
  });

  test.skipIf(!tableReady)("employee outsider cannot select drafts", async () => {
    const sb = authenticatedClient(pfx.outsider.accessToken);
    const res = await (sb as any).from(TABLE).select("id").limit(5);
    expect(res.error).toBeNull();
    expect(rowCount(res)).toBe(0);
  });

  test.skipIf(!tableReady)("anon cannot read drafts", async () => {
    const { url, anonKey } = readRemoteSupabaseIntegrationEnv({ requireAnon: true });
    const anon = createClient<Database>(url, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const res = await (anon as any).from(TABLE).select("id").limit(1);
    expect(res.error).toBeNull();
    expect(rowCount(res)).toBe(0);
  });

  test.skipIf(!tableReady)("superadmin can select all provider drafts", async () => {
    const sb = authenticatedClient(pfx.superadmin.accessToken);
    const res = await (sb as any).from(TABLE).select("id").in("provider_id", [pfx.providerA, pfx.providerB]);
    expect(res.error).toBeNull();
    expect(rowCount(res)).toBeGreaterThanOrEqual(1);
  });

  test.skipIf(!tableReady)("invalid menu_profile_id rejected by CHECK", async () => {
    const sb = authenticatedClient(pfx.providerAdminA.accessToken);
    const res = await (sb as any).from(TABLE).insert({
      ...sampleDraftRow(pfx.providerA, pfx.providerAdminA.user_id),
      menu_profile_id: "invalid_profile_key",
    }).select("id");
    expect(res.error).not.toBeNull();
    expect(String((res.error as { code?: string })?.code ?? "")).toBe(CHECK_VIOLATION);
  });

  test.skipIf(!tableReady)("mapping_json must be object", async () => {
    const sb = authenticatedClient(pfx.providerAdminA.accessToken);
    const res = await (sb as any).from(TABLE).insert({
      ...sampleDraftRow(pfx.providerA, pfx.providerAdminA.user_id),
      mapping_json: [],
    }).select("id");
    expect(res.error).not.toBeNull();
    expect(String((res.error as { code?: string })?.code ?? "")).toBe(CHECK_VIOLATION);
  });

  test.skipIf(!tableReady)("authenticated provider_admin cannot DELETE drafts", async () => {
    const sb = authenticatedClient(pfx.providerAdminA.accessToken);
    const { data: rows } = await (sb as any).from(TABLE).select("id").eq("provider_id", pfx.providerA).limit(1);
    const id = rows?.[0]?.id;
    if (!id) return;
    const del = await (sb as any).from(TABLE).delete().eq("id", id);
    expect(del.error).not.toBeNull();
  });
});
