import { describe, expect, it } from "vitest";

import type { EmployeeOwnLunchHistoryItem } from "@/lib/employee/employeeOwnLunchHistoryTypes";
import {
  countVindusdagerUtenAktivEllerKansellertOrdre,
  sisteOppdaterteOrdreRad,
  summarizePastOrderItemsForProfil,
} from "@/lib/employee/employeeBestillingsprofilSummary";

function row(
  date: string,
  status: string,
  sortAt: string,
  id: string,
): EmployeeOwnLunchHistoryItem {
  return {
    sort_at: sortAt,
    title_nb: "",
    body_nb: "",
    delivery_date_iso: date,
    slot_label_nb: null,
    order_id: id,
    status_upper: status,
  };
}

describe("summarizePastOrderItemsForProfil", () => {
  it("velger seneste rad per dato og teller status", () => {
    const items = [
      row("2026-04-10", "ACTIVE", "2026-04-09T08:00:00Z", "a"),
      row("2026-04-10", "CANCELLED", "2026-04-09T09:00:00Z", "b"),
      row("2026-04-08", "ACTIVE", "2026-04-07T10:00:00Z", "c"),
    ];
    const s = summarizePastOrderItemsForProfil(items);
    expect(s.antallTidligereDagerMedOrdrelinje).toBe(2);
    expect(s.antallRegistrerteDager).toBe(1);
    expect(s.antallKansellerteDager).toBe(1);
    expect(s.sisteRegistrerteLeveringsdato).toBe("2026-04-08");
    expect(s.sisteKansellerteLeveringsdato).toBe("2026-04-10");
  });
});

describe("countVindusdagerUtenAktivEllerKansellertOrdre", () => {
  it("teller bare dager uten aktiv eller kansellert ordre i vindusfelt", () => {
    const n = countVindusdagerUtenAktivEllerKansellertOrdre([
      { wantsLunch: true, orderStatus: "ACTIVE" },
      { wantsLunch: false, orderStatus: "CANCELLED" },
      { wantsLunch: false, orderStatus: null },
      { wantsLunch: false, orderStatus: "" },
    ]);
    expect(n).toBe(2);
  });
});

describe("sisteOppdaterteOrdreRad", () => {
  it("returnerer rad med størst sort_at", () => {
    const r = sisteOppdaterteOrdreRad([
      row("2026-04-01", "ACTIVE", "2026-03-30T08:00:00Z", "x"),
      row("2026-04-02", "ACTIVE", "2026-03-31T12:00:00Z", "y"),
    ]);
    expect(r.delivery_date_iso).toBe("2026-04-02");
    expect(r.sort_at).toContain("2026-03-31");
  });
});
