import { describe, expect, test } from "vitest";

import { POST } from "@/app/api/order/set-day/route";

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

describe("/api/order/set-day deprecated", () => {
  test("returnerer 410 DEPRECATED", async () => {
    const res = await POST();
    const json = await readJson(res);

    expect(res.status).toBe(410);
    expect(json.ok).toBe(false);
    expect(json.error).toBe("DEPRECATED");
    expect(json.message).toContain("POST /api/orders");
  });
});
