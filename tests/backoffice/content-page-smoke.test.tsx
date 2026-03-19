/**
 * /backoffice/content page smoke: render without crash, empty state.
 * Auth is enforced by layout; this only checks the content landing UI.
 */
/** @vitest-environment jsdom */

import React from "react";
import { describe, it, expect } from "vitest";

(global as any).React = React;
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import ContentDashboard from "@/app/(backoffice)/backoffice/content/_workspace/ContentDashboard";

describe("Backoffice content page smoke", () => {
  it("ContentDashboard renders with heading and no crash", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(ContentDashboard));
      await Promise.resolve();
    });
    const heading = container.querySelector("h1");
    expect(heading?.textContent?.trim()).toBe("Content");
    expect(container.textContent).toContain("Velg en node");
    document.body.removeChild(container);
  });

  it("ContentDashboard shows empty-state areas (Områder)", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(ContentDashboard));
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Områder");
    expect(container.textContent).toContain("Home");
    expect(container.textContent).toContain("Recycle Bin");
    document.body.removeChild(container);
  });
});
