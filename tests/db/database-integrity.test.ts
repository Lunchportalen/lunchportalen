/**
 * Database integrity tests: FK protection, constraint enforcement, tenant isolation, schema (migration replay).
 * Run with real Supabase when NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set (e.g. CI).
 * Skipped when env is missing so local `npm run test` does not require a DB.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import {
  hasRemoteSupabaseIntegrationEnv,
  readRemoteSupabaseIntegrationEnv,
} from "@/tests/_helpers/remoteSupabaseIntegration";

const hasDb = hasRemoteSupabaseIntegrationEnv();

function adminClient(): SupabaseClient<Database> {
  const { url, serviceKey } = readRemoteSupabaseIntegrationEnv();
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Postgres error codes
const FK_VIOLATION = "23503";
const CHECK_VIOLATION = "23514";
const NOT_NULL_VIOLATION = "23502";

describe("database integrity", () => {
  let admin: SupabaseClient<Database>;

  beforeAll(() => {
    if (!hasDb) return;
    admin = adminClient();
  });

  describe("foreign key protection – orphan records cannot be created", () => {
    test.skipIf(!hasDb)(
      "insert into orders with non-existent company_id fails with FK violation",
      async () => {
        const fakeCompanyId = "00000000-0000-0000-0000-000000000001";
        const fakeLocationId = "00000000-0000-0000-0000-000000000002";
        const fakeUserId = "00000000-0000-0000-0000-000000000003";

        const { data, error } = await admin.from("orders").insert({
          user_id: fakeUserId,
          date: "2026-01-15",
          company_id: fakeCompanyId,
          location_id: fakeLocationId,
          status: "ACTIVE",
          slot: "default",
        }).select("id").single();

        expect(data).toBeNull();
        expect(error).not.toBeNull();
        const code = String((error as any)?.code ?? "");
        expect([FK_VIOLATION, CHECK_VIOLATION].includes(code)).toBe(true);
      },
    );

    test.skipIf(!hasDb)(
      "insert into agreements with non-existent company_id fails with FK violation",
      async () => {
        const fakeCompanyId = "00000000-0000-0000-0000-000000000001";
        const fakeLocationId = "00000000-0000-0000-0000-000000000002";

        const { data, error } = await admin.from("agreements").insert({
          company_id: fakeCompanyId,
          location_id: fakeLocationId,
          status: "PENDING",
          tier: "BASIS",
          delivery_days: ["mon", "tue", "wed", "thu", "fri"],
          slot_start: "11:00",
          slot_end: "13:00",
        }).select("id").single();

        expect(data).toBeNull();
        expect(error).not.toBeNull();
        expect(String((error as any)?.code ?? "")).toBe(FK_VIOLATION);
      },
    );
  });

  describe("constraint enforcement – invalid domain states fail", () => {
    test.skipIf(!hasDb)(
      "insert into outbox with invalid status fails with check constraint",
      async () => {
        const { data, error } = await admin.from("outbox").insert({
          event_key: `test.invalid.status.${Date.now()}`,
          status: "INVALID_STATUS_VALUE",
          attempts: 0,
        }).select("id").single();

        expect(data).toBeNull();
        expect(error).not.toBeNull();
        const code = String((error as any)?.code ?? "");
        expect([CHECK_VIOLATION, NOT_NULL_VIOLATION].includes(code)).toBe(true);
      },
    );

    test.skipIf(!hasDb)(
      "insert into company_deletions with invalid mode fails (check or FK)",
      async () => {
        const { data, error } = await admin.from("company_deletions").insert({
          company_id: "00000000-0000-0000-0000-000000000001",
          deleted_at: new Date().toISOString(),
          counts_json: {},
          mode: "invalid_mode",
        }).select("id").single();

        expect(data).toBeNull();
        expect(error).not.toBeNull();
        // Rejection may be CHECK (invalid mode), FK (missing company), or RLS
        expect((error as any)?.message ?? "").toBeTruthy();
      },
    );
  });

  describe("tenant isolation – invalid tenant access", () => {
    test.skipIf(!hasDb)(
      "anon client without session cannot read orders (RLS denies)",
      async () => {
        const { url, anonKey } = readRemoteSupabaseIntegrationEnv({ requireAnon: true });
        if (!url || !anonKey) return;

        const anon = createClient<Database>(url, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data, error } = await anon.from("orders").select("id").limit(1);

        expect(error).toBeNull();
        expect(Array.isArray(data) ? data.length : 0).toBe(0);
      },
    );

    test.skipIf(!hasDb)(
      "anon client without session cannot read companies (RLS denies)",
      async () => {
        const { url, anonKey } = readRemoteSupabaseIntegrationEnv({ requireAnon: true });
        if (!url || !anonKey) return;

        const anon = createClient<Database>(url, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data, error } = await anon.from("companies").select("id").limit(1);

        expect(error).toBeNull();
        expect(Array.isArray(data) ? data.length : 0).toBe(0);
      },
    );
  });

  describe("migration replay – schema rebuilt correctly", () => {
    const coreTables = ["companies", "company_locations", "profiles", "agreements", "orders", "outbox", "idempotency"];

    test.skipIf(!hasDb)(
      "core tables exist and are queryable after migrations",
      async () => {
        for (const table of coreTables) {
          const { error } = await admin.from(table as keyof Database["public"]["Tables"]).select("*").limit(0);
          expect(error, `table ${table} should exist and be queryable`).toBeNull();
        }
      },
    );
  });
});
