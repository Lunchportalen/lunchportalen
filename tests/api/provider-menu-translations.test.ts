/**
 * SMART-2 — provider menu translation approval API tests.
 */
// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const PROVIDER_A = "11111111-1111-1111-1111-111111111111";
const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ROW_ID = "33333333-3333-3333-3333-333333333333";

const mockGetAuthContext = vi.hoisted(() => vi.fn());
const mockGetProviderAdminContext = vi.hoisted(() => vi.fn());
const mockHasProviderRole = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockSupabaseAdmin = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/getAuthContext", () => ({
  getAuthContext: () => mockGetAuthContext(),
}));

vi.mock("@/lib/auth/providerContext", () => ({
  getProviderAdminContext: (userId: string) => mockGetProviderAdminContext(userId),
}));

vi.mock("@/lib/auth/provider", () => ({
  hasProviderRole: (...args: unknown[]) => mockHasProviderRole(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => mockSupabaseAdmin(),
}));

function sampleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ROW_ID,
    provider_id: PROVIDER_A,
    source_kind: "menu_day_item",
    source_ref: "sanity:meal-1",
    field: "title",
    locale: "en",
    original_text: "Påsmurt med ost",
    original_text_hash: "sha256:abc",
    translated_text: "Open sandwich with cheese",
    status: "draft",
    approved_by: null,
    approved_at: null,
    created_at: "2026-07-01T10:00:00.000Z",
    updated_at: "2026-07-01T10:00:00.000Z",
    ...overrides,
  };
}

function authedProviderAdmin() {
  mockGetAuthContext.mockResolvedValue({
    ok: true,
    user: { id: USER_A, email: "admin@provider.no" },
  });
  mockGetProviderAdminContext.mockResolvedValue({
    primaryProvider: { id: PROVIDER_A, name: "Provider A", slug: "provider-a" },
  });
  mockHasProviderRole.mockImplementation(async (_uid: string, _pid: string, role: string) => {
    if (role === "provider_viewer") return true;
    if (role === "provider_admin") return true;
    return false;
  });
}

function setupSupabaseChain(finalResult: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {
    select: vi.fn(function select() {
      return chain;
    }),
    eq: vi.fn(function eq() {
      return chain;
    }),
    order: vi.fn(function order() {
      return chain;
    }),
    upsert: vi.fn(function upsert() {
      return chain;
    }),
    update: vi.fn(function update() {
      return chain;
    }),
    maybeSingle: vi.fn(async () => finalResult),
    single: vi.fn(async () => finalResult),
    then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(finalResult).then(onFulfilled, onRejected);
    },
  };
  mockFrom.mockReturnValue(chain);
  mockSupabaseAdmin.mockReturnValue({ from: mockFrom });
  return chain;
}

function mockFromSequence(chains: Record<string, unknown>[]) {
  let index = 0;
  mockFrom.mockImplementation(() => {
    const chain = chains[Math.min(index, chains.length - 1)];
    index += 1;
    return chain;
  });
  mockSupabaseAdmin.mockReturnValue({ from: mockFrom });
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

describe("GET /api/provider/menu-translations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("lists provider-scoped rows", async () => {
    authedProviderAdmin();
    const chain = setupSupabaseChain({ data: [sampleRow()], error: null });

    const { GET } = await import("@/app/api/provider/menu-translations/route");
    const res = await GET(new Request("http://localhost/api/provider/menu-translations") as any);
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.translations).toHaveLength(1);
    expect(json.data.employeeTranslationsLive).toBe(false);
    expect(chain.eq).toHaveBeenCalledWith("provider_id", PROVIDER_A);
  });
});

