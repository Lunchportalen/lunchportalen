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

  test("print variant uses monochrome box styling (not status-colored backgrounds)", async () => {
    for (const status of ["has_data", "declared_empty", "unknown"] as const) {
      const container = await renderExtra({ variant: "print", status });
      const box = container.querySelector(`[data-allergen-variant="print"]`);
      expect(box?.className).toMatch(/bg-white/);
      expect(box?.className).toMatch(/border-slate-500/);
      expect(box?.className).not.toMatch(/bg-sky-/);
      expect(box?.className).not.toMatch(/bg-emerald-/);
      expect(box?.className).not.toMatch(/bg-amber-/);
    }
  });

  test("print variant: three states remain text-distinct under simulated grayscale", async () => {
    const labels: string[] = [];
    for (const status of ["has_data", "declared_empty", "unknown"] as const) {
      const container = await renderExtra({
        variant: "print",
        status,
        codes: status === "has_data" ? ["gluten"] : [],
        free_text: status === "has_data" ? "Test" : "",
      });
      container.style.filter = "grayscale(100%)";
      labels.push(container.textContent?.replace(/\s+/g, " ").trim() ?? "");
    }
    expect(new Set(labels).size).toBe(3);
    expect(labels[0]).toMatch(/Ansatt har oppgitt/);
    expect(labels[1]).toMatch(/Ingen allergener oppgitt/);
    expect(labels[2]).toMatch(/Ikke utfylt \/ ukjent/);
  });
});
