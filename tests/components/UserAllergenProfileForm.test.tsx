/** @vitest-environment jsdom */

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

import UserAllergenProfileForm from "@/components/employee/UserAllergenProfileForm";
import { LP_USER_ALLERGEN_FREE_TEXT_MAX } from "@/lib/allergens/lpUserAllergens";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function setTextareaValue(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

async function renderForm() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(<UserAllergenProfileForm />);
    await Promise.resolve();
  });
  return container;
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/me/user-allergens" && (!init || init.method === "GET")) {
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

describe("UserAllergenProfileForm", () => {
  test("toggle chip updates aria-pressed", async () => {
    const container = await renderForm();
    const milk = [...container.querySelectorAll<HTMLButtonElement>(".ds-allergen-chip")].find((b) =>
      b.textContent?.includes("Melk"),
    );
    expect(milk).toBeTruthy();
    expect(milk!.getAttribute("aria-pressed")).toBe("false");
    await act(async () => {
      milk!.click();
      await Promise.resolve();
    });
    expect(milk!.getAttribute("aria-pressed")).toBe("true");
  });

  test("free text respects max length in UI", async () => {
    const container = await renderForm();
    const area = container.querySelector<HTMLTextAreaElement>("#allergen-free-text");
    expect(area).toBeTruthy();
    const long = "x".repeat(LP_USER_ALLERGEN_FREE_TEXT_MAX + 40);
    await act(async () => {
      setTextareaValue(area!, long);
      await Promise.resolve();
    });
    expect(area!.value.length).toBe(LP_USER_ALLERGEN_FREE_TEXT_MAX);
  });

  test("save sends PUT with codes and free_text", async () => {
    const container = await renderForm();
    await act(async () => {
      await Promise.resolve();
    });
    const saveBtn = container.querySelector<HTMLButtonElement>("button.lp-btn--primary");
    expect(saveBtn).toBeTruthy();
    await act(async () => {
      saveBtn!.click();
      await Promise.resolve();
    });
    const fetchMock = vi.mocked(fetch);
    const putCall = fetchMock.mock.calls.find((c) => c[0] === "/api/me/user-allergens" && c[1]?.method === "PUT");
    expect(putCall).toBeTruthy();
    const body = JSON.parse(String(putCall![1]?.body));
    expect(Array.isArray(body.codes)).toBe(true);
    expect(typeof body.free_text).toBe("string");
  });
});
