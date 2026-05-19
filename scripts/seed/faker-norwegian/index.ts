/**
 * Norwegian Faker wrapper — deterministic seed for reproducible staging data.
 */
import { createHash } from "node:crypto";
import { fakerNB_NO as faker } from "@faker-js/faker";

export const FAKER_SEED = 42;
export const HELLO_USER_COUNT = 10;

faker.seed(FAKER_SEED);

export function resetFakerSeed(): void {
  faker.seed(FAKER_SEED);
}

export function helloEmail(index: number, firstName: string, lastName: string): string {
  const fn = firstName
    .toLowerCase()
    .replace(/[^a-zæøå]/gi, "")
    .slice(0, 24);
  const ln = lastName
    .toLowerCase()
    .replace(/[^a-zæøå]/gi, "")
    .slice(0, 24);
  return `hello.${fn}.${ln}${index}@staging.lunchportalen.test`;
}

/** Test MSISDN prefix +47 20 00 — not a real subscriber number. */
export function stagingPhone(index: number): string {
  const a = String(index).padStart(2, "0").slice(-2);
  const b = String((index * 7 + 11) % 100)
    .padStart(2, "0")
    .slice(-2);
  return `+47 20 00 ${a} ${b}`;
}

export function helloCompany(): {
  name: string;
  orgnr: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  postalCode: string;
  city: string;
} {
  const name = faker.company.name();
  const contactName = faker.person.fullName();
  return {
    name,
    orgnr: faker.string.numeric(9),
    contactName,
    contactEmail: `hello.company@staging.lunchportalen.test`,
    contactPhone: stagingPhone(0),
    address: faker.location.streetAddress(),
    postalCode: faker.location.zipCode("####"),
    city: faker.location.city(),
  };
}

export function helloLocationName(): string {
  return "Hovedkontor";
}

export type HelloUserSpec = {
  index: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  role: "company_admin" | "employee";
  userId: string;
};

export function buildHelloUsers(): HelloUserSpec[] {
  resetFakerSeed();
  const users: HelloUserSpec[] = [];

  for (let i = 0; i < HELLO_USER_COUNT; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = helloEmail(i, firstName, lastName);
    users.push({
      index: i,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email,
      phone: stagingPhone(i + 1),
      role: i === 0 ? "company_admin" : "employee",
      userId: deterministicUserId(email),
    });
  }

  return users;
}

export function deterministicUserId(email: string): string {
  const hash = createHash("sha256").update(`staging-seed:${FAKER_SEED}:${email.toLowerCase()}`).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function helloCompanyId(): string {
  return deterministicUserId("hello-company-entity");
}

export function helloLocationId(): string {
  return deterministicUserId("hello-location-entity");
}
