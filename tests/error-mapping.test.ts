import { describe, expect, it } from "vitest";

import { mapOrderWriteError } from "@/lib/orders/mapOrderWriteError";

describe("mapOrderWriteError", () => {
  it("maps 23502 NOT NULL to 422 data_integrity", () => {
    const mapped = mapOrderWriteError({ code: "23502", message: "null value in column provider_id" });
    expect(mapped.status).toBe(422);
    expect(mapped.bodyExtra?.error).toBe("data_integrity");
    expect(mapped.bodyExtra?.code).toBe("NOT_NULL_VIOLATION");
    expect(mapped.errorType).toBe("pg_constraint");
  });

  it("maps 23503 FK violation to 422 constraint_violation", () => {
    const mapped = mapOrderWriteError({ code: "23503", message: "insert or update on table violates foreign key" });
    expect(mapped.status).toBe(422);
    expect(mapped.bodyExtra?.error).toBe("constraint_violation");
    expect(mapped.bodyExtra?.code).toBe("23503");
    expect(mapped.errorType).toBe("pg_constraint");
  });

  it("maps 23505 UNIQUE to 422 constraint_violation", () => {
    const mapped = mapOrderWriteError({ code: "23505", message: "duplicate key value violates unique constraint" });
    expect(mapped.status).toBe(422);
    expect(mapped.bodyExtra?.error).toBe("constraint_violation");
    expect(mapped.bodyExtra?.code).toBe("23505");
    expect(mapped.errorType).toBe("pg_constraint");
  });

  it("maps MENU_NOT_PUBLISHED to 409 menu_not_published", () => {
    const mapped = mapOrderWriteError({ message: "MENU_NOT_PUBLISHED for date 2026-05-29" });
    expect(mapped.status).toBe(409);
    expect(mapped.bodyExtra?.error).toBe("menu_not_published");
    expect(mapped.code).toBe("menu_not_published");
    expect(mapped.errorType).toBe("rpc");
  });

  it("maps MENU_SERVICE_DAY_ITEMS_MISSING to 409 menu_items_missing", () => {
    const mapped = mapOrderWriteError({ message: "MENU_SERVICE_DAY_ITEMS_MISSING" });
    expect(mapped.status).toBe(409);
    expect(mapped.bodyExtra?.error).toBe("menu_items_missing");
    expect(mapped.code).toBe("menu_items_missing");
    expect(mapped.errorType).toBe("rpc");
  });

  it("maps MSD_PROVIDER_UNRESOLVABLE to 422 provider_unresolvable with location_id", () => {
    const loc = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const mapped = mapOrderWriteError({
      message: `MSD_PROVIDER_UNRESOLVABLE: location_id=${loc} har ingen provider via company`,
    });
    expect(mapped.status).toBe(422);
    expect(mapped.bodyExtra?.error).toBe("provider_unresolvable");
    expect(mapped.bodyExtra?.location_id).toBe(loc);
    expect(mapped.errorType).toBe("rpc");
  });
});
