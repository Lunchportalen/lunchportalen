import { describe, it, expect } from "vitest";

import {
  formatLedgerDeliveryWindowNb,
  formatLedgerPipelineLabelNb,
  summarizeOperativeOrdersForBrief,
} from "@/lib/server/admin/loadCompanyOperationalBrief";
import type { LoadOperativeKitchenOrdersResult } from "@/lib/server/kitchen/loadOperativeKitchenOrders";

describe("formatLedgerDeliveryWindowNb", () => {
  it("formatter vindu når begge finnes", () => {
    expect(formatLedgerDeliveryWindowNb("11:30", "13:00")).toBe("11:30–13:00");
  });

  it("returnerer null når begge mangler", () => {
    expect(formatLedgerDeliveryWindowNb(null, "")).toBe(null);
  });
});

describe("formatLedgerPipelineLabelNb", () => {
  it("prioriterer aktiv ledger", () => {
    expect(formatLedgerPipelineLabelNb("a-uuid", "p-uuid")).toBe("Aktiv ledger-avtale");
  });

  it("viser ventende når aktiv mangler", () => {
    expect(formatLedgerPipelineLabelNb(null, "p-uuid")).toBe("Ventende ledger-avtale (venter superadmin-godkjenning)");
  });

  it("viser tom pipeline", () => {
    expect(formatLedgerPipelineLabelNb(null, null)).toBe("Ingen aktiv eller ventende ledger-avtale");
  });
});

describe("summarizeOperativeOrdersForBrief", () => {
  it("teller slot, lokasjon og notater (samme filterkjede som loadOperativeKitchenOrders)", () => {
    const loaded = {
      ok: true as const,
      raw: [
        {
          id: "o1",
          user_id: "00000000-0000-4000-8000-0000000000aa",
          company_id: "00000000-0000-4000-8000-0000000000bb",
          location_id: "00000000-0000-4000-8000-0000000000cc",
          note: "Allergi",
          status: "ACTIVE",
          slot: "lunch",
        },
        {
          id: "o2",
          user_id: "00000000-0000-4000-8000-0000000000dd",
          company_id: "00000000-0000-4000-8000-0000000000bb",
          location_id: "00000000-0000-4000-8000-0000000000cc",
          note: "",
          status: "ACTIVE",
          slot: null,
        },
      ],
      list0: [
        {
          id: "o1",
          user_id: "00000000-0000-4000-8000-0000000000aa",
          company_id: "00000000-0000-4000-8000-0000000000bb",
          location_id: "00000000-0000-4000-8000-0000000000cc",
          note: "Allergi",
          status: "ACTIVE",
          slot: "lunch",
        },
        {
          id: "o2",
          user_id: "00000000-0000-4000-8000-0000000000dd",
          company_id: "00000000-0000-4000-8000-0000000000bb",
          location_id: "00000000-0000-4000-8000-0000000000cc",
          note: "",
          status: "ACTIVE",
          slot: null,
        },
      ],
      operative: [
        {
          id: "o1",
          user_id: "00000000-0000-4000-8000-0000000000aa",
          company_id: "00000000-0000-4000-8000-0000000000bb",
          location_id: "00000000-0000-4000-8000-0000000000cc",
          note: "Allergi",
          status: "ACTIVE",
          slot: "lunch",
        },
        {
          id: "o2",
          user_id: "00000000-0000-4000-8000-0000000000dd",
          company_id: "00000000-0000-4000-8000-0000000000bb",
          location_id: "00000000-0000-4000-8000-0000000000cc",
          note: "",
          status: "ACTIVE",
          slot: null,
        },
      ],
      dcMap: new Map([
        [
          "00000000-0000-4000-8000-0000000000bb|00000000-0000-4000-8000-0000000000cc|00000000-0000-4000-8000-0000000000dd",
          { choice_key: "basis", note: "Ekstra", updated_at: null, status: "ACTIVE" },
        ],
      ]),
    } satisfies Extract<LoadOperativeKitchenOrdersResult, { ok: true }>;

    const loc = new Map<string, string | null>([
      ["00000000-0000-4000-8000-0000000000cc", "Hovedkontor"],
    ]);
    const s = summarizeOperativeOrdersForBrief(loaded, loc);
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.total_operative).toBe(2);
    expect(s.by_slot.lunch).toBe(2);
    expect(s.by_location[0]?.count).toBe(2);
    expect(s.order_notes_nonempty).toBe(1);
    expect(s.day_choice_notes_nonempty).toBe(1);
    expect(s.missing_scope_excluded).toBe(0);
    expect(s.cancelled_day_choice_excluded).toBe(0);
  });
});
