import "server-only";

import { MELHUS_PROVIDER_SANITY_ID } from "@/lib/cms/providerSanityConstants";
import { requireSanityWrite } from "@/lib/sanity/client";
import { supabaseServer } from "@/lib/supabase/server";
import type { Provider, ProviderStatus } from "@/lib/providers/types";

export type SyncProviderToSanityResult = {
  ok: boolean;
  providerId: string;
  sanityId: string;
  created: boolean;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function mapStatus(raw: unknown): ProviderStatus {
  const s = safeStr(raw).toUpperCase();
  if (s === "PAUSED" || s === "SUSPENDED" || s === "CLOSED") return s;
  return "ACTIVE";
}

function toSanityProviderDoc(row: Pick<Provider, "id" | "name" | "slug" | "logoUrl" | "primaryColor" | "status">) {
  // Fail-closed: aldri Melhus (eller annen default) som erstatning for tomme providerfelt.
  const name = safeStr(row.name);
  const slug = safeStr(row.slug);
  if (!name || !slug) {
    throw new Error(
      `syncProviderToSanity: provider ${safeStr(row.id) || "(ukjent id)"} mangler ${!name ? "name" : "slug"} — fail-closed, ingen Melhus-fallback.`,
    );
  }
  return {
    _id: row.id,
    _type: "provider" as const,
    name,
    slug: { _type: "slug" as const, current: slug },
    logoUrl: row.logoUrl ?? undefined,
    primaryColor: row.primaryColor ?? undefined,
    status: mapStatus(row.status),
    lastSyncedAt: new Date().toISOString(),
  };
}

/**
 * Upsert provider mirror document in Sanity (menu filtering metadata only).
 * Manual entry point until Patch 14 wires server actions.
 */
export async function syncProviderToSanity(providerId: string): Promise<SyncProviderToSanityResult> {
  const pid = safeStr(providerId);
  if (!pid) throw new Error("syncProviderToSanity: providerId required");

  const sb = await supabaseServer();
  const { data, error } = await (sb as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, id: string) => {
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
        };
      };
    };
  })
    .from("providers")
    .select("id, name, slug, logo_url, primary_color, status")
    .eq("id", pid)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`syncProviderToSanity: provider not found (${pid})`);
  }

  const row = data as Record<string, unknown>;
  const provider: Pick<Provider, "id" | "name" | "slug" | "logoUrl" | "primaryColor" | "status"> = {
    id: safeStr(row.id),
    name: safeStr(row.name),
    slug: safeStr(row.slug),
    logoUrl: row.logo_url != null ? safeStr(row.logo_url) : null,
    primaryColor: row.primary_color != null ? safeStr(row.primary_color) : null,
    status: mapStatus(row.status),
  };

  const write = requireSanityWrite();
  const doc = toSanityProviderDoc(provider);
  const existing = await write.fetch<boolean>(`*[_id == $id][0]._id != null`, { id: doc._id });
  await write.createOrReplace(doc);

  return {
    ok: true,
    providerId: pid,
    sanityId: doc._id,
    created: !existing,
  };
}

/** Convenience: sync default Melhus provider (Patch 5 seed). */
export async function syncMelhusProviderToSanity() {
  return syncProviderToSanity(MELHUS_PROVIDER_SANITY_ID);
}
