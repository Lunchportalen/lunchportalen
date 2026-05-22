import { describe, expect, test } from "vitest";

import { extractOutboxClaimIds } from "@/lib/outbox/claimIds";

describe("extractOutboxClaimIds (TPT-B-7b-hotfix-6)", () => {
  test("claimes rows with uuid string ids", () => {
    const ids = extractOutboxClaimIds([
      { id: "0097d484-58db-489e-aa78-42eef21f531e" },
      { id: "742c7d6c-3632-4362-a665-da0e415aab8c" },
    ]);

    expect(ids).toEqual([
      "0097d484-58db-489e-aa78-42eef21f531e",
      "742c7d6c-3632-4362-a665-da0e415aab8c",
    ]);
  });

  test("claimes rows with bigint numeric ids (backwards compat)", () => {
    const ids = extractOutboxClaimIds([{ id: 42 }, { id: 9007199254740991 }]);

    expect(ids).toEqual([42, 9007199254740991]);
  });

  test("filters invalid ids from mixed batches", () => {
    const ids = extractOutboxClaimIds([
      { id: "valid-uuid" },
      { id: "" },
      { id: "   " },
      { id: Number.NaN },
      { id: null },
      { id: 7 },
    ]);

    expect(ids).toEqual(["valid-uuid", 7]);
  });

  test("legacy Number(uuid) coercion would drop all rows", () => {
    const rows = [{ id: "0097d484-58db-489e-aa78-42eef21f531e" }];
    const legacy = rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
    const fixed = extractOutboxClaimIds(rows);

    expect(legacy).toEqual([]);
    expect(fixed).toHaveLength(1);
  });
});
