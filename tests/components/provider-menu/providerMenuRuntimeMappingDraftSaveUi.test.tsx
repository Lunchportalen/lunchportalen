/**
 * G5d.3e — Mapping draft save UI tests (provider workspace, flag-gated).
 */
// @ts-nocheck
/** @vitest-environment jsdom */

import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "fs";
import { resolve } from "path";
import { act } from "@/tests/_helpers/reactAct";
import { NextIntlClientProvider } from "next-intl";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { loadMessagesForLocale } from "@/lib/i18n/messages";
import {
  LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV,
  LP_MENU_PROFILE_RESOLVER_ENV,
  LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL_ENV,
  isMenuProfileMappingDraftSaveUiEnabled,
} from "@/lib/menu-profile/featureFlag";
import { getMenuProfile } from "@/lib/menu-profile/registry";
import { buildMenuProfileRuntimeMapping } from "@/lib/menu-profile/runtimeMapping";
import { buildProviderMenuRuntimeMappingProposalPresentation } from "@/lib/provider-menu/providerMenuRuntimeMappingProposal";
import { resolveMenuProfileForProvider } from "@/lib/menu-profile/resolver";
import { buildRuntimeMappingDraftSaveRequestBody } from "@/lib/provider-menu/providerMenuRuntimeMappingDraftSavePayload";

const ALL_DRAFT_FLAGS = {
  [LP_MENU_PROFILE_RESOLVER_ENV]: "true",
  [LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL_ENV]: "true",
  [LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV]: "true",
};

const FORBIDDEN_WORDS = [
  "Aktiver",
  "Publiser",
  "Send til ansatte",
  "Gjør live",
  "Bruk i meny",
  "Apply",
  "Enable",
];

function runtimeMappingProposal(profileId = "norwegian_company_lunch", env = ALL_DRAFT_FLAGS) {
  const resolver = resolveMenuProfileForProvider({ menuProfileId: profileId, env });
  const mapping = buildMenuProfileRuntimeMapping({
    menuProfile: getMenuProfile(profileId as Parameters<typeof getMenuProfile>[0]),
  });
  return buildProviderMenuRuntimeMappingProposalPresentation(resolver, "NOK", mapping, env);
}

async function renderPanel(options: {
  draftSaveEnabled?: boolean;
  canSaveDraft?: boolean;
} = {}) {
  const proposal = runtimeMappingProposal();
  if (!proposal.active) return "";
  const messages = await loadMessagesForLocale("nb");
  const Panel = (await import("@/components/providers/ProviderMenuRuntimeMappingProposalPanel"))
    .default;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="nb" messages={messages}>
      <Panel
        proposal={proposal}
        draftSaveEnabled={options.draftSaveEnabled ?? false}
        canSaveDraft={options.canSaveDraft ?? false}
      />
    </NextIntlClientProvider>,
  );
}

describe("G5d.3e feature flag gating", () => {
  test("draft save UI flag requires resolver + proposal + draft API", () => {
    expect(isMenuProfileMappingDraftSaveUiEnabled({})).toBe(false);
    expect(
      isMenuProfileMappingDraftSaveUiEnabled({
        [LP_MENU_PROFILE_RESOLVER_ENV]: "true",
        [LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL_ENV]: "true",
      }),
    ).toBe(false);
    expect(isMenuProfileMappingDraftSaveUiEnabled(ALL_DRAFT_FLAGS)).toBe(true);
  });
});

describe("G5d.3e ProviderMenuRuntimeMappingProposalPanel draft save UI", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, data: { draft: null } }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("save UI hidden when draftSaveEnabled=false", async () => {
    const html = await renderPanel({ draftSaveEnabled: false, canSaveDraft: true });
    expect(html).not.toContain("provider-menu-runtime-mapping-draft-save");
    expect(html).not.toContain("Lagre vurdering som utkast");
  });

  test("save UI visible when draftSaveEnabled=true and provider_admin", async () => {
    const html = await renderPanel({ draftSaveEnabled: true, canSaveDraft: true });
    expect(html).toContain("provider-menu-runtime-mapping-draft-save");
    expect(html).toContain("Lagre vurdering som utkast");
    expect(html).toContain("Ikke lagret");
    expect(html).toContain("Dette aktiverer ikke publisering, bestilling eller menyvisning.");
  });

  test("provider_viewer sees no save button", async () => {
    const html = await renderPanel({ draftSaveEnabled: true, canSaveDraft: false });
    expect(html).toContain("provider-menu-runtime-mapping-draft-save");
    expect(html).not.toContain("runtime-mapping-draft-save-button");
    expect(html).toContain("Lagring krever leverandør-admin.");
  });

  test("button text is exactly Lagre vurdering som utkast", async () => {
    const html = await renderPanel({ draftSaveEnabled: true, canSaveDraft: true });
    expect(html).toContain("Lagre vurdering som utkast");
  });

  test("draft save UI copy avoids forbidden activation words in draft section", async () => {
    const html = await renderPanel({ draftSaveEnabled: true, canSaveDraft: true });
    const draftSection = html.slice(html.indexOf("provider-menu-runtime-mapping-draft-save"));
    for (const word of FORBIDDEN_WORDS) {
      expect(draftSection, `forbidden word: ${word}`).not.toMatch(new RegExp(`\\b${word}\\b`, "i"));
    }
  });
});

