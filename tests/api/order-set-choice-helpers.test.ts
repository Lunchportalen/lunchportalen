// @ts-nocheck
import { describe, expect, test, vi } from "vitest";
import { parseSetChoiceBody, validateCutoffAndWeekday } from "@/app/api/order/set-choice/route";

function mkRid() {
  return "rid_test";
}

describe("order/set-choice helpers", () => {
  test("parseSetChoiceBody: valid body", () => {
    const rid = mkRid();
    const result = parseSetChoiceBody({ date: "2026-02-01", choice_key: "salatbar", note: "x" }, rid);
    expect(result).not.toBeInstanceOf(Response);
    expect(result.date).toBe("2026-02-01");
    expect(result.choice_key).toBe("salatbar");
    expect(result.note).toBe("x");
  });

  test("parseSetChoiceBody: invalid date", async () => {
    const rid = mkRid();
    const res = parseSetChoiceBody({ date: "01-02-2026", choice_key: "salatbar" }, rid) as Response;
    expect(res).toBeInstanceOf(Response);
    const json = JSON.parse(await res.text());
    expect(json.ok).toBe(false);
    expect(String(json.error)).toBe("BAD_DATE");
  });

  test("parseSetChoiceBody: missing choice_key", async () => {
    const rid = mkRid();
    const res = parseSetChoiceBody({ date: "2026-02-01" } as any, rid) as Response;
    expect(res).toBeInstanceOf(Response);
    const json = JSON.parse(await res.text());
    expect(json.ok).toBe(false);
    expect(String(json.error)).toBe("MISSING_CHOICE_KEY");
  });
});

describe("validateCutoffAndWeekday", () => {
  test("returns LOCKED when cutoffState says locked", async () => {
    const rid = mkRid();
    const { errorRes } = validateCutoffAndWeekday("2000-01-01", rid);
    if (errorRes) {
      const json = JSON.parse(await errorRes.text());
      expect(json.ok).toBe(false);
      expect(String(json.error)).toBe("LOCKED");
    }
  });
});

