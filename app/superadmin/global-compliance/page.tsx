// Superadmin — global tax/legal/e-invoice compliance readiness (Phase 15G.2)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { requireSuperadmin } from "@/lib/superadmin/auth";
import { evaluateTechnical21Complete } from "@/lib/markets/technicalCompletionGate";
import { evaluateGlobal21Ready } from "@/lib/markets/globalActivationGate";
import {
  countCanadaFixtureCoverage,
  countUsFixtureCoverage,
} from "@/lib/tax/providers/testFixtureProvider";
import { countMarketplaceApprovals } from "@/lib/markets/marketplaceLegalModel";
import { countEInvoiceApprovals } from "@/lib/invoice/eInvoiceRegistry";
import { countLegalDocumentApprovals } from "@/lib/legal/legalDocumentRegistry";
import { credentialDependencies } from "@/lib/invoice/eInvoiceAdapters";
import { countTaxPacksByStatus } from "@/lib/tax/packs/countryTaxPacks";
import { countTechnicalTaxConfiguration } from "@/lib/tax/rules/technicallyConfiguredRules";

export default async function GlobalCompliancePage() {
  await requireSuperadmin();

  // Honest: staging/CI flags are not inferred green from UI load.
  const technical = evaluateTechnical21Complete({
    fullCiGreen: false,
    stagingCountriesPassed: 0,
    stagingLocalesPassed: 0,
    unresolvedP0P1: 0,
    rollbackCertified: false,
  });
  const global = evaluateGlobal21Ready({ stagingGoldenPathPass: 0 });
  const us = countUsFixtureCoverage();
  const ca = countCanadaFixtureCoverage();
  const market = countMarketplaceApprovals();
  const eInv = countEInvoiceApprovals();
  const legal = countLegalDocumentApprovals();
  const tax = countTaxPacksByStatus();
  const taxTech = countTechnicalTaxConfiguration();
  const creds = credentialDependencies();

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pt-[27px]">
      <h1 className="text-2xl font-semibold tracking-tight">Global compliance readiness</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Read-only control tower. RESEARCHED is not APPROVED. Staging/CI status must be proven externally — this page
        never invents green gates.
      </p>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Decision</p>
          <p className="mt-1 text-lg font-semibold">{technical.decision}</p>
          <p className="mt-1 text-sm text-neutral-600">
            TECHNICAL_21_COMPLETE={technical.technical21Complete ? "YES" : "NO"} · GLOBAL_21_READY=
            {global.global21Ready ? "YES" : "NO"}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Human approvals</p>
          <p className="mt-1 text-sm">
            Tax {tax.APPROVED}/21 · Legal {legal.legalApproved} docs · Privacy {legal.privacyApproved}/21 · E-invoice{" "}
            {eInv.approvedOrNa}/21 · Marketplace {market.APPROVED}/21 · Native locales {legal.nativeApprovedLocales}/24
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Jurisdictions</p>
          <p className="mt-1 text-sm">
            US technical {us.technicallySupported + us.notApplicable}/51 (blocked {us.blocked}) · CA technical{" "}
            {ca.technicallySupported}/13 · Tax rules configured {taxTech.ruleCount} (approved {taxTech.approved})
          </p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Blockers</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
          {technical.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Credential dependencies (e-invoice)</h2>
        <p className="mt-1 text-sm text-neutral-600">{creds.length} explicit dependencies — mocks must not claim live registration.</p>
        <ul className="mt-2 max-h-64 list-disc space-y-1 overflow-auto pl-5 text-sm text-neutral-700">
          {creds.slice(0, 40).map((c) => (
            <li key={c.dependency}>
              {c.countryCode}: {c.dependency}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