async function renderDraftControls(options: { canSaveDraft?: boolean } = {}) {
  const proposal = runtimeMappingProposal();
  const messages = await loadMessagesForLocale("nb");
  const Controls = (await import("@/components/providers/ProviderMenuRuntimeMappingDraftSaveControls"))
    .default;

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  await act(async () => {
    root.render(
      <NextIntlClientProvider locale="nb" messages={messages}>
        <Controls proposal={proposal} canSaveDraft={options.canSaveDraft ?? true} />
      </NextIntlClientProvider>,
    );
    await Promise.resolve();
  });

  return { container, root, proposal };
}

describe("G5d.3e draft save client behavior", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  test("mount performs GET to mapping-draft API", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, data: { draft: null } }),
    });

    await renderDraftControls();

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const url = String(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/api/provider/menu-profile/mapping-draft?menuProfileId=");
    expect(url).not.toContain("providerId=");
  });

  test("save POST payload excludes providerId and uses draft status", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, data: { draft: null } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, data: { draft: { draftStatus: "draft" } } }),
      });

    const { container } = await renderDraftControls();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="runtime-mapping-draft-save-button"]',
    );
    expect(button).toBeTruthy();

    await act(async () => {
      button?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const postCall = fetchMock.mock.calls[1];
    expect(postCall?.[0]).toBe("/api/provider/menu-profile/mapping-draft");
    expect(postCall?.[1]?.method).toBe("POST");
    const body = JSON.parse(String(postCall?.[1]?.body ?? "{}"));
    expect(body.draftStatus).toBe("draft");
    expect(body.providerId).toBeUndefined();
    expect(body.menuProfileId).toBe("norwegian_company_lunch");
  });

  test("validation failure shows safe message only", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, data: { draft: null } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ ok: false, error: "VALIDATION_FAILED" }),
      });

    const { container } = await renderDraftControls();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="runtime-mapping-draft-save-button"]',
    );
    await act(async () => {
      button?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    await vi.waitFor(() =>
      expect(container.querySelector('[data-testid="runtime-mapping-draft-feedback"]')).toBeTruthy(),
    );

    const feedback = container.querySelector('[data-testid="runtime-mapping-draft-feedback"]')?.textContent ?? "";
    expect(feedback).toContain("valideringen stoppet en usikker endring");
    expect(feedback).not.toMatch(/sql|stack|providerId/i);
  });

  test("403 shows permission message", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, data: { draft: null } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ ok: false, error: "FORBIDDEN" }),
      });

    const { container } = await renderDraftControls();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="runtime-mapping-draft-save-button"]',
    );
    await act(async () => {
      button?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    await vi.waitFor(() =>
      expect(container.querySelector('[data-testid="runtime-mapping-draft-feedback"]')).toBeTruthy(),
    );
    expect(container.querySelector('[data-testid="runtime-mapping-draft-feedback"]')?.textContent).toContain(
      "Du har ikke tilgang",
    );
  });
});

describe("G5d.3e runtime separation (static)", () => {
  test("draft save UI does not import publish/order/week/Sanity/billing", () => {
    const files = [
      "components/providers/ProviderMenuRuntimeMappingDraftSaveControls.tsx",
      "components/providers/ProviderMenuRuntimeMappingProposalPanel.tsx",
      "lib/provider-menu/providerMenuRuntimeMappingDraftSavePayload.ts",
    ];
    const forbidden = [/menu-publish/, /lp_order_set/, /syncMenuServiceDay/, /requireSanityWrite/, /tripletex/i];
    for (const rel of files) {
      const src = readFileSync(resolve(process.cwd(), rel), "utf8");
      for (const pattern of forbidden) {
        expect(src, rel).not.toMatch(pattern);
      }
    }
  });

  test("ProviderMenuBuilder save path still excludes runtimeMappingProposal", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/providers/ProviderMenuBuilder.tsx"),
      "utf8",
    );
    const saveBlock = source.slice(
      source.indexOf("async function save"),
      source.indexOf("async function save") + 2500,
    );
    expect(saveBlock).not.toContain("runtimeMappingProposal");
    expect(saveBlock).not.toContain("mapping-draft");
  });

  test("payload builder is pure and has no providerId field", () => {
    const proposal = runtimeMappingProposal();
    const body = buildRuntimeMappingDraftSaveRequestBody(proposal);
    expect(JSON.stringify(body)).not.toContain("providerId");
  });
});
