/**
 * Interface only. Concrete implementation comes in Patch 5 after
 * provider DB schema (Patch 4) is in place.
 */

import type { Provider, ProviderMembership, ProviderServiceArea } from "@/lib/providers/types";

/**
 * Read-only provider lookups. Mutations (suspend/pause/delete) arrive in later patches.
 */
export interface ProviderRepository {
  /**
   * Load a provider by primary key.
   * @returns Provider row, or `null` if not found (including soft-deleted when impl filters `deleted_at`).
   * @throws On transport/DB errors only — not when the row is missing.
   * @implementation Patch 5 (Supabase-backed)
   */
  findById(id: string): Promise<Provider | null>;

  /**
   * Resolve provider by URL-safe slug.
   * @returns Provider or `null` when slug is unknown.
   * @throws On transport/DB errors.
   * @implementation Patch 5
   */
  findBySlug(slug: string): Promise<Provider | null>;

  /**
   * List providers in ACTIVE status (non-deleted per plan index semantics).
   * @returns Empty array when none match — never `null`.
   * @throws On transport/DB errors.
   * @implementation Patch 5
   */
  findActive(): Promise<Provider[]>;

  /**
   * Match providers with a service area covering the given Norwegian postal code.
   * @returns Providers with at least one active area spanning `postalCode`; empty array if none.
   * @throws On transport/DB errors.
   * @implementation Patch 5 (joins `provider_service_areas`)
   */
  findByPostalCode(postalCode: string): Promise<Provider[]>;

  /**
   * All provider memberships for a user (any role).
   * @returns Empty array when user has no memberships.
   * @throws On transport/DB errors.
   * @implementation Patch 5
   */
  listMemberships(userId: string): Promise<ProviderMembership[]>;

  /**
   * Service areas configured for a provider.
   * @returns Areas for `providerId`; empty array if provider has none.
   * @throws On transport/DB errors.
   * @implementation Patch 5
   */
  listServiceAreas(providerId: string): Promise<ProviderServiceArea[]>;
}

/**
 * Provider membership access checks (parallel to company membership patterns).
 */
export interface ProviderMembershipRepository {
  /**
   * Membership rows for a user across all providers.
   * @returns Empty array when none.
   * @throws On transport/DB errors.
   * @implementation Patch 5
   */
  findByUser(userId: string): Promise<ProviderMembership[]>;

  /**
   * Single membership for user + provider pair.
   * @returns Row or `null` when not a member.
   * @throws On transport/DB errors.
   * @implementation Patch 5
   */
  findByUserAndProvider(userId: string, providerId: string): Promise<ProviderMembership | null>;

  /**
   * Whether the user has any provider membership granting access to `providerId`.
   * @returns `false` when no row exists; `true` when membership is present (role enforced by RLS in Patch 6).
   * @throws On transport/DB errors.
   * @implementation Patch 5 (read); Patch 6 (RLS `can_access_provider`)
   */
  canAccessProvider(userId: string, providerId: string): Promise<boolean>;
}
