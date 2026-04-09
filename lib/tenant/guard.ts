export class TenantIsolationError extends Error {
  readonly code = "TENANT_VIOLATION" as const;

  constructor(message = "TENANT_VIOLATION") {
    super(message);
    this.name = "TenantIsolationError";
  }
}

/**
 * Fail-closed tenant equality check for already-resolved IDs (never trust client-sent company_id alone).
 */
export function enforceTenant(resourceTenantId: string, currentTenantId: string): void {
  const a = String(resourceTenantId ?? "").trim();
  const b = String(currentTenantId ?? "").trim();
  if (!a || !b || a !== b) {
    throw new TenantIsolationError();
  }
}
