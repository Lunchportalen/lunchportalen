import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runMenuWeekOpeningEmailNotify } from "@/lib/notifications/menuWeekOpeningNotify";
import { osloWallInstant } from "./osloTestClock";

const sendLogRows = new Set<string>();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "companies") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [{ id: "co1" }], error: null }),
          }),
        };
      }
      if (table === "agreements") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [{ company_id: "co1" }], error: null }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              not: () => ({
                not: () =>
                  Promise.resolve({
                    data: [{ id: "u1", email: "emp@test.no", company_id: "co1", role: "employee" }],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected admin table ${table}`);
    },
  }),
}));

vi.mock("@/lib/supabase/adminAny", () => ({
  adminDb: async () => ({
    from: (table: string) => {
      if (table === "employee_notification_preferences") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      }
      if (table === "menu_week_opening_send_log") {
        return {
          select: () => ({
            eq: () => ({
              eq: () =>
                Promise.resolve({
                  data: [...sendLogRows].map((userId) => ({ user_id: userId })),
                  error: null,
                }),
            }),
          }),
          insert: (row: { user_id: string }) => {
            if (sendLogRows.has(row.user_id)) {
              return Promise.resolve({ error: { code: "23505", message: "duplicate" } });
            }
            sendLogRows.add(row.user_id);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected adminAny table ${table}`);
    },
  }),
}));

vi.mock("@/lib/orderBackup/smtp", () => ({
  sendMail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/menu/providerMenuScope", () => ({
  resolveProviderMenuScopeForCompany: vi.fn().mockResolvedValue({
    ok: true,
    scope: { providerId: "pid", providerSlug: "melhus-catering" },
  }),
}));

vi.mock("@/lib/provider-menu/loadProviderMenuDays", () => ({
  loadProviderMenuDaysForDates: vi.fn().mockResolvedValue([
    { category: "varmrett", tier: "BASIS", mealTitle: "Kyllinggryte" },
  ]),
}));

describe("weekMenuPublishChain — notify send-log idempotency", () => {
  beforeEach(() => {
    sendLogRows.clear();
    vi.useFakeTimers();
    vi.setSystemTime(osloWallInstant("2026-03-26", 14, 5, "+01:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("første kjøring sender + logger; andre kjøring idempotent (skippedAlready)", async () => {
    const first = await runMenuWeekOpeningEmailNotify(new Date());
    expect(first.sent).toBe(1);
    expect(first.skippedAlready).toBe(0);
    expect(first.eventKey).toBe("2026-04-06");
    expect(first.weekMonday).toBe("2026-04-06");

    const second = await runMenuWeekOpeningEmailNotify(new Date());
    expect(second.sent).toBe(0);
    expect(second.skippedAlready).toBe(1);
    expect(second.attempted).toBe(0);
  });
});
