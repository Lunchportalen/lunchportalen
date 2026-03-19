/**
 * Editor-AI metrics persistence: prove that a metrics request results in a real DB write.
 * Run with real Supabase when NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set (e.g. CI).
 * Requires migrations applied (including 20260418000000_ai_activity_log_entity_columns.sql) so ai_activity_log accepts the insert.
 * Skipped when env is missing. Mocks only auth (routeGuard); uses real supabaseAdmin() and ai_activity_log.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasDb = Boolean(url?.trim()) && Boolean(serviceKey?.trim());

function adminClient(): SupabaseClient {
  if (!url || !serviceKey) throw new Error("Missing Supabase env");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type JsonRequestInit = Omit<RequestInit, "body" | "headers"> & {
  headers?: Record<string, string>;
  jsonBody?: unknown;
};

function mkReq(url: string, init?: JsonRequestInit) {
  const { headers = {}, jsonBody, ...rest } = init ?? {};
  const opts: RequestInit = { ...rest, headers: headers as HeadersInit };
  if (jsonBody !== undefined) {
    opts.body = typeof jsonBody === "string" ? jsonBody : JSON.stringify(jsonBody);
    (opts.headers as Record<string, string>)["content-type"] ??= "application/json";
  }
  return new NextRequest(url, opts);
}

const { scopeOr401Mock } = vi.hoisted(() => ({ scopeOr401Mock: vi.fn() }));
vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: vi.fn(() => null),
}));

// Do NOT mock supabase/admin so the route performs a real insert
import { POST as EditorAiMetricsPOST } from "../../app/api/editor-ai/metrics/route";

describe("Editor-AI metrics persistence (real DB)", () => {
  const uniqueEmail = `e2e-editor-ai-metrics-${Date.now()}@test.lunchportalen.no`;

  beforeEach(() => {
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: {
        rid: "rid_e2e_persist",
        route: "/api/editor-ai/metrics",
        method: "POST",
        scope: { role: "superadmin", email: uniqueEmail },
      },
    });
  });

  test.skipIf(!hasDb)(
    "POST editor-ai metrics → row persisted in ai_activity_log with correct action, tool, created_by",
    async () => {
      const ts = new Date().toISOString();
      const req = mkReq("http://localhost/api/editor-ai/metrics", {
        method: "POST",
        jsonBody: {
          type: "ai_action_triggered",
          timestamp: ts,
          feature: "seo_intelligence",
          pageId: null,
        },
      });

      const res = await EditorAiMetricsPOST(req);
      expect(res.status).toBe(200);

      const admin = adminClient();
      const { data: rows, error } = await admin
        .from("ai_activity_log")
        .select("*")
        .eq("action", "editor_ai_metric")
        .order("created_at", { ascending: false })
        .limit(20);

      expect(error).toBeNull();
      expect(Array.isArray(rows)).toBe(true);
      expect(rows!.length).toBeGreaterThanOrEqual(1);

      const row = rows!.find(
        (r) =>
          (r.metadata as Record<string, unknown>)?.timestamp === ts &&
          (r.metadata as Record<string, unknown>)?.feature === "seo_intelligence"
      );
      expect(row).toBeDefined();
      expect(row!.action).toBe("editor_ai_metric");
      expect(row!.page_id).toBeNull();
      expect(row!.entity_type).toBe("system");
      const meta = row!.metadata as Record<string, unknown>;
      expect(meta.feature).toBe("seo_intelligence");
      expect(meta.timestamp).toBe(ts);
      expect(meta.tool).toBe("ai_action_triggered");
    }
  );
});
