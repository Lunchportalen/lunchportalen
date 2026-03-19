/** @vitest-environment jsdom */

import React from "react";
import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";

import UsersPage from "@/app/(backoffice)/backoffice/users/page";

type FetchMockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function mockFetchOnce(response: FetchMockResponse) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).fetch = fetchMock;
  return fetchMock;
}

beforeAll(() => {
  // Next.js App Router components rely on the new JSX transform,
  // but our tests run without automatic React import resolution.
  // Ensure React is available on the global object for the runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).React = React;
});

async function renderUsersPage() {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const root = createRoot(container);
  await act(async () => {
    root.render(<UsersPage />);
    // allow effect + fetch + state updates
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  return { container, root };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("UsersPage smoke states", () => {
  it("renders heading and a user row for normal data", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        rid: "rid-normal",
        data: {
          items: [
            {
              id: "u1",
              email: "alice@example.com",
              name: "Alice",
              role: "superadmin",
              company_id: "company-1",
              is_active: true,
            },
          ],
        },
      }),
    });

    const { container } = await renderUsersPage();

    expect(container.querySelector("h1")?.textContent).toContain("Brukere");
    const text = container.textContent || "";
    expect(text).toContain("alice@example.com");
    expect(text).toContain("superadmin");
    expect(text).toContain("Aktiv");
  });

  it("renders safe empty state when no users are returned", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        rid: "rid-empty",
        data: {
          items: [],
        },
      }),
    });

    const { container } = await renderUsersPage();

    const text = container.textContent || "";
    expect(text).toContain("Brukere");
    expect(text).toContain("Ingen brukere funnet.");
  });

  it("renders a safe error message when API returns an error", async () => {
    mockFetchOnce({
      ok: false,
      status: 500,
      json: async () => ({
        ok: false,
        rid: "rid-error",
        error: "Internal error",
        message: "Kunne ikke hente brukere (status 500).",
        status: 500,
      }),
    });

    const { container } = await renderUsersPage();

    const text = container.textContent || "";
    expect(text).toContain("Brukere");
    expect(text).toContain("Kunne ikke hente brukere");
  });
});

describe("UsersPage malformed but successful payloads (fail-safe)", () => {
  it("Case A: no data.items — renders safe state without crash", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, rid: "rid-a" }),
    });

    const { container } = await renderUsersPage();

    expect(container.querySelector("h1")?.textContent).toContain("Brukere");
    const text = container.textContent || "";
    expect(text).toContain("Ingen brukere funnet.");
  });

  it("Case B: data.items is null — renders safe state without crash", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, rid: "rid-b", data: { items: null } }),
    });

    const { container } = await renderUsersPage();

    expect(container.querySelector("h1")?.textContent).toContain("Brukere");
    const text = container.textContent || "";
    expect(text).toContain("Ingen brukere funnet.");
  });

  it("Case C: items array contains null/undefined — no crash, valid rows render", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        rid: "rid-c",
        data: {
          items: [null, undefined, { id: "u2", email: "b@ex.com", name: "Bob", role: "employee", company_id: null, is_active: true }],
        },
      }),
    });

    const { container } = await renderUsersPage();

    expect(container.querySelector("h1")?.textContent).toContain("Brukere");
    const text = container.textContent || "";
    expect(text).toContain("b@ex.com");
    expect(text).toContain("Bob");
  });

  it("Case D: user object with only id — renders row without crash", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        rid: "rid-d",
        data: { items: [{ id: "1" }] },
      }),
    });

    const { container } = await renderUsersPage();

    expect(container.querySelector("h1")?.textContent).toContain("Brukere");
    const text = container.textContent || "";
    expect(text).toContain("Ikke aktiv");
  });

  it("Case E: user object with wrong primitive types for name/email — no crash", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        rid: "rid-e",
        data: {
          items: [{ id: "1", name: 123, email: false, role: null, company_id: null, is_active: false }],
        },
      }),
    });

    const { container } = await renderUsersPage();

    expect(container.querySelector("h1")?.textContent).toContain("Brukere");
    const text = container.textContent || "";
    expect(text).toContain("Ikke aktiv");
  });
});