describe("POST /api/provider/menu-translations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("rejects client-supplied providerId", async () => {
    authedProviderAdmin();
    const { POST } = await import("@/app/api/provider/menu-translations/route");
    const res = await POST(
      new Request("http://localhost/api/provider/menu-translations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerId: "22222222-2222-2222-2222-222222222222",
          sourceKind: "menu_day_item",
          sourceRef: "sanity:meal-1",
          field: "title",
          locale: "en",
          originalText: "Påsmurt med ost",
        }),
      }) as any,
    );
    expect(res.status).toBe(422);
  });

  test("provider_admin creates row with server provider scope", async () => {
    authedProviderAdmin();
    const chain = setupSupabaseChain({ data: sampleRow(), error: null });

    const { POST } = await import("@/app/api/provider/menu-translations/route");
    const res = await POST(
      new Request("http://localhost/api/provider/menu-translations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceKind: "menu_day_item",
          sourceRef: "sanity:meal-1",
          field: "title",
          locale: "en",
          originalText: "Påsmurt med ost",
          translatedText: "Open sandwich with cheese",
        }),
      }) as any,
    );
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(chain.upsert).toHaveBeenCalled();
    expect(json.data.translation.employeeVisible).toBe(false);
  });
});

describe("PATCH /api/provider/menu-translations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("approve sets approved metadata server-side", async () => {
    authedProviderAdmin();
    const { hashOriginalText } = await import("@/lib/smart-menu/translationStatus");
    const hash = hashOriginalText("Påsmurt med ost");
    const readChain = setupSupabaseChain({ data: sampleRow({ original_text_hash: hash }), error: null });
    const updateChain = setupSupabaseChain({
      data: sampleRow({
        status: "approved",
        approved_by: USER_A,
        approved_at: "2026-07-02T12:00:00.000Z",
        original_text_hash: hash,
      }),
      error: null,
    });
    mockFromSequence([readChain, updateChain]);

    const { PATCH } = await import("@/app/api/provider/menu-translations/[id]/route");
    const res = await PATCH(
      new Request(`http://localhost/api/provider/menu-translations/${ROW_ID}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          translatedText: "Open sandwich with cheese",
        }),
      }) as any,
      { params: Promise.resolve({ id: ROW_ID }) },
    );
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.data.translation.status).toBe("approved");
    expect(json.data.translation.employeeVisible).toBe(false);
  });

  test("approve blank translated_text fails", async () => {
    authedProviderAdmin();
    const readChain = setupSupabaseChain({ data: sampleRow(), error: null });
    mockFromSequence([readChain]);

    const { PATCH } = await import("@/app/api/provider/menu-translations/[id]/route");
    const res = await PATCH(
      new Request(`http://localhost/api/provider/menu-translations/${ROW_ID}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "approve", translatedText: "   " }),
      }) as any,
      { params: Promise.resolve({ id: ROW_ID }) },
    );
    expect(res.status).toBe(422);
  });

  test("reject keeps translated_text and clears approval metadata", async () => {
    authedProviderAdmin();
    const readChain = setupSupabaseChain({
      data: sampleRow({ status: "draft", translated_text: "Keep me" }),
      error: null,
    });
    const updateChain = setupSupabaseChain({
      data: sampleRow({ status: "rejected", translated_text: "Keep me", approved_by: null, approved_at: null }),
      error: null,
    });
    mockFromSequence([readChain, updateChain]);

    const { PATCH } = await import("@/app/api/provider/menu-translations/[id]/route");
    const res = await PATCH(
      new Request(`http://localhost/api/provider/menu-translations/${ROW_ID}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      }) as any,
      { params: Promise.resolve({ id: ROW_ID }) },
    );
    const json = await readJson(res);
    expect(res.status).toBe(200);
    expect(json.data.translation.status).toBe("rejected");
    expect(json.data.translation.translatedText).toBe("Keep me");
  });
});

describe("DELETE /api/provider/menu-translations/[id]", () => {
  test("returns 405", async () => {
    authedProviderAdmin();
    const { DELETE } = await import("@/app/api/provider/menu-translations/[id]/route");
    const res = await DELETE(new Request("http://localhost/x") as any);
    expect(res.status).toBe(405);
  });
});
