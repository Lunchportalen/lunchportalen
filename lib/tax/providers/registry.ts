/**
 * Provider registry — no vendor lock-in in domain objects.
 */

import { TestFixtureProvider } from "@/lib/tax/providers/testFixtureProvider";
import type { TaxJurisdictionProvider } from "@/lib/tax/providers/types";

export class OfficialDatasetProvider implements TaxJurisdictionProvider {
  readonly name = "OfficialDatasetProvider";
  readonly version = "15g2b.official.stub";
  resolveAddress() {
    return {
      ok: false as const,
      code: "BLOCKED" as const,
      message: "OfficialDatasetProvider not loaded for this environment",
      meta: {
        providerName: this.name,
        providerVersion: this.version,
        requestedAt: new Date().toISOString(),
        evidenceReference: null,
      },
    };
  }
  resolveAuthorities() {
    return [];
  }
  resolveRates() {
    return {
      ok: false as const,
      code: "CREDENTIAL_REQUIRED" as const,
      message: "Official dataset credentials/files required",
      meta: {
        providerName: this.name,
        providerVersion: this.version,
        requestedAt: new Date().toISOString(),
        evidenceReference: null,
      },
    };
  }
  resolveProductTaxability() {
    return null;
  }
  resolveFeeTaxability() {
    return null;
  }
  resolveNexusRequirements() {
    return {
      registrationLikelyRequired: true,
      marketplaceFacilitatorApplicable: null,
      notes: "Official dataset not configured",
    };
  }
  validateExemption() {
    return { ok: false, code: "PROVIDER_NOT_READY" };
  }
  getEffectiveDate() {
    return null;
  }
  getEvidenceReference() {
    return null;
  }
}

export class ExternalJurisdictionProvider implements TaxJurisdictionProvider {
  readonly name = "ExternalJurisdictionProvider";
  readonly version = "15g2b.external.stub";
  resolveAddress() {
    return {
      ok: false as const,
      code: "TIMEOUT" as const,
      message: "EXTERNAL_CREDENTIAL_REQUIRED",
      meta: {
        providerName: this.name,
        providerVersion: this.version,
        requestedAt: new Date().toISOString(),
        evidenceReference: null,
      },
    };
  }
  resolveAuthorities() {
    return [];
  }
  resolveRates() {
    return {
      ok: false as const,
      code: "CREDENTIAL_REQUIRED" as const,
      message: "External jurisdiction API credentials required",
      meta: {
        providerName: this.name,
        providerVersion: this.version,
        requestedAt: new Date().toISOString(),
        evidenceReference: null,
      },
    };
  }
  resolveProductTaxability() {
    return null;
  }
  resolveFeeTaxability() {
    return null;
  }
  resolveNexusRequirements() {
    return {
      registrationLikelyRequired: true,
      marketplaceFacilitatorApplicable: null,
      notes: "EXTERNAL_CREDENTIAL_REQUIRED",
    };
  }
  validateExemption() {
    return { ok: false, code: "EXTERNAL_CREDENTIAL_REQUIRED" };
  }
  getEffectiveDate() {
    return null;
  }
  getEvidenceReference() {
    return null;
  }
}

let active: TaxJurisdictionProvider = new TestFixtureProvider();

export function getTaxJurisdictionProvider(): TaxJurisdictionProvider {
  return active;
}

export function setTaxJurisdictionProviderForTests(provider: TaxJurisdictionProvider): void {
  active = provider;
}

export function resetTaxJurisdictionProvider(): void {
  active = new TestFixtureProvider();
}
