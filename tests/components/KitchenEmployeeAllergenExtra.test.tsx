/** @vitest-environment jsdom */

import React, { act } from "react";
import { describe, expect, test } from "vitest";
import { createRoot } from "react-dom/client";

import KitchenEmployeeAllergenExtra from "@/components/kitchen/KitchenEmployeeAllergenExtra";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("KitchenEmployeeAllergenExtra", () => {
  test("renders active codes and free text with disclaimer", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<KitchenEmployeeAllergenExtra codes={["gluten", "milk"]} free_text="Kryssreaksjon nøtter" />);
      await Promise.resolve();
    });

    expect(container.textContent).toMatch(/Ansatt har oppgitt \(ekstra info\)/);
    expect(container.textContent).toMatch(/Gluten/);
    expect(container.textContent).toMatch(/Melk/);
    expect(container.textContent).toMatch(/Kryssreaksjon nøtter/);
    expect(container.textContent).toMatch(/Ikke garanti/);
  });

  test("renders nothing when profile empty", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<KitchenEmployeeAllergenExtra codes={[]} free_text="" />);
      await Promise.resolve();
    });
    expect(container.querySelector('[role="region"]')).toBeNull();
  });
});
