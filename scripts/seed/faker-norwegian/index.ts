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

/** ASCII-only slug for Auth-safe email local parts (Supabase rejects æøå in local-part). */
export function asciiSlug(value: string): string {
  const folded = value
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a");
  return folded.replace(/[^a-z0-9]/g, "").slice(0, 24);
}

/** B4.1+ global user index in email (F1 uses index 0-9 identically via helloEmail). */
export function dryRunEmail(globalIndex: number, firstName: string, lastName: string): string {
  return helloEmail(globalIndex, firstName, lastName);
}

export function helloEmail(index: number, firstName: string, lastName: string): string {
  const fn = asciiSlug(firstName);
  const ln = asciiSlug(lastName);
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

export type DryRunUserSpec = HelloUserSpec & {
  globalIndex: number;
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
  return deterministicEntityId("hello-company-entity");
}

export function helloLocationId(): string {
  return deterministicEntityId("hello-location-entity");
}

export function dryRunCompanyId(companyIndex: number): string {
  return deterministicEntityId(`dry-run-company-${companyIndex}`);
}

export function dryRunLocationId(companyIndex: number): string {
  return deterministicEntityId(`dry-run-location-${companyIndex}`);
}

/**
 * All dry-run users: global 0-9 match F1 hello users; 10..N-1 continue Faker stream.
 */
export function buildDryRunUsers(totalUsers: number): DryRunUserSpec[] {
  const helloUsers = buildHelloUsers();
  const users: DryRunUserSpec[] = helloUsers.map((u) => ({
    ...u,
    globalIndex: u.index,
  }));

  for (let g = HELLO_USER_COUNT; g < totalUsers; g++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = dryRunEmail(g, firstName, lastName);
    users.push({
      index: g,
      globalIndex: g,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email,
      phone: stagingPhone(g + 1),
      role: "employee",
      userId: deterministicUserId(email),
    });
  }

  return users;
}

export function companyDataForIndex(companyIndex: number): {
  name: string;
  orgnr: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  postalCode: string;
  city: string;
} {
  faker.seed(FAKER_SEED + companyIndex * 10_000);
  const name = faker.company.name();
  const contactName = faker.person.fullName();
  return {
    name,
    orgnr: faker.string.numeric(9),
    contactName,
    contactEmail: `company.${companyIndex}@staging.lunchportalen.test`,
    contactPhone: stagingPhone(companyIndex + 1),
    address: faker.location.streetAddress(),
    postalCode: faker.location.zipCode("####"),
    city: faker.location.city(),
  };
}

export function dryRunLocationLabel(companyIndex: number): string {
  return companyIndex === 0 ? helloLocationName() : `Lokasjon ${companyIndex + 1}`;
}

function deterministicEntityId(seedKey: string): string {
  return deterministicUserId(seedKey);
}
