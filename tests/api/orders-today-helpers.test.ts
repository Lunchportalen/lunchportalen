// @ts-nocheck
import { describe, expect, test } from "vitest";
import { parseTodayOrderAction } from "@/app/api/orders/today/route";

describe("orders/today helpers", () => {
  test("parseTodayOrderAction: valid place", () => {
    const today = "2026-02-01";
    const rid = "rid_test";
    const { errorBody, action, note } = parseTodayOrderAction({ action: "place", note: "hello" }, today, rid);
    expect(errorBody).toBeNull();
    expect(action).toBe("place");
    expect(note).toBe("hello");
  });

  test("parseTodayOrderAction: invalid action returns BAD_REQUEST body", async () => {
    const today = "2026-02-01";
    const rid = "rid_test";
    const { errorBody, action } = parseTodayOrderAction({ action: "other" } as any, today, rid);
    expect(action).toBeNull();
    expect(errorBody).toBeDefined();
    const json = errorBody;
    expect(json.ok).toBe(false);
    expect(String(json.error)).toBe("BAD_REQUEST");
  });
});

