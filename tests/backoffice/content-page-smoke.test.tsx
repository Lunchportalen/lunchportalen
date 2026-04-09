/**
 * /backoffice/content page smoke: render without crash, empty state.
 * Auth is enforced by layout; this only checks the content landing UI.
 */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(global as any).React = React;
import { createRoot } from "react-dom/client";
import ContentPageRoute from "@/app/(backoffice)/backoffice/content/page";
import ContentSectionLanding from "@/app/(backoffice)/backoffice/content/_workspace/ContentSectionLanding";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("Backoffice content page smoke", () => {
  beforeEach(() => {
    pushMock.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            items: [],
          },
        }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("content page route renders the content-first landing without crashing", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(ContentPageRoute));
      await Promise.resolve();
    });
    const heading = container.querySelector("h1");
    expect(heading?.textContent?.trim()).toBe("Content");
    expect(container.textContent).toContain("Content tree");
    document.body.removeChild(container);
  });

  it("ContentSectionLanding renders with heading and no crash", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(ContentSectionLanding));
      await Promise.resolve();
    });
    const heading = container.querySelector("h1");
    expect(heading?.textContent?.trim()).toBe("Innhold");
    expect(container.textContent).toContain("Landingflaten er oversikt, ikke en alternativ editor.");
    document.body.removeChild(container);
  });

  it("ContentSectionLanding shows recent content empty-state", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(ContentSectionLanding));
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Siste sider (API)");
    expect(container.textContent).toContain("Ingen sider returnert");
    expect(container.textContent).toContain("Opprett");
    document.body.removeChild(container);
  });
});
