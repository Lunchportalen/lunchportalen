import { describe, expect, test } from "vitest";
import {
  onlyDigits,
  type CompanyRegistrationFormState,
  validateCompanyRegistrationForm,
} from "@/components/auth/CompanyRegistrationForm";

function validState(): CompanyRegistrationFormState {
  return {
    companyName: "Acme AS",
    orgnr: "123456789",
    employeesCount: "20",
    contactName: "Kontakt Navn",
    contactEmail: "kontakt@example.no",
    contactPhone: "12345678",
    addressLine: "Gate 1",
    postalCode: "7010",
    postalCity: "Trondheim",
    confirmAuthority: true,
  };
}

describe("registration flow smoke", () => {
  test("sanitizes digits deterministically", () => {
    expect(onlyDigits(" 12 3-4ab ")).toBe("1234");
  });

  test("requires authority confirmation before submit", () => {
    const state = validState();
    state.confirmAuthority = false;
    expect(validateCompanyRegistrationForm(state)).toContain("fullmakt");
  });

  test("blocks companies with fewer than 20 employees", () => {
    const state = validState();
    state.employeesCount = "19";
    expect(validateCompanyRegistrationForm(state)).toContain("minst 20");
  });

  test("accepts a valid form state", () => {
    expect(validateCompanyRegistrationForm(validState())).toBeNull();
  });
});
