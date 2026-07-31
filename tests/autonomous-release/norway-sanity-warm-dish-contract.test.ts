import { describe, expect, test } from "vitest";

import {
  MELHUS_PROVIDER_REF,
  NORWAY_SANITY_PROJECT_ID,
  buildInlineWarmDishQuery,
  buildWarmDishQueryUrl,
  canonicalWarmDishKey,
  evaluateMirrorTraceability,
  evaluateWarmDishCanonical,
  menuDayDocId,
  resolveSanityProjectId,
} from "../../scripts/autonomous-release/norway-sanity-warm-dish-contract.mjs";

describe("norway-sanity-warm-dish-contract", () => {
  test("resolves canonical project id and ignores wrong-but-valid secrets", () => {
    expect(resolveSanityProjectId("4udoq5d8")).toBe(NORWAY_SANITY_PROJECT_ID);
    expect(resolveSanityProjectId('"4udoq5d8"')).toBe(NORWAY_SANITY_PROJECT_ID);
    expect(resolveSanityProjectId("")).toBe(NORWAY_SANITY_PROJECT_ID);
    expect(resolveSanityProjectId("not a project")).toBe(NORWAY_SANITY_PROJECT_ID);
    // Well-formed wrong project must not win for Norway production E2E.
    expect(resolveSanityProjectId("abcdef12")).toBe(NORWAY_SANITY_PROJECT_ID);
    expect(resolveSanityProjectId("abcdef12", { forceCanonical: false })).toBe("abcdef12");
  });

  test("inline GROQ embeds provider and date (no $params)", () => {
    const q = buildInlineWarmDishQuery("2026-07-31", MELHUS_PROVIDER_REF);
    expect(q).toContain('date>="2026-07-31"');
    expect(q).toContain(`provider._ref=="${MELHUS_PROVIDER_REF}"`);
    expect(q).not.toContain("$from");
    expect(q).not.toContain("$provider");
  });

  test("query URL uses production dataset + published perspective", () => {
    const url = buildWarmDishQueryUrl({ fromDate: "2026-07-31" });
    expect(url).toContain("4udoq5d8.api.sanity.io");
    expect(url).toContain("/data/query/production");
    expect(url).toContain("perspective=published");
    expect(url).not.toContain("$from=");
  });

  test("canonical identity uses document IDs across BASIS/LUXUS/ENTERPRISE", () => {
    const date = "2026-08-03";
    const title = "Korma med røde linser og ris og naan";
    const rows = ["BASIS", "LUXUS", "ENTERPRISE"].map((tier) => ({
      _id: menuDayDocId(date, tier),
      _rev: `rev-${tier}`,
      date,
      planTier: tier,
      mealTitle: title,
      description: title,
      allergens: [],
      providerId: MELHUS_PROVIDER_REF,
      draft: false,
    }));
    const ev = evaluateWarmDishCanonical(rows);
    expect(ev.commonOk).toBe(true);
    expect(ev.sampleDates[0]?.canonicalKey).toBe(canonicalWarmDishKey(date));
    expect(ev.sampleDates[0]?.identity).toBe("sanity_document_id");
    expect(ev.sampleDates[0]?.ids).toEqual([
      menuDayDocId(date, "BASIS"),
      menuDayDocId(date, "LUXUS"),
      menuDayDocId(date, "ENTERPRISE"),
    ]);
  });

  test("title-only mismatch fails even when ids exist", () => {
    const date = "2026-08-03";
    const rows = [
      {
        _id: menuDayDocId(date, "BASIS"),
        date,
        planTier: "BASIS",
        mealTitle: "A",
        providerId: MELHUS_PROVIDER_REF,
      },
      {
        _id: menuDayDocId(date, "LUXUS"),
        date,
        planTier: "LUXUS",
        mealTitle: "B",
        providerId: MELHUS_PROVIDER_REF,
      },
      {
        _id: menuDayDocId(date, "ENTERPRISE"),
        date,
        planTier: "ENTERPRISE",
        mealTitle: "A",
        providerId: MELHUS_PROVIDER_REF,
      },
    ];
    const ev = evaluateWarmDishCanonical(rows);
    expect(ev.commonOk).toBe(false);
    expect(ev.duplicateWarm).toBeGreaterThan(0);
  });

  test("draft leakage fails closed", () => {
    const date = "2026-08-03";
    const rows = ["BASIS", "LUXUS", "ENTERPRISE"].map((tier) => ({
      _id: menuDayDocId(date, tier),
      date,
      planTier: tier,
      mealTitle: "Rett",
      providerId: MELHUS_PROVIDER_REF,
      draft: tier === "BASIS",
    }));
    const ev = evaluateWarmDishCanonical(rows);
    expect(ev.draftLeaks).toBe(1);
    expect(ev.commonOk).toBe(false);
  });

  test("mirror traceability detects orphans and stale titles", () => {
    const date = "2026-08-03";
    const sanityRows = ["BASIS", "LUXUS", "ENTERPRISE"].map((tier) => ({
      _id: menuDayDocId(date, tier),
      date,
      planTier: tier,
      mealTitle: "Korma",
      providerId: MELHUS_PROVIDER_REF,
    }));
    const ok = evaluateMirrorTraceability({
      mirrorDates: [{ service_date: date, provider_id: MELHUS_PROVIDER_REF }],
      sanityRows,
      varmrettSnapshotsByDate: { [date]: "Korma" },
    });
    expect(ok.ok).toBe(true);
    expect(ok.ORPHANED_MENU_MIRRORS).toBe(0);

    const orphan = evaluateMirrorTraceability({
      mirrorDates: [{ service_date: "2026-12-01", provider_id: MELHUS_PROVIDER_REF }],
      sanityRows,
    });
    expect(orphan.ORPHANED_MENU_MIRRORS).toBe(1);

    const stale = evaluateMirrorTraceability({
      mirrorDates: [{ service_date: date, provider_id: MELHUS_PROVIDER_REF }],
      sanityRows,
      varmrettSnapshotsByDate: { [date]: "Gammel tittel" },
    });
    expect(stale.STALE_MENU_MIRRORS).toBe(1);
  });

  test("published perspective regression: empty bank fails", () => {
    const ev = evaluateWarmDishCanonical([]);
    expect(ev.rowCount).toBe(0);
    expect(ev.commonOk).toBe(false);
  });
});