/** Simulate typing in the search input (controlled input). */
function typeInSearch(container: HTMLElement, value: string) {
  const input = container.querySelector('input[type="search"]') as HTMLInputElement | null;
  if (!input) throw new Error("Search input not found");
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  const setter = descriptor?.set;
  if (setter) {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

describe("UsersPage search/filter with malformed rows (interaction)", () => {
  it("search with non-string email/name/role — no crash, zero-result state safe", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        rid: "rid-sa",
        data: {
          items: [{ id: "1", name: 123, email: false, role: null }],
        },
      }),
    });

    const { container } = await renderUsersPage();
    expect(container.querySelector("h1")?.textContent).toContain("Brukere");

    await act(async () => {
      typeInSearch(container, "foo");
      await Promise.resolve();
    });

    const text = container.textContent || "";
    expect(text).toContain("Ingen brukere matcher søket");
  });

  it("search with mixed id-only + valid row — valid row searchable", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        rid: "rid-sb",
        data: {
          items: [
            { id: "1" },
            { id: "2", name: "Alice", email: "alice@test.no", role: "admin", company_id: null, is_active: true },
          ],
        },
      }),
    });

    const { container } = await renderUsersPage();
    expect(container.textContent).toContain("alice@test.no");

    await act(async () => {
      typeInSearch(container, "alice");
      await Promise.resolve();
    });

    expect(container.textContent).toContain("alice@test.no");
    expect(container.textContent).toContain("Alice");

    await act(async () => {
      typeInSearch(container, "xyznomatch");
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Ingen brukere matcher søket");
  });

  it("search with null + valid row — valid row searchable, no crash", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        rid: "rid-sc",
        data: {
          items: [null, { id: "2", name: "Bob", email: "bob@test.no", role: "employee", company_id: null, is_active: true }],
        },
      }),
    });

    const { container } = await renderUsersPage();
    expect(container.textContent).toContain("bob@test.no");

    await act(async () => {
      typeInSearch(container, "bob");
      await Promise.resolve();
    });

    expect(container.textContent).toContain("bob@test.no");
    expect(container.textContent).toContain("Bob");
  });

  it("search with mixed malformed + valid rows — valid row findable, zero results safe", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        rid: "rid-sd",
        data: {
          items: [
            { id: "1", name: 123, email: false, role: null, company_id: null, is_active: false },
            { id: "2", name: "Charlie", email: "charlie@test.no", role: "driver", company_id: null, is_active: true },
          ],
        },
      }),
    });

    const { container } = await renderUsersPage();
    expect(container.textContent).toContain("Charlie");
    expect(container.textContent).toContain("charlie@test.no");

    await act(async () => {
      typeInSearch(container, "charlie");
      await Promise.resolve();
    });

    expect(container.textContent).toContain("charlie@test.no");

    await act(async () => {
      typeInSearch(container, "nonexistent");
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Ingen brukere matcher søket");
  });
});

describe("UsersPage derived list-state with malformed rows", () => {
  it("Case A: count text and table safe with non-string name/email/role + valid row", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        rid: "rid-la",
        data: {
          items: [
            { id: "1", name: 123, email: false, role: null, company_id: null, is_active: false },
            { id: "2", name: "Alice", email: "alice@test.no", role: "admin", company_id: null, is_active: true },
          ],
        },
      }),
    });

    const { container } = await renderUsersPage();

    expect(container.textContent).toMatch(/Viser \d+ av \d+ brukere/);
    expect(container.textContent).toContain("alice@test.no");
    expect(container.textContent).toContain("Alice");
  });

  it("Case B: count text and keys safe with missing id + valid row", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        rid: "rid-lb",
        data: {
          items: [
            { id: undefined, name: "NoId", email: "noid@test.no", role: "employee", company_id: null, is_active: true },
            { id: "2", name: "Bob", email: "bob@test.no", role: "employee", company_id: null, is_active: true },
          ],
        },
      }),
    });

    const { container } = await renderUsersPage();

    expect(container.textContent).toMatch(/Viser \d+ av \d+ brukere/);
    expect(container.textContent).toContain("noid@test.no");
    expect(container.textContent).toContain("bob@test.no");
  });

  it("Case C: null filtered out — count and single valid row safe", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        rid: "rid-lc",
        data: {
          items: [null, { id: "2", name: "Charlie", email: "charlie@test.no", role: "driver", company_id: null, is_active: true }],
        },
      }),
    });

    const { container } = await renderUsersPage();

    expect(container.textContent).toMatch(/Viser 1 av 1 brukere/);
    expect(container.textContent).toContain("charlie@test.no");
  });

  it("Case D: partial + valid row — count text and zero-result transition safe", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        rid: "rid-ld",
        data: {
          items: [
            { id: "1" },
            { id: "2", name: "Dana", email: "dana@test.no", role: "company_admin", company_id: null, is_active: true },
          ],
        },
      }),
    });

    const { container } = await renderUsersPage();

    expect(container.textContent).toMatch(/Viser \d+ av \d+ brukere/);
    expect(container.textContent).toContain("dana@test.no");

    await act(async () => {
      typeInSearch(container, "xyznomatch");
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Ingen brukere matcher søket");
    expect(container.textContent).toMatch(/Viser 0 av 2 brukere/);
  });

  it("Case E: wrong primitives + valid row — count and zero-result safe", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        rid: "rid-le",
        data: {
          items: [
            { id: "1", name: 999, email: true, role: {}, company_id: null, is_active: false },
            { id: "2", name: "Eirik", email: "eirik@test.no", role: "kitchen", company_id: null, is_active: true },
          ],
        },
      }),
    });

    const { container } = await renderUsersPage();

    expect(container.textContent).toMatch(/Viser \d+ av \d+ brukere/);
    expect(container.textContent).toContain("eirik@test.no");

    await act(async () => {
      typeInSearch(container, "nomatch");
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Ingen brukere matcher søket");
  });
});

