import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const WEEK_CLIENT = join(process.cwd(), "app", "(app)", "week", "EmployeeWeekClient.tsx");
const ORDER_ACTIONS = join(process.cwd(), "components", "orders", "OrderActions.tsx");

function snippetAround(source: string, needle: string, radius = 520): string {
  const i = source.indexOf(needle);
  expect(i).toBeGreaterThan(-1);
  return source.slice(Math.max(0, i - radius / 2), Math.min(source.length, i + needle.length + radius / 2));
}

describe("POST /api/orders sends Idempotency-Key from UI call-sites", () => {
  test("EmployeeWeekClient: POST headers include stable Idempotency-Key via ensureIdemKey()", () => {
    const src = readFileSync(WEEK_CLIENT, "utf-8");
    expect(src).toContain("idemKeyRef");
    expect(src).toContain("ensureIdemKey");
    const block = snippetAround(src, 'fetch("/api/orders"');
    expect(block).toContain('"Idempotency-Key": ensureIdemKey(idemScope)');
  });

  test("OrderActions: både place og cancel POST inkluderer Idempotency-Key", () => {
    const src = readFileSync(ORDER_ACTIONS, "utf-8");
    expect(src).toContain('import { generateIdempotencyKey } from "@/lib/orders/idempotencyKey"');
    const re = /fetch\("\/api\/orders"/g;
    let count = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const slice = src.slice(m.index, m.index + 700);
      expect(slice).toContain('"Idempotency-Key": generateIdempotencyKey()');
      count += 1;
    }
    expect(count).toBe(2);
  });
});
