import { describe, expect, it } from "vitest";

import { MENU_PROFILE_IDS } from "@/lib/menu-profile/types";
import {
  buildProfileWeekSelectionSeed,
  generateProfileWarmDishWeek,
} from "@/lib/provider-menu/generateWeekMenu";
import { buildProfileWarmDishWeekPlanForTests } from "@/lib/provider-menu/profileWarmDishGeneration";

const PROVIDER_ID = "00000000-0000-4000-8000-000000000001";
const WEEK_MONDAY = "2026-06-15";

describe("generateProfileWarmDishWeek — all nine profiles", () => {
  it.each(MENU_PROFILE_IDS)("%s yields five deterministic weekday meals", (profileId) => {
    const plan = buildProfileWarmDishWeekPlanForTests({
      providerId: PROVIDER_ID,
      weekMondayIso: WEEK_MONDAY,
      profileId,
    });

    expect(plan.dates).toHaveLength(5);
    expect(plan.days.filter(Boolean)).toHaveLength(5);
    expect(plan.days.every((day) => day?.source === "profile_bank")).toBe(true);

    const titles = plan.days.map((d) => d?.title ?? "");
    expect(new Set(titles).size).toBe(5);
  });

  it("da/fi/fr/no produce different Monday titles for same provider/week", () => {
    const mondayTitle = (profileId: (typeof MENU_PROFILE_IDS)[number]) =>
      buildProfileWarmDishWeekPlanForTests({
        providerId: PROVIDER_ID,
        weekMondayIso: WEEK_MONDAY,
        profileId,
      }).days[0]?.title;

    const no = mondayTitle("norwegian_company_lunch");
    const da = mondayTitle("danish_office_lunch");
    const fi = mondayTitle("finnish_office_lunch");
    const fr = mondayTitle("french_dejeuner");

    expect(no).toBeTruthy();
    expect(da).not.toBe(no);
    expect(fi).not.toBe(no);
    expect(fr).not.toBe(no);
    expect(new Set([no, da, fi, fr]).size).toBe(4);
  });

  it("is deterministic for identical selection seed", () => {
    const input = {
      providerId: PROVIDER_ID,
      weekMondayIso: WEEK_MONDAY,
      profileId: "swedish_lunch" as const,
    };
    const a = buildProfileWarmDishWeekPlanForTests(input);
    const b = buildProfileWarmDishWeekPlanForTests(input);
    expect(a.days.map((d) => d?.seedKey)).toEqual(b.days.map((d) => d?.seedKey));
  });

  it("returns null days when seed bank is empty (fail-closed fallback path)", () => {
    const plan = generateProfileWarmDishWeek({
      seeds: [],
      weekMondayIso: WEEK_MONDAY,
      selectionSeed: buildProfileWeekSelectionSeed(PROVIDER_ID, WEEK_MONDAY, "norwegian_company_lunch"),
    });
    expect(plan.days.every((day) => day === null)).toBe(true);
  });

  it("skips blocked weekday indices without consuming unique seeds elsewhere incorrectly", () => {
    const plan = generateProfileWarmDishWeek({
      seeds: [
        {
          key: "a",
          profileId: "norwegian_company_lunch",
          market: "NO",
          locale: "nb-NO",
          title: "A",
          suitableForAutoPublish: true,
        },
        {
          key: "b",
          profileId: "norwegian_company_lunch",
          market: "NO",
          locale: "nb-NO",
          title: "B",
          suitableForAutoPublish: true,
        },
      ],
      weekMondayIso: WEEK_MONDAY,
      selectionSeed: "test-seed",
      blockedDayIndices: new Set([0, 2, 4]),
    });

    expect(plan.days[0]).toBeNull();
    expect(plan.days[1]?.title).toBeTruthy();
    expect(plan.days[2]).toBeNull();
    expect(plan.days[3]?.title).toBeTruthy();
    expect(plan.days[4]).toBeNull();
  });
});
