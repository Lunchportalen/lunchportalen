// lib/auth/resolveLoginDestination.ts
import "server-only";

import { roleHomePath } from "@/lib/auth/roleHome";
import { normalizeRole, type Role } from "@/lib/auth/role";
import type { ProviderRole } from "@/lib/providers/types";

export type ResolveLoginDestinationInput = {
  role: Role | string | null | undefined;
  hasActiveAgreement: boolean;
  providerRole?: ProviderRole | null;
  isPlatformAdmin?: boolean;
};

/**
 * Canonical post-login destination resolver.
 *
 * Pure function: same inputs → same output. No DB, no side effects.
 * Delegates to `roleHomePath` (single source of truth).
 * Callers supply `hasActiveAgreement` and optional provider role from memberships.
 */
export function resolveLoginDestination(input: ResolveLoginDestinationInput): string {
  const role = normalizeRole(input.role);
  const isPlatformAdmin = input.isPlatformAdmin ?? role === "superadmin";

  return roleHomePath({
    profileRole: input.role,
    providerRole: input.providerRole ?? null,
    isPlatformAdmin,
    hasActiveAgreement: input.hasActiveAgreement,
  });
}
