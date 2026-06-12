// Statisk SQL-invariant for migrasjonen som provider-scoper canonical
// lp_company_register (P0 registration correctness):
// - provider resolves KUN server-side via lp_match_provider_by_postal_code
// - fail-closed PROVIDER_NOT_FOUND før noen INSERT
// - provider_id settes på companies, agreements og company_registrations
// - ingen Melhus-fallback, ingen klient-styrt provider-parameter
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATION = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260715120000_lp_company_register_provider_scope.sql",
);

const MELHUS_PROVIDER_ID = "11111111-1111-1111-1111-111111111111";

function loadSql(): string {
  return fs.readFileSync(MIGRATION, "utf8");
}

/** Plukker ut én INSERT INTO <tabell> (...) values (...)-blokk fra funksjonskroppen. */
function insertBlock(sql: string, table: string): string {
  const re = new RegExp(`insert into public\\.${table}\\s*\\(([\\s\\S]*?)\\)\\s*values\\s*\\(([\\s\\S]*?)\\)`, "i");
  const m = sql.match(re);
  expect(m, `INSERT INTO public.${table} ikke funnet i migrasjonen`).toBeTruthy();
  return m![0];
}

describe("lp_company_register provider-scope (migrasjon 20260715120000)", () => {
  test("signaturen er uendret: 9 p_*-parametre, ingen provider-parameter fra klient", () => {
    const sql = loadSql();
    const sig = sql.match(/create or replace function public\.lp_company_register\(([\s\S]*?)\)\s*returns json/i);
    expect(sig).toBeTruthy();
    const params = sig![1];
    const names = [...params.matchAll(/p_[a-z_]+/g)].map((m) => m[0]);
    expect(names).toEqual([
      "p_company_name",
      "p_orgnr",
      "p_employee_count",
      "p_contact_name",
      "p_contact_email",
      "p_contact_phone",
      "p_address_line",
      "p_postal_code",
      "p_postal_city",
    ]);
    expect(params.toLowerCase()).not.toContain("provider");
  });

  test("provider resolves server-side via lp_match_provider_by_postal_code", () => {
    const sql = loadSql();
    expect(sql).toMatch(/v_provider_id\s*:=\s*public\.lp_match_provider_by_postal_code\(v_postal_code\)/i);
  });

  test("fail-closed: PROVIDER_NOT_FOUND kastes FØR alle INSERTs", () => {
    const sql = loadSql();
    const raiseIdx = sql.search(/raise exception 'PROVIDER_NOT_FOUND'/i);
    const firstInsertIdx = sql.search(/insert into public\./i);
    expect(raiseIdx).toBeGreaterThan(-1);
    expect(firstInsertIdx).toBeGreaterThan(-1);
    expect(raiseIdx).toBeLessThan(firstInsertIdx);

    // Guard-mønster: NULL match => exception.
    expect(sql).toMatch(/if v_provider_id is null then\s*raise exception 'PROVIDER_NOT_FOUND';/i);
  });

  test("companies-INSERT setter provider_id fra server-resolved verdi", () => {
    const block = insertBlock(loadSql(), "companies");
    expect(block).toMatch(/provider_id/i);
    expect(block).toMatch(/v_provider_id/);
  });

  test("agreements-INSERT setter provider_id fra server-resolved verdi", () => {
    const block = insertBlock(loadSql(), "agreements");
    expect(block).toMatch(/provider_id/i);
    expect(block).toMatch(/v_provider_id/);
  });

  test("company_registrations-INSERT setter provider_id fra server-resolved verdi", () => {
    const block = insertBlock(loadSql(), "company_registrations");
    expect(block).toMatch(/provider_id/i);
    expect(block).toMatch(/v_provider_id/);
  });

  test("ingen Melhus-fallback: Melhus-UUID/slug finnes ikke i utførbar SQL (kommentarer unntatt)", () => {
    // Strip linjekommentarer (CRLF-safe) — dokumentasjon kan nevne Melhus, koden kan ikke.
    const executable = loadSql()
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.replace(/--.*$/, ""))
      .join("\n")
      .toLowerCase();
    expect(executable).not.toContain(MELHUS_PROVIDER_ID);
    expect(executable).not.toContain("melhus");
  });

  test("retur-kontrakten beholder company_id/status/receipt (+ additivt provider_id)", () => {
    const sql = loadSql();
    expect(sql).toMatch(/'company_id',\s*v_company_id/);
    expect(sql).toMatch(/'status',\s*'PENDING'/);
    expect(sql).toMatch(/'provider_id',\s*v_provider_id/);
    expect(sql).toMatch(/'receipt',\s*json_build_object\('message',\s*'Registreringen er mottatt\.'\)/);
  });
});
