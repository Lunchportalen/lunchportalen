// lib/providers/saveProviderLogo.ts
"use server";

import { revalidatePath } from "next/cache";

import { hasProviderRole } from "@/lib/auth/provider";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { brandHexHasReadableContrast, normalizeBrandHex } from "@/lib/providers/brandColor";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

const LOGO_BUCKET = "provider-logos";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

// Kun logoformater. JPG er bevisst utelatt (logo skal ha transparent/ren
// bakgrunn, ikke være foto/banner/reklamegrafikk). SVG er bevisst utelatt
// inntil trygg sanitering er på plass.
const ALLOWED_LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/webp": "webp",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProviderLogoResult =
  | { ok: true; logoUrl: string | null }
  | { ok: false; error: string };

function storagePathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${LOGO_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length).split("?")[0];
  return path || null;
}

async function requireProviderAdmin(providerIdRaw: unknown): Promise<
  | { ok: true; providerId: string; userId: string }
  | { ok: false; error: string }
> {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) return { ok: false, error: "Ikke innlogget." };

  const providerId = String(providerIdRaw ?? "").trim();
  if (!UUID_RE.test(providerId)) return { ok: false, error: "Ugyldig provider." };

  const allowed = await hasProviderRole(auth.user.id, providerId, "provider_admin");
  if (!allowed) return { ok: false, error: "Ingen tilgang." };

  return { ok: true, providerId, userId: auth.user.id };
}

async function readCurrentLogoUrl(providerId: string): Promise<string | null> {
  try {
    const sb = await supabaseServer();
    const { data } = await (sb as any)
      .from("providers")
      .select("logo_url")
      .eq("id", providerId)
      .maybeSingle();
    const url = String(data?.logo_url ?? "").trim();
    return url || null;
  } catch {
    return null;
  }
}

/** Best-effort cleanup of a replaced/removed logo object. Never blocks the result. */
async function deleteLogoObject(previousUrl: string | null): Promise<void> {
  if (!previousUrl) return;
  const path = storagePathFromPublicUrl(previousUrl);
  if (!path || !path.startsWith("providers/")) return;
  try {
    await supabaseAdmin().storage.from(LOGO_BUCKET).remove([path]);
  } catch {
    // Orphaned objects are acceptable; the DB row is the source of truth.
  }
}

/**
 * Upload a provider logo (provider_admin only).
 * - Storage write happens server-side with the admin client (no client-side
 *   storage access, no storage RLS surface).
 * - providers.logo_url is updated via the session client so providers RLS
 *   (providers_update_admin) stays authoritative.
 * - Path is provider-scoped: providers/{provider_id}/logo-{uuid}.{ext}
 */
export async function saveProviderLogo(formData: FormData): Promise<ProviderLogoResult> {
  const guard = await requireProviderAdmin(formData.get("providerId"));
  if (guard.ok === false) return { ok: false, error: guard.error };

  const file = formData.get("file");
  if (!file || !(file instanceof Blob) || file.size === 0) {
    return { ok: false, error: "Velg en logofil." };
  }

  const contentType = String((file as File).type ?? "").toLowerCase();
  const ext = ALLOWED_LOGO_TYPES[contentType];
  if (!ext) return { ok: false, error: "Logoen må være PNG eller WebP. Bruk helst logo med transparent bakgrunn." };
  if (file.size > MAX_LOGO_BYTES) return { ok: false, error: "Logoen er for stor. Maks størrelse er 2 MB." };

  if (!hasSupabaseAdminConfig()) return { ok: false, error: "Opplasting er ikke tilgjengelig akkurat nå." };

  const previousUrl = await readCurrentLogoUrl(guard.providerId);
  const objectPath = `providers/${guard.providerId}/logo-${crypto.randomUUID()}.${ext}`;

  try {
    const admin = supabaseAdmin();
    const { error: uploadError } = await admin.storage.from(LOGO_BUCKET).upload(objectPath, file, {
      cacheControl: "31536000",
      contentType,
      upsert: false,
    });
    if (uploadError) return { ok: false, error: "Kunne ikke laste opp logoen." };

    const { data: urlData } = admin.storage.from(LOGO_BUCKET).getPublicUrl(objectPath);
    const publicUrl = String(urlData?.publicUrl ?? "").trim();
    if (!publicUrl) {
      await deleteLogoObject(publicUrl || null);
      return { ok: false, error: "Kunne ikke hente logo-URL." };
    }

    const sb = await supabaseServer();
    const { error: updateError } = await (sb as any)
      .from("providers")
      .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", guard.providerId);

    if (updateError) {
      await admin.storage.from(LOGO_BUCKET).remove([objectPath]);
      return { ok: false, error: "Kunne ikke lagre logoen." };
    }

    await deleteLogoObject(previousUrl);

    revalidatePath("/leverandor");
    revalidatePath("/leverandor/innstillinger");
    return { ok: true, logoUrl: publicUrl };
  } catch {
    return { ok: false, error: "Uventet feil ved opplasting." };
  }
}

export type ProviderBrandColorResult =
  | { ok: true; primaryColor: string | null }
  | { ok: false; error: string };

/**
 * Save the provider accent color (provider_admin only).
 * Strict HEX validation + contrast guard: the color is only ever used as a
 * small accent inside Lunchportalen's design system, never on surfaces,
 * typography or primary CTAs.
 */
export async function saveProviderBrandColor(
  providerIdRaw: string,
  colorRaw: string | null,
): Promise<ProviderBrandColorResult> {
  const guard = await requireProviderAdmin(providerIdRaw);
  if (guard.ok === false) return { ok: false, error: guard.error };

  const raw = String(colorRaw ?? "").trim();
  let primaryColor: string | null = null;

  if (raw) {
    const hex = normalizeBrandHex(raw);
    if (!hex) return { ok: false, error: "Bruk HEX-format, for eksempel #F5C518." };
    if (!brandHexHasReadableContrast(hex)) {
      return { ok: false, error: "Fargen har for svak kontrast og kan ikke brukes. Velg en mørkere farge." };
    }
    primaryColor = hex;
  }

  try {
    const sb = await supabaseServer();
    const { error } = await (sb as any)
      .from("providers")
      .update({ primary_color: primaryColor, updated_at: new Date().toISOString() })
      .eq("id", guard.providerId);

    if (error) return { ok: false, error: "Kunne ikke lagre fargen." };

    revalidatePath("/leverandor");
    revalidatePath("/leverandor/innstillinger");
    return { ok: true, primaryColor };
  } catch {
    return { ok: false, error: "Uventet feil ved lagring." };
  }
}

/** Remove the provider logo (provider_admin only). */
export async function removeProviderLogo(providerIdRaw: string): Promise<ProviderLogoResult> {
  const guard = await requireProviderAdmin(providerIdRaw);
  if (guard.ok === false) return { ok: false, error: guard.error };

  const previousUrl = await readCurrentLogoUrl(guard.providerId);

  try {
    const sb = await supabaseServer();
    const { error: updateError } = await (sb as any)
      .from("providers")
      .update({ logo_url: null, updated_at: new Date().toISOString() })
      .eq("id", guard.providerId);

    if (updateError) return { ok: false, error: "Kunne ikke fjerne logoen." };

    await deleteLogoObject(previousUrl);

    revalidatePath("/leverandor");
    revalidatePath("/leverandor/innstillinger");
    return { ok: true, logoUrl: null };
  } catch {
    return { ok: false, error: "Uventet feil ved fjerning." };
  }
}
