import { describe, it, expect } from "vitest";

import {
  minDagDayBookableLabelNb,
  minDagLockExplanationNb,
  minDagOwnLunchLabelNb,
} from "@/lib/employee/minDagStatusNb";

describe("minDagLockExplanationNb", () => {
  it("forklarer cut-off", () => {
    expect(minDagLockExplanationNb("CUTOFF", null)).toContain("Cut-off");
  });

  it("forklarer stengt dato", () => {
    expect(minDagLockExplanationNb("CLOSED_DATE", null)).toContain("closed_dates");
  });

  it("bruker avtaletekst for COMPANY når den finnes", () => {
    expect(minDagLockExplanationNb("COMPANY", "Venter aktivering")).toContain("Venter aktivering");
  });
});

describe("minDagOwnLunchLabelNb", () => {
  it("registrert når aktiv", () => {
    expect(minDagOwnLunchLabelNb({ wantsLunch: true, orderStatus: null, isLocked: false })).toContain("registrert");
  });

  it("kansellert", () => {
    expect(minDagOwnLunchLabelNb({ wantsLunch: false, orderStatus: "CANCELLED", isLocked: false })).toContain("kansellert");
  });
});

describe("minDagDayBookableLabelNb", () => {
  it("åpen når enabled og ulåst", () => {
    expect(minDagDayBookableLabelNb(true, false)).toContain("åpen");
  });
});
