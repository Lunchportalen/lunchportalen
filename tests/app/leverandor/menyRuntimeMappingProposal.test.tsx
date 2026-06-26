import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextIntlClientProvider } from "next-intl";

import { loadMessagesForLocale } from "@/lib/i18n/messages";
import {
  LP_MENU_PROFILE_RESOLVER_ENV,
  LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL_ENV,
} from "@/lib/menu-profile/featureFlag";
import { getMenuProfile } from "@/lib/menu-profile/registry";
import { buildMenuProfileRuntimeMapping } from "@/lib/menu-profile/runtimeMapping";
import { resolveMenuProfileForProvider } from "@/lib/menu-profile/resolver";
import { buildProviderMenuRuntimeMappingProposalPresentation } from "@/lib/provider-menu/providerMenuRuntimeMappingProposal";

const CATALOG_FIXTURE = {
  rows: [
    {
      key: "paasmurt",
      title: "Påsmurt",
      allowedPlanTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
      items: [{ key: "ost-skinke", title: "Ost & Skinke", allergens: ["melk"], isVegetarian: false }],
    },
    {
      key: "salatboks",
      title: "Salatboks",
      allowedPlanTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
      items: [{ key: "skinke", title: "Skinke", allergens: [], isVegetarian: false }],
    },
  ],
};

const PROPOSAL_FLAGS = {
  [LP_MENU_PROFILE_RESOLVER_ENV]: "true",
  [LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL_ENV]: "true",
};

const RESOLVER_ONLY = {
  [LP_MENU_PROFILE_RESOLVER_ENV]: "true",
  [LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL_ENV]: "false",
};

function runtimeMappingProposal(profileId: string, env = PROPOSAL_FLAGS) {
  const resolver = resolveMenuProfileForProvider({ menuProfileId: profileId, env });
  const mapping = buildMenuProfileRuntimeMapping({
    menuProfile: getMenuProfile(profileId as Parameters<typeof getMenuProfile>[0]),
  });
  return buildProviderMenuRuntimeMappingProposalPresentation(resolver, "NOK", mapping, env);
}

describe("ProviderMenuRuntimeMappingProposalPanel UI (G5d.2)", () => {
  async function renderPanel(proposal: ReturnType<typeof runtimeMappingProposal>) {
    if (!proposal.active) {
      return "";
    }
    const messages = await loadMessagesForLocale("nb");
    const Panel = (await import("@/components/providers/ProviderMenuRuntimeMappingProposalPanel"))
      .default;
    return renderToStaticMarkup(
      <NextIntlClientProvider locale="nb" messages={messages}>
        <Panel proposal={proposal} />
      </NextIntlClientProvider>,
    );
  }

  test("panel has no button, input, or form elements", async () => {
    const proposal = runtimeMappingProposal("norwegian_company_lunch");
    const html = await renderPanel(proposal);
    expect(html).toContain("provider-menu-runtime-mapping-proposal-panel");
    expect(html).not.toMatch(/<button\b/i);
    expect(html).not.toMatch(/<input\b/i);
    expect(html).not.toMatch(/<form\b/i);
    expect(html).toContain("Ikke aktiv i lagring");
    expect(html).toContain("Ikke aktiv i publisering");
    expect(html).toContain("Ikke synlig for ansatte");
  });

  test("NO profile shows salatboks → salat mapping", async () => {
    const proposal = runtimeMappingProposal("norwegian_company_lunch");
    const html = await renderPanel(proposal);
    expect(html).toContain("runtime-mapping-category-salatboks");
    expect(html).toContain("salatboks");
    expect(html).toContain("salat");
  });
});

