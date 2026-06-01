/** @vitest-environment jsdom */

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

import WeekAllergenProfileCard from "@/components/employee/WeekAllergenProfileCard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function waitForProfileLoad(container: HTMLElement) {
  await vi.waitFor(
    () => {
      const area = container.querySelector<HTMLTextAreaElement>("#allergen-free-text");
      expect(area?.value).toBe("Hei");
    },
    { timeout: 2000 },
  );
}

async function waitForProfileReady(container: HTMLElement) {
  await vi.waitFor(
    () => {
      const saveBtn = container.querySelector<HTMLButtonElement>("button.lp-btn--primary");
      expect(saveBtn?.textContent).toBe("Lagre allergiprofil");
    },
    { timeout: 2000 },
  );
}

async function renderCard() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(<WeekAllergenProfileCard />);
    await Promise.resolve();
  });
  return container;
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/me/user-allergens" && (!init?.method || init.method === "GET")) {
        return new Response(
          JSON.stringify({
            ok: true,
            rid: "r1",
            data: { profile: { user_id: "u1", codes: ["gluten"], free_text: "Hei", updated_at: null } },
          }),
          { status: 200 },
        );
      }
      if (url === "/api/me/user-allergens" && init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        return new Response(
          JSON.stringify({
            ok: true,
            rid: "r2",
            data: { profile: { user_id: "u1", codes: body.codes, free_text: body.free_text, updated_at: "2026-01-01" } },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ ok: false }), { status: 500 });
    }),
  );
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("WeekAllergenProfileCard on /week", () => {
  test("viser kart med brukerens lagrede valg fra GET", async () => {
    const container = await renderCard();
    expect(container.textContent).toMatch(/Dine allergener — sendes som info til kjøkkenet/);
    await waitForProfileLoad(container);

    const gluten = [...container.querySelectorAll<HTMLButtonElement>(".ds-allergen-chip")].find((b) =>
      b.textContent?.includes("Gluten"),
    );
    expect(gluten?.getAttribute("aria-pressed")).toBe("true");
  });

  test("toggle chip oppdaterer aria-pressed", async () => {
    const container = await renderCard();
    await waitForProfileLoad(container);

    const milk = [...container.querySelectorAll<HTMLButtonElement>(".ds-allergen-chip")].find((b) =>
      b.textContent?.includes("Melk"),
    );
    expect(milk?.getAttribute("aria-pressed")).toBe("false");
    await act(async () => {
      milk!.click();
      await Promise.resolve();
    });
    expect(milk?.getAttribute("aria-pressed")).toBe("true");
  });

  test("lagre sender PUT til /api/me/user-allergens", async () => {
    const container = await renderCard();
    await waitForProfileLoad(container);

    const saveBtn = container.querySelector<HTMLButtonElement>("button.lp-btn--primary");
    await act(async () => {
      saveBtn!.click();
      await Promise.resolve();
    });

    const fetchMock = vi.mocked(fetch);
    const putCall = fetchMock.mock.calls.find((c) => c[0] === "/api/me/user-allergens" && c[1]?.method === "PUT");
    expect(putCall).toBeTruthy();
    const body = JSON.parse(String(putCall![1]?.body));
    expect(body.codes).toContain("gluten");
    expect(body.free_text).toBe("Hei");
  });

  test("PUT-feil viser feiltilstand, ikke success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/me/user-allergens" && (!init?.method || init.method === "GET")) {
          return new Response(
            JSON.stringify({
              ok: true,
              rid: "r1",
              data: { profile: { user_id: "u1", codes: [], free_text: "", updated_at: null } },
            }),
            { status: 200 },
          );
        }
        if (url === "/api/me/user-allergens" && init?.method === "PUT") {
          return new Response(
            JSON.stringify({ ok: false, rid: "r2", message: "Kunne ikke lagre allergiprofil." }),
            { status: 500 },
          );
        }
        return new Response(JSON.stringify({ ok: false }), { status: 500 });
      }),
    );

    const container = await renderCard();
    await waitForProfileReady(container);

    const saveBtn = container.querySelector<HTMLButtonElement>("button.lp-btn--primary");
    await act(async () => {
      saveBtn!.click();
      await Promise.resolve();
    });

    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toMatch(/Kunne ikke lagre/);
    expect(status?.className).toMatch(/text-red-800/);
    expect(status?.className).not.toMatch(/text-emerald-800/);
  });
});
