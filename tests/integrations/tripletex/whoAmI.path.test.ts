import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { tripletexWhoAmI } from "@/lib/integrations/tripletex/client";

describe("tripletexWhoAmI — Tripletex path", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          value: { companyId: 93310337, companyName: "Smoke Test AS", employeeId: 1 },
        }),
        { status: 200 },
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("kaller korrekt Tripletex action-path (ikke top-level /whoAmI)", async () => {
    await tripletexWhoAmI({ auth: { companyId: "93310337", token: "session_xyz" } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/token/session/");
    expect(url).toContain("%3EwhoAmI");
    expect(url).not.toMatch(/\/v2\/whoAmI(?:\?|$)/);
  });
});
