import { afterEach, describe, expect, it, vi } from "vitest";
import { logEvent, observeResponse } from "@/lib/observability/eventLogger";

describe("eventLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logEvent does not throw", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(() =>
      logEvent({
        type: "test.event",
        source: "vitest",
        status: "start",
        durationMs: 0,
        metadata: { k: "v" },
      }),
    ).not.toThrow();
    expect(spy).toHaveBeenCalled();
    const line = String(spy.mock.calls[0]?.[0] ?? "");
    expect(line).toContain("lp.observability.event");
    expect(line).toContain("test.event");
  });

  it("observeResponse logs start and success for 200 Response", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await observeResponse({ type: "t", source: "/x", rid: "r1" }, async () => new Response("{}", { status: 200 }));
    expect(res.status).toBe(200);
    const joined = spy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(joined).toContain('"status":"start"');
    expect(joined).toContain('"status":"success"');
  });

  it("observeResponse treats 303 as success", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await observeResponse({ type: "t", source: "/redirect" }, async () => Response.redirect("https://example.com", 303));
    const joined = spy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(joined).toContain('"status":"success"');
  });
});
