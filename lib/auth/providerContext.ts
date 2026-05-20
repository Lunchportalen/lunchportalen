// lib/auth/providerContext.ts
/**
 * Provider Admin layout context (Patch 9 prep).
 *
 * @example
 * const ctx = await getProviderAdminContext(user.id);
 * if (!ctx.primaryProvider) redirect("/login");
 */
import "server-only";

import { getProviderMemberships } from "@/lib/auth/provider";
import type { Provider, ProviderMembership, ProviderRole } from "@/lib/providers/types";
import { supabaseServer } from "@/lib/supabase/server";

export type ProviderAdminUser = {
  id: string;
  email: string | null;
};

export type ProviderAdminContext = {
  user: ProviderAdminUser;
  memberships: ProviderMembership[];
  /** First provider_admin membership, else earliest membership. */
  primaryProvider: Provider | null;
  /** Role on `primaryProvider`, or null when no memberships. */
  role: ProviderRole | null;
};

type ProviderRow = {
  id: string;
  name: string;
  slug: string;
  org_number: string | null;
  status: string;
  contact_email: string;
  contact_phone: string | null;
  logo_url: string | null;
  primary_color: string | null;
  description: string | null;
  billing_model: string;
  created_at: string;
  updated_at: string;
  suspended_at: string | null;
  suspended_by: string | null;
  suspended_reason: string | null;
  paused_at: string | null;
  paused_by: string | null;
  paused_reason: string | null;
  deleted_at: string | null;
};

function mapProviderRow(row: ProviderRow): Provider {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    orgNumber: row.org_number,
    status: row.status as Provider["status"],
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    description: row.description,
    billingModel: row.billing_model as Provider["billingModel"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    suspendedAt: row.suspended_at,
    suspendedBy: row.suspended_by,
    suspendedReason: row.suspended_reason,
    pausedAt: row.paused_at,
    pausedBy: row.paused_by,
    pausedReason: row.paused_reason,
    deletedAt: row.deleted_at,
  };
}

function pickPrimaryMembership(memberships: ProviderMembership[]): ProviderMembership | null {
  if (!memberships.length) return null;
  const admin = memberships.find((m) => m.role === "provider_admin");
  return admin ?? memberships[0] ?? null;
}

async function loadProviderById(providerId: string): Promise<Provider | null> {
  try {
    const sb = await supabaseServer();
    const { data, error } = await (sb as any)
      .from("providers")
      .select(
        "id, name, slug, org_number, status, contact_email, contact_phone, logo_url, primary_color, description, billing_model, created_at, updated_at, suspended_at, suspended_by, suspended_reason, paused_at, paused_by, paused_reason, deleted_at",
      )
      .eq("id", providerId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !data) return null;
    return mapProviderRow(data as ProviderRow);
  } catch {
    return null;
  }
}

/**
 * Aggregated context for `/leverandor` Provider Admin shell.
 *
 * @example
 * const { user, memberships, primaryProvider, role } = await getProviderAdminContext(userId);
 */
export async function getProviderAdminContext(userId: string): Promise<ProviderAdminContext> {
  const uid = String(userId ?? "").trim();
  const memberships = uid ? await getProviderMemberships(uid) : [];
  const primaryMembership = pickPrimaryMembership(memberships);
  const primaryProvider = primaryMembership ? await loadProviderById(primaryMembership.providerId) : null;

  let email: string | null = null;
  if (uid) {
    try {
      const sb = await supabaseServer();
      const { data } = await sb.auth.getUser();
      if (data?.user?.id === uid) email = data.user.email ?? null;
    } catch {
      // ignore
    }
  }

  return {
    user: { id: uid, email },
    memberships,
    primaryProvider,
    role: primaryMembership?.role ?? null,
  };
}
