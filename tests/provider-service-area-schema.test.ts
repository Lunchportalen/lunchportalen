import { describe, expect, test } from "vitest";

import { serviceAreaFormSchema } from "@/lib/providers/serviceAreaSchema";

describe("serviceAreaFormSchema", () => {
  test("accepts valid range", () => {
    const res = serviceAreaFormSchema.safeParse({
      city: "Trondheim",
      postal_code_from: "8000",
      postal_code_to: "8099",
      min_employees: 20,
      max_employees: null,
      available_days: ["mon", "tue", "wed", "thu", "fri"],
      active: true,
    });
    expect(res.success).toBe(true);
  });

  test("rejects from > to", () => {
    const res = serviceAreaFormSchema.safeParse({
      city: "Trondheim",
      postal_code_from: "8099",
      postal_code_to: "8000",
      available_days: ["mon"],
      active: true,
    });
    expect(res.success).toBe(false);
  });
});
