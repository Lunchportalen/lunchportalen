/** @vitest-environment jsdom */

import React, { act } from "react";
import { describe, expect, test } from "vitest";
import { createRoot } from "react-dom/client";

import KitchenEmployeeAllergenExtra from "@/components/kitchen/KitchenEmployeeAllergenExtra";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function renderExtra(props: React.ComponentProps<typeof KitchenEmployeeAllergenExtra>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<KitchenEmployeeAllergenExtra {...props} />);
    await Promise.resolve();
  });
  return container;
}

describe("KitchenEmployeeAllergenExtra", () => {
  test("has_data: renders codes and free text with disclaimer", async () => {
    const container = await renderExtra({
      status: "has_data",
      codes: ["gluten", "milk"],
      free_text: "Kryssreaksjon nøtter",
    });

    expect(container.querySelector('[data-allergen-profile-status="has_data"]')).toBeTruthy();
    expect(container.textContent).toMatch(/Ansatt har oppgitt \(ekstra info\)/);
    expect(container.textContent).toMatch(/Gluten/);
    expect(container.textContent).toMatch(/Melk/);
    expect(container.textContent).toMatch(/Kryssreaksjon nøtter/);
    expect(container.textContent).toMatch(/Ikke garanti/);
  });

  test("declared_empty: always renders distinct empty state", async () => {
    const container = await renderExtra({ status: "declared_empty", codes: [], free_text: "" });

    const region = container.querySelector('[role="region"]');
    expect(region).toBeTruthy();
    expect(container.querySelector('[data-allergen-profile-status="declared_empty"]')).toBeTruthy();
    expect(container.textContent).toMatch(/Ingen allergener oppgitt/);
    expect(container.textContent).not.toMatch(/Ikke utfylt/);
  });

  test("unknown: always renders distinct unknown state", async () => {
    const container = await renderExtra({ status: "unknown", codes: [], free_text: null });

    const region = container.querySelector('[role="region"]');
    expect(region).toBeTruthy();
    expect(container.querySelector('[data-allergen-profile-status="unknown"]')).toBeTruthy();
    expect(container.textContent).toMatch(/Ikke utfylt \/ ukjent/);
    expect(container.textContent).not.toMatch(/Ingen allergener oppgitt/);
  });

  test("declared_empty and unknown use different status markers", async () => {
    const empty = await renderExtra({ status: "declared_empty" });
    const unknown = await renderExtra({ status: "unknown" });

    expect(empty.querySelector('[data-allergen-profile-status="declared_empty"]')).toBeTruthy();
    expect(unknown.querySelector('[data-allergen-profile-status="unknown"]')).toBeTruthy();
    expect(empty.textContent).not.toEqual(unknown.textContent);
  });

  test("print variant renders compact has_data", async () => {
    const container = await renderExtra({
      variant: "print",
      status: "has_data",
      codes: ["gluten"],
      free_text: "Test",
    });

    expect(container.querySelector('[data-allergen-profile-status="has_data"]')).toBeTruthy();
    expect(container.textContent).toMatch(/Gluten/);
    expect(container.textContent).toMatch(/Test/);
  });
});
