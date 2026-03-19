/**
 * AI Foundation: central capability registry.
 * Single source of truth for AI capability metadata: schemas, context, safety, and target surfaces.
 * Not connected to UI; consumed by suggest route, tool selection, and future orchestration.
 */

/** JSON Schema–compatible shape for input/output validation and documentation. */
export type SchemaRef = {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  description?: string;
  [key: string]: unknown;
};

/** Context keys the capability requires to run (e.g. blocks, locale, pageId). */
export type RequiredContext = string[];

/** Safety rule: code or structured constraint. */
export type SafetyConstraint =
  | string
  | { code: string; description?: string; enforce?: "hard" | "soft" };

/** Surfaces where this capability can be invoked (e.g. backoffice, editor, api). */
export type TargetSurface = string;

export type Capability = {
  name: string;
  description: string;
  requiredContext: RequiredContext;
  inputSchema: SchemaRef;
  outputSchema: SchemaRef;
  safetyConstraints: SafetyConstraint[];
  targetSurfaces: TargetSurface[];
};

const registry = new Map<string, Capability>();

/**
 * Registers a capability by name. Re-registration overwrites (deterministic).
 */
export function registerCapability(capability: Capability): void {
  const name = capability.name?.trim();
  if (!name) {
    throw new Error("[capabilityRegistry] capability.name is required");
  }
  registry.set(name, { ...capability });
}

/**
 * Returns the capability for the given name, or null if not registered.
 */
export function getCapability(name: string): Capability | null {
  const cap = registry.get(name?.trim() ?? "");
  return cap ? { ...cap } : null;
}

/**
 * Returns all registered capabilities. Order is insertion order.
 */
export function listCapabilities(): Capability[] {
  return Array.from(registry.values()).map((cap) => ({ ...cap }));
}
