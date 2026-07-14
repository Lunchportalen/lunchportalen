/** @vitest-environment jsdom */

/**
 * TPT-A-7 — Tripletex superadmin UI components (render + retry surface).
 */
// @ts-nocheck

import React from "react";
import { act } from "@/tests/_helpers/reactAct";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";

import TripletexStatusBadge from "@/components/superadmin/tripletex/TripletexStatusBadge";
import TripletexSubNav from "@/components/superadmin/tripletex/TripletexSubNav";
import TripletexQueueClient from "@/app/superadmin/tripletex/TripletexQueueClient";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams("status=FAILED"),
}));

async function renderUi(node: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
    await Promise.resolve();
  });
  return { container, root };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("Tripletex admin UI", () => {
  test("TripletexStatusBadge renders status text", async () => {
    const { container } = await renderUi(<TripletexStatusBadge status="PAID" />);
    expect(container.textContent).toContain("PAID");
  });

  test("TripletexSubNav includes four sections", async () => {
    const { container } = await renderUi(<TripletexSubNav activePath="/superadmin/tripletex/queue" />);
    expect(container.textContent).toContain("Oversikt");
    expect(container.textContent).toContain("Webhooks");
    expect(container.textContent).toContain("Kø");
    expect(container.textContent).toContain("Fakturaer");
  });

  test("TripletexQueueClient renders rows and retry calls API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true, rid: "r1", data: { ok: true } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = await renderUi(
      <TripletexQueueClient
        rows={[
          {
            id: "ev-1",
            event_key: "tripletex.saas_invoice_create_lp:abc",
            status: "FAILED",
            attempts: 2,
            last_error: "boom",
            created_at: new Date().toISOString(),
            next_retry_at: null,
          },
        ]}
        status="FAILED"
      />,
    );

    expect(container.textContent).toContain("tripletex.saas_invoice_create_lp:abc");

    const retryBtn = container.querySelector("button");
    expect(retryBtn).toBeTruthy();
    await act(async () => {
      retryBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/superadmin/tripletex/outbox/retry",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
