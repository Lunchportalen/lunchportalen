/**
 * GET /api/provider/menu-translations/sources — provider-scoped read-only coverage.
 */
// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const PROVIDER_A = "11111111-1111-1111-1111-111111111111";
const PROVIDER_B = "22222222-2222-2222-2222-222222222222";

const mockGetAuthContext = vi.hoisted(() => vi.fn());
const mockGetProviderAdminContext = vi.hoisted(() => vi.fn());
const mockHasProviderRole = vi.hoisted(() => vi.fn());
const mockLoadReport = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/getAuthContext", () => ({
  getAuthContext: () => mockGetAuthContext(),
}));

vi.mock("@/lib/auth/providerContext", () => ({
  getProviderAdminContext: (userId: string) => mockGetProviderAdminContext(userId),
}));

vi.mock("@/lib/auth/provider", () => ({
  hasProviderRole: (...args: unknown[]) => mockHasProviderRole(...args),
}));

vi.mock("@/lib/smart-menu/providerTranslationSources", () => ({
  loadProviderTranslationSourcesReport: (...args: unknown[]) => mockLoadReport(...args),
}));

function authedViewer(providerId = PROVIDER_A) {
  mockGetAuthContext.mockResolvedValue({
    ok: true,
    user: { id: "viewer-user", email: "viewer@provider.no" },
  });
  mockGetProviderAdminContext.mockResolvedValue({
    primaryProvider: { id: providerId, name: "Provider A", slug: "provider-a" },
  });
  mockHasProviderRole.mockImplementation(async (_uid: string, pid: string, role: string) => {
    if (role === "provider_viewer") return pid === providerId;
    return false;
  });
  mockLoadReport.mockResolvedValue({
    providerId,
    candidates: [
      {
        provider_id: providerId,
        source_kind: "menu_day_item",
        source_ref: "laks-eggerore",
        field: "title",
        original_text: "Laks & Eggerøre",
        original_text_hash: "sha256:abc",
      },
    ],
    coverage: {
      totalCandidates: 1,
      locales: [{ locale: "en", employeeVisible: 0, missing: 1, coveragePercent: 0 }],
      bySourceKind: [],
      candidates: [],
      staleCount: 0,
      missingCount: 1,
    },
    missingCandidates: [],
    staleCandidates: [],
    sourceTotals: { catalog: 1, orderWindow: 0, combined: 1 },
    candidateKinds: ["menu_day_item"],
    employeeTranslationsLive: false,
  });
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

describe("GET /api/provider/menu-translations/sources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns provider-scoped source report for viewer", async () => {
    authedViewer(PROVIDER_A);
    const { GET } = await import("@/app/api/provider/menu-translations/sources/route");
    const res = await GET(new Request("http://localhost/api/provider/menu-translations/sources"));
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.providerId).toBe(PROVIDER_A);
    expect(json.data.employeeTranslationsLive).toBe(false);
    expect(mockLoadReport).toHaveBeenCalledWith(PROVIDER_A);
  });

  test("blocks cross-provider context", async () => {
    authedViewer(PROVIDER_A);
    mockGetProviderAdminContext.mockResolvedValue({
      primaryProvider: { id: PROVIDER_B, name: "Provider B", slug: "provider-b" },
    });
    mockHasProviderRole.mockResolvedValue(false);

    const { GET } = await import("@/app/api/provider/menu-translations/sources/route");
    const res = await GET(new Request("http://localhost/api/provider/menu-translations/sources"));
    expect(res.status).toBe(403);
  });

  test("POST materialize is not enabled", async () => {
    authedViewer(PROVIDER_A);
    const { POST } = await import("@/app/api/provider/menu-translations/sources/route");
    const res = await POST();
    expect(res.status).toBe(405);
  });
});
