import { describe, expect, test } from "vitest";

import { isValidNorwegianOrgnr } from "@/lib/orgnr/no";
import { providerRegistrationSchema } from "@/lib/providers/registrationSchema";

describe("provider registration schema", () => {
  test("accepts valid payload", () => {
    const res = providerRegistrationSchema.safeParse({
      company_name: "Test AS",
      org_number: "988077917",
      contact_name: "Ola Nordmann",
      contact_email: "ola@test.no",
      contact_phone: "91234567",
      postal_code: "7010",
      city: "Trondheim",
      employees_estimate: 25,
      notes: "",
    });
    expect(res.success).toBe(true);
  });

  test("rejects employee count below 20", () => {
    const res = providerRegistrationSchema.safeParse({
      company_name: "Test AS",
      org_number: "988077917",
      contact_name: "Ola",
      contact_email: "ola@test.no",
      contact_phone: "91234567",
      postal_code: "7010",
      city: "Trondheim",
      employees_estimate: 10,
    });
    expect(res.success).toBe(false);
  });
});

describe("Norwegian orgnr mod11", () => {
  test("validates known control digit pattern", () => {
    expect(isValidNorwegianOrgnr("974760673")).toBe(true);
    expect(isValidNorwegianOrgnr("123456789")).toBe(false);
  });
});
