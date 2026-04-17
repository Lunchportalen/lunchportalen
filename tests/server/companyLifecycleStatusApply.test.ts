import { describe, it, expect, vi } from "vitest";
import {
  applyCompanyLifecycleStatus,
  normalizeCompanyLifecycleStatus,
} from "@/lib/server/superadmin/companyLifecycleStatusApply";

describe("companyLifecycleStatusApply", () => {
  it("normalizeCompanyLifecycleStatus accepts lower/upper", () => {
    expect(normalizeCompanyLifecycleStatus("paused")).toBe("PAUSED");
    expect(normalizeCompanyLifecycleStatus("CLOSED")).toBe("CLOSED");
    expect(normalizeCompanyLifecycleStatus("bogus")).toBeNull();
  });

  it("applyCompanyLifecycleStatus returns already when prev equals next", async () => {
    const db: any = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: { id: "c1", name: "Acme", status: "PAUSED" },
              error: null,
            })),
          })),
        })),
      })),
    };

    const out = await applyCompanyLifecycleStatus(db, "rid1", "c1", "PAUSED");
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.already).toBe(true);
      expect(out.prev).toBe("PAUSED");
    }
    expect(db.from).toHaveBeenCalledWith("companies");
  });
});
