/**
 * /backoffice/content page smoke: render without crash; root auto-enters first editor target.
 * Auth is enforced by layout; tree fetch is mocked.
 */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(global as any).React = React;
import { createRoot } from "react-dom/client";
import ContentPageRoute from "@/app/(backoffice)/backoffice/content/page";
import ContentSectionLanding from "@/app/(backoffice)/backoffice/content/_workspace/ContentSectionLanding";

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

const FIRST_PAGE_UUID = "11111111-1111-4111-8111-111111111111";

function treeOkResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      ok: true,
      rid: "test-rid",
      data: {
        roots: [
          {
            id: FIRST_PAGE_UUID,
            parentId: null,
            name: "Test side",
            hasChildren: false,
            nodeType: "page",
            icon: "document",
          },
        ],
      },
    }),
  };
}

describe("Backoffice content page smoke", () => {
  beforeEach(() => {
    pushMock.mockReset();
    replaceMock.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url.includes("/api/backoffice/content/tree")) {
          return treeOkResponse();
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            data: {
              items: [],
            },
          }),
        };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("content page route redirects from root to first tree page without crashing", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(ContentPageRoute));
      await Promise.resolve();
      await Promise.resolve();
    });
    for (let i = 0; i < 30 && replaceMock.mock.calls.length === 0; i++) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 5));
      });
    }
    expect(replaceMock).toHaveBeenCalledWith(`/backoffice/content/${FIRST_PAGE_UUID}`);
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
