import "server-only";

import { requireSanityWrite } from "@/lib/sanity/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ProviderStatus } from "@/lib/providers/types";

export type SyncProviderDraftResult = {
  ok: boolean;
  providerId: string;
  sanityDraftId: string;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function mapStatus(raw: unknown): ProviderStatus {
  const s = safeStr(raw).toUpperCase();
  if (s === "PAUSED" || s === "SUSPENDED" || s === "CLOSED") return s;
  return "ACTIVE";
}

/**
 * Fase 4: create the provider Sanity mirror as a DRAFT only (drafts.<id>).
 * The provider mapping must exist (menu filtering identity) but nothing is
 * auto-PUBLISHED — publishing menus/content stays an explicit later action.
 * Fail-closed: never substitute Melhus/default for a missing provider field.
 */
export async function syncProviderToSanityDraft(providerId: string): Promise<SyncProviderDraftResult> {
  const pid = safeStr(providerId);
  if (!pid) throw new Error("syncProviderToSanityDraft: providerId required");

  const admin = supabaseAdmin();
  const { data, error } = await (admin as unknown as {
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

  if (error || !data) throw new Error(`syncProviderToSanityDraft: provider not found (${pid})`);

  const name = safeStr(data.name);
  const slug = safeStr(data.slug);
  if (!name || !slug) {
    throw new Error(
      `syncProviderToSanityDraft: provider ${pid} mangler ${!name ? "name" : "slug"} — fail-closed, ingen Melhus-fallback.`,
    );
  }

  const draftId = `drafts.${pid}`;
  const write = requireSanityWrite();
  await write.createOrReplace({
    _id: draftId,
    _type: "provider",
    name,
    slug: { _type: "slug", current: slug },
    logoUrl: data.logo_url != null ? safeStr(data.logo_url) : undefined,
    primaryColor: data.primary_color != null ? safeStr(data.primary_color) : undefined,
    status: mapStatus(data.status),
    lastSyncedAt: new Date().toISOString(),
  });

  return { ok: true, providerId: pid, sanityDraftId: draftId };
}