describe("ProviderMenuCatalogView runtime mapping proposal (G5d.2)", () => {
  async function renderCatalogView(
    options: {
      runtimeMappingProposal?: ReturnType<typeof runtimeMappingProposal>;
    } = {},
  ) {
    const messages = await loadMessagesForLocale("nb");
    const ProviderMenuCatalogView = (await import("@/components/providers/ProviderMenuCatalogView"))
      .default;
    return renderToStaticMarkup(
      <NextIntlClientProvider locale="nb" messages={messages}>
        <ProviderMenuCatalogView
          tier="BASIS"
          catalog={CATALOG_FIXTURE}
          onCatalogSaved={() => {}}
          runtimeMappingProposal={options.runtimeMappingProposal ?? { active: false }}
        />
      </NextIntlClientProvider>,
    );
  }

  test("proposal flag OFF does not render proposal panel", async () => {
    const html = await renderCatalogView();
    expect(html).not.toContain("provider-menu-runtime-mapping-proposal-panel");
    expect(html).toContain("Påsmurt");
    expect(html).toContain("Salatboks");
  });

  test("resolver ON + proposal OFF does not render proposal panel", async () => {
    const inactive = runtimeMappingProposal("norwegian_company_lunch", RESOLVER_ONLY);
    expect(inactive.active).toBe(false);
    const html = await renderCatalogView({ runtimeMappingProposal: inactive });
    expect(html).not.toContain("provider-menu-runtime-mapping-proposal-panel");
  });

  test("resolver ON + proposal ON renders proposal panel without mutating catalog", async () => {
    const proposal = runtimeMappingProposal("norwegian_company_lunch");
    expect(proposal.active).toBe(true);
    const html = await renderCatalogView({ runtimeMappingProposal: proposal });
    expect(html).toContain("provider-menu-runtime-mapping-proposal-panel");
    expect(html).toContain("Runtime mapping-forslag");
    expect(html).toContain("lp-editor-catalog-acc__name");
    expect(html).toContain("Salatboks");
    expect(html).toContain("Påsmurt");
  });

  test("IT profile shows shadow-only categories", async () => {
    const proposal = runtimeMappingProposal("italian_office_lunch");
    const html = await renderCatalogView({ runtimeMappingProposal: proposal });
    expect(html).toContain("runtime-mapping-category-panini");
    expect(html).toContain("Ikke runtime-støttet ennå");
  });
});

describe("ProviderMenuBuilder runtime mapping proposal wiring (G5d.2)", () => {
  test("save path does not include runtimeMappingProposal", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/providers/ProviderMenuBuilder.tsx"),
      "utf8",
    );
    const saveBlock = source.slice(
      source.indexOf("async function save"),
      source.indexOf("async function save") + 2500,
    );
    expect(saveBlock).toContain("JSON.stringify(payload)");
    expect(saveBlock).not.toContain("runtimeMappingProposal");
    expect(saveBlock).not.toContain("runtimeMapping");
  });
});

describe("LeverandorMenyPage G5d.2 wiring", () => {
  test("page builds proposal server-side without API route imports", () => {
    const source = readFileSync(resolve(process.cwd(), "app/leverandor/meny/page.tsx"), "utf8");
    expect(source).toContain("buildProviderMenuRuntimeMappingProposalPresentation");
    expect(source).toContain("buildMenuProfileRuntimeMapping");
    expect(source).toContain("runtimeMappingProposal={runtimeMappingProposal}");
    expect(source).not.toContain("menu-catalog");
    expect(source).not.toContain("menu-days");
    expect(source).not.toContain("lp_order_set");
  });
});

describe("G5d.2 scope check — proposal module isolation", () => {
  const CHANGED = [
    "lib/provider-menu/providerMenuRuntimeMappingProposal.ts",
    "components/providers/ProviderMenuRuntimeMappingProposalPanel.tsx",
    "app/leverandor/meny/page.tsx",
  ];

  test("changed files do not import order write-path or menuDayPayload", () => {
    for (const rel of CHANGED) {
      const source = readFileSync(resolve(process.cwd(), rel), "utf8");
      expect(source).not.toContain("lp_order_set");
      expect(source).not.toContain("lp_order_advance_status");
      expect(source).not.toContain("menuDayPayload");
      expect(source).not.toContain("syncMenuServiceDayItems");
    }
  });

  test("proposal view model is pure — no React, API, DB, Sanity, billing", () => {
    const source = readFileSync(
      resolve(process.cwd(), "lib/provider-menu/providerMenuRuntimeMappingProposal.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/from ["']react/);
    expect(source).not.toContain("next/server");
    expect(source).not.toContain("supabase");
    expect(source).not.toContain("sanity");
    expect(source).not.toMatch(/tripletex/i);
  });

  test("proposal panel does not import API/order/week/publish paths", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/providers/ProviderMenuRuntimeMappingProposalPanel.tsx"),
      "utf8",
    );
    expect(source).not.toContain("@/app/api");
    expect(source).not.toContain("menuDayPayload");
    expect(source).not.toContain("lp_order_set");
    expect(source).not.toContain("menu-publish");
  });
});
