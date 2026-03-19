import { describe, test, expect } from "vitest";
import { requireRoleOr403, type AuthedCtx } from "@/lib/http/routeGuard";

function mkCtx(overrides?: Partial<AuthedCtx>): AuthedCtx {
  return {
    rid: "rid_test_123",
    route: "/api/test",
    method: "GET",
    scope: {
      userId: "u1",
      role: "employee",
      companyId: "c1",
      locationId: "l1",
      email: "user@test.lunchportalen.no",
      sub: "sub_u1",
    },
    ...(overrides ?? {}),
  };
}

async function readBody(res: Response): Promise<any> {
  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch {
    return { raw: txt };
  }
}

/**
 * jsonErr(...) kan ha ulike shapes over tid.
 * Denne extractor’en prøver flere vanlige varianter.
 */
function extractCode(body: any): string | null {
  if (!body || typeof body !== "object") return null;

  // Variant A: { error: "CODE" }
  if (typeof body.error === "string") return body.error;

  // Variant B: { error: { code: "CODE" } }
  if (body.error && typeof body.error === "object" && typeof body.error.code === "string") return body.error.code;

  // Variant C: { code: "CODE" }
  if (typeof (body as any).code === "string") return (body as any).code;

  // Variant D: { error: { message, detail, ... }, ... } but code in meta
  if (body.meta && typeof body.meta === "object" && typeof body.meta.code === "string") return body.meta.code;

  return null;
}

describe("routeGuard: kitchen/driver scope enforcement (TENANT-BOUND)", () => {
  test("kitchen missing companyId -> 403 SCOPE_NOT_ASSIGNED", async () => {
    const ctx = mkCtx({
      scope: {
        userId: "u1",
        role: "kitchen",
        companyId: null,
        locationId: "l1",
        email: "kitchen@test.lunchportalen.no",
        sub: "sub_u1",
      },
    });

    const res = requireRoleOr403(ctx, ["kitchen"]);
    expect(res).not.toBeNull();

    const body = await readBody(res!);
    expect(res!.status).toBe(403);
    expect(extractCode(body)).toBe("SCOPE_NOT_ASSIGNED");
  });

  test("kitchen missing locationId -> 403 SCOPE_NOT_ASSIGNED", async () => {
    const ctx = mkCtx({
      scope: {
        userId: "u1",
        role: "kitchen",
        companyId: "c1",
        locationId: null,
        email: "kitchen@test.lunchportalen.no",
        sub: "sub_u1",
      },
    });

    const res = requireRoleOr403(ctx, ["kitchen"]);
    expect(res).not.toBeNull();

    const body = await readBody(res!);
    expect(res!.status).toBe(403);
    expect(extractCode(body)).toBe("SCOPE_NOT_ASSIGNED");
  });

  test("driver missing companyId/locationId -> 403 SCOPE_NOT_ASSIGNED", async () => {
    const ctx = mkCtx({
      scope: {
        userId: "u1",
        role: "driver",
        companyId: null,
        locationId: null,
        email: "driver@test.lunchportalen.no",
        sub: "sub_u1",
      },
    });

    const res = requireRoleOr403(ctx, ["driver"]);
    expect(res).not.toBeNull();

    const body = await readBody(res!);
    expect(res!.status).toBe(403);
    expect(extractCode(body)).toBe("SCOPE_NOT_ASSIGNED");
  });

  test("kitchen with full scope -> allowed (null)", () => {
    const ctx = mkCtx({
      scope: {
        userId: "u1",
        role: "kitchen",
        companyId: "c1",
        locationId: "l1",
        email: "kitchen@test.lunchportalen.no",
        sub: "sub_u1",
      },
    });

    const res = requireRoleOr403(ctx, ["kitchen"]);
    expect(res).toBeNull();
  });

  test("employee is NOT subject to kitchen/driver scope gate -> allowed (null)", () => {
    const ctx = mkCtx({
      scope: {
        userId: "u1",
        role: "employee",
        companyId: null,
        locationId: null,
        email: "employee@test.lunchportalen.no",
        sub: "sub_u1",
      },
    });

    // employee is allowed here, and scope gate should not fire for employee
    const res = requireRoleOr403(ctx, ["employee"]);
    expect(res).toBeNull();
  });

  test("role not allowed -> 403 FORBIDDEN (and not SCOPE_NOT_ASSIGNED)", async () => {
    const ctx = mkCtx({
      scope: {
        userId: "u1",
        role: "employee",
        companyId: null,
        locationId: null,
        email: "employee@test.lunchportalen.no",
        sub: "sub_u1",
      },
    });

    const res = requireRoleOr403(ctx, ["kitchen"]); // employee not allowed
    expect(res).not.toBeNull();

    const body = await readBody(res!);
    expect(res!.status).toBe(403);

    // We expect FORBIDDEN, not SCOPE_NOT_ASSIGNED
    const code = extractCode(body);
    expect(code === "FORBIDDEN" || code === "UNAUTHORIZED" || code === "MISCONFIGURED_ROUTE").toBe(true);
  });
});
