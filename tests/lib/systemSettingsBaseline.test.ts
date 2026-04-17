import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchSystemSettingsRowMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/system/settingsRepository", () => ({
  fetchSystemSettingsRow: (...args: unknown[]) => fetchSystemSettingsRowMock(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  hasSupabaseAdminConfig: () => false,
  supabaseAdmin: vi.fn(() => ({})),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({})),
}));

vi.mock("@/lib/ops/log", () => ({
  opsLog: vi.fn(),
}));

import { readSystemSettingsBaseline } from "@/lib/system/settings";

describe("readSystemSettingsBaseline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns row_missing baseline with fail-closed defaults", async () => {
    fetchSystemSettingsRowMock.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await readSystemSettingsBaseline({
      sb: {} as never,
      source: "request_scope",
    });

    expect(result.baseline.status).toBe("row_missing");
    expect(result.settings.toggles.enforce_cutoff).toBe(true);
    expect(result.settings.killswitch.orders).toBe(false);
    expect(result.baseline.operatorMessage).toContain("system_settings-raden mangler");
  });

  it("returns table_missing baseline when repository reports missing table", async () => {
    fetchSystemSettingsRowMock.mockResolvedValue({
      data: null,
      error: {
        code: "42P01",
        message: 'relation "system_settings" does not exist',
      },
    });

    const result = await readSystemSettingsBaseline({
      sb: {} as never,
      source: "service_role",
    });

    expect(result.baseline.status).toBe("table_missing");
    expect(result.baseline.source).toBe("service_role");
    expect(result.baseline.operatorAction).toContain("public.system_settings");
    expect(result.settings.retention.orders_months).toBe(18);
  });

  it("returns ready baseline for persisted settings row", async () => {
    fetchSystemSettingsRowMock.mockResolvedValue({
      data: {
        toggles: { employee_self_service: false },
        killswitch: { orders: true },
        retention: { orders_months: 12, audit_years: 3 },
        updated_at: "2026-03-01T10:00:00.000Z",
        updated_by: "user-1",
      },
      error: null,
    });

    const result = await readSystemSettingsBaseline({
      sb: {} as never,
      source: "request_scope",
    });

    expect(result.baseline.status).toBe("ready");
    expect(result.settings.toggles.employee_self_service).toBe(false);
    expect(result.settings.killswitch.orders).toBe(true);
    expect(result.settings.retention.orders_months).toBe(12);
    expect(result.settings.updated_by).toBe("user-1");
  });
});
