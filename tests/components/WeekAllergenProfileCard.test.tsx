/** @vitest-environment jsdom */

import React, { act } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

import WeekAllergenProfileCard from "@/components/employee/WeekAllergenProfileCard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DS_PATH = join(process.cwd(), "app", "styles", "ds", "design-system.css");

async function waitForProfileReady(container: HTMLElement) {
  await vi.waitFor(
    () => {
      const summary = container.querySelector<HTMLButtonElement>(".ds-allergen-disclosure__summary");
      expect(summary).toBeTruthy();
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

function summaryButton(container: HTMLElement) {
  return container.querySelector<HTMLButtonElement>(".ds-allergen-disclosure__summary");
}

async function openDisclosure(container: HTMLElement) {
  await waitForProfileReady(container);
  const btn = summaryButton(container)!;
  await act(async () => {
    btn.click();
    await Promise.resolve();
  });
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
            data: { profile: { user_id: "u1", codes: ["gluten", "gluten_wheat", "milk"], free_text: "", updated_at: "2026-01-01" } },
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
            data: {
              profile: {
                user_id: "u1",
                codes: body.codes,
                free_text: body.free_text,
                updated_at: "2026-01-02",
              },
            },
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

describe("WeekAllergenProfileCard disclosure", () => {
  test("default kollapset — panel skjult, chip-grid ikke i DOM", async () => {
    const container = await renderCard();
    expect(container.querySelector("#week-allergen-heading")?.textContent).toMatch(/Dine allergener/);
    expect(container.querySelector("section")?.getAttribute("aria-labelledby")).toBe("week-allergen-heading");
    expect(container.textContent).toMatch(/Fortell oss hva du ikke tåler/);
    expect(container.textContent).toMatch(/senke skuldrene og nyte lunsjen/);
    await waitForProfileReady(container);

    const summary = summaryButton(container)!;
    expect(summary.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector(".ds-allergen-disclosure__panel")?.className).not.toMatch(/is-open/);
    expect(container.querySelector("#allergen-free-text")).toBeNull();
    expect(container.querySelector(".ds-allergen-chip-grid")).toBeNull();
  });

  test("klikk åpner panel med aria-expanded true", async () => {
    const container = await renderCard();
    await openDisclosure(container);

    const summary = summaryButton(container)!;
    expect(summary.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector(".ds-allergen-disclosure__panel")?.className).toMatch(/is-open/);
    expect(container.querySelector("#allergen-free-text")).toBeTruthy();
  });

  test("has_data summary viser valgte som read-only chips", async () => {
    const container = await renderCard();
    await waitForProfileReady(container);

    expect(container.textContent).toMatch(/Gluten \(hvete\)/);
    expect(container.textContent).toMatch(/Melk/);
    expect(container.querySelectorAll(".ds-allergen-chip--readonly").length).toBeGreaterThanOrEqual(2);
  });

  test("unknown summary viser hint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/me/user-allergens") {
          return new Response(
            JSON.stringify({
              ok: true,
              rid: "r1",
              data: { profile: { user_id: "u1", codes: [], free_text: "", updated_at: null } },
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ ok: false }), { status: 500 });
      }),
    );

    const container = await renderCard();
    await waitForProfileReady(container);

    expect(container.textContent).toMatch(/Allergener/);
    expect(container.textContent).toMatch(/Legg til hvis du har noen/);
  });

  test("declared_empty summary", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/me/user-allergens") {
          return new Response(
            JSON.stringify({
              ok: true,
              rid: "r1",
              data: { profile: { user_id: "u1", codes: [], free_text: "", updated_at: "2026-01-01" } },
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ ok: false }), { status: 500 });
      }),
    );

    const container = await renderCard();
    await waitForProfileReady(container);

    expect(container.textContent).toMatch(/Allergener: ingen oppgitt ✓/);
  });

  test("«Jeg har ingen allergener» → PUT declared_empty og kollaps", async () => {
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
          const body = JSON.parse(String(init.body));
          expect(body.codes).toEqual([]);
          expect(body.free_text).toBe("");
          return new Response(
            JSON.stringify({
              ok: true,
              rid: "r2",
              data: { profile: { user_id: "u1", codes: [], free_text: "", updated_at: "2026-01-02" } },
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ ok: false }), { status: 500 });
      }),
    );

    const container = await renderCard();
    await openDisclosure(container);

    const declareBtn = container.querySelector<HTMLButtonElement>(".ds-allergen-disclosure__declare-empty");
    expect(declareBtn).toBeTruthy();
    await act(async () => {
      declareBtn!.click();
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(summaryButton(container)?.getAttribute("aria-expanded")).toBe("false");
    });
    expect(container.textContent).toMatch(/Allergener: ingen oppgitt ✓/);
  });

  test("Melhus heading og ingress uten wordy disclaimer", async () => {
    const container = await renderCard();
    expect(container.querySelector("h2#week-allergen-heading")?.textContent).toMatch(/Dine allergener/);
    expect(container.textContent).toMatch(/Fortell oss hva du ikke tåler/);
    expect(container.textContent).not.toMatch(/sendes som info til kjøkkenet/);
  });

  test("lagre sender PUT når panel er åpent", async () => {
    const container = await renderCard();
    await openDisclosure(container);
    await vi.waitFor(() => {
      expect(container.querySelector("button.lp-btn--primary")).toBeTruthy();
    });

    const saveBtn = container.querySelector<HTMLButtonElement>("button.lp-btn--primary");
    await act(async () => {
      saveBtn!.click();
      await Promise.resolve();
    });

    const putCall = vi.mocked(fetch).mock.calls.find((c) => c[0] === "/api/me/user-allergens" && c[1]?.method === "PUT");
    expect(putCall).toBeTruthy();
  });

  test("reduced-motion: disclosure-animasjon deaktivert i design-system.css", () => {
    const css = readFileSync(DS_PATH, "utf-8");
    expect(css).toMatch(/\.ds-allergen-disclosure__panel[\s\S]*transition:[\s\S]*--ds-ease/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.ds-allergen-disclosure__panel[\s\S]*transition:\s*none/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.ds-allergen-disclosure__chevron[\s\S]*transition:\s*none/);
  });

  test("summary har aria-controls og min 48px touch i CSS", () => {
    const css = readFileSync(DS_PATH, "utf-8");
    expect(css).toMatch(/\.ds-allergen-disclosure__summary[\s\S]*min-height:\s*48px/);
    expect(css).toMatch(/\.ds-allergen-disclosure__summary:focus-visible[\s\S]*outline-offset:\s*3px/);
  });
});
