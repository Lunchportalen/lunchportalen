"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { hasProviderRole } from "@/lib/auth/provider";
import {
  coverageActionFailure,
  mapServiceAreaRpcErrorKey,
  mapServiceAreaZodErrorKey,
  type ProviderCoverageActionErrorKey,
} from "@/lib/providers/providerCoverageActionErrors";
import { serviceAreaFormSchema, normalizePostal } from "@/lib/providers/serviceAreaSchema";
import { supabaseServer } from "@/lib/supabase/server";

export type ServiceAreaActionResult =
  | { success: true; id?: string }
  | { success: false; errorKey: ProviderCoverageActionErrorKey };

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

async function assertProviderAdmin(providerId: string) {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) {
    return { ok: false as const, errorKey: "notAuthenticated" as const };
  }
  const allowed = await hasProviderRole(auth.user.id, providerId, "provider_admin");
  if (!allowed) return { ok: false as const, errorKey: "providerAdminRequired" as const };
  return { ok: true as const };
}

export async function saveServiceArea(
  providerId: string,
  areaId: string | null,
  input: unknown,
): Promise<ServiceAreaActionResult> {
  const gate = await assertProviderAdmin(providerId);
  if (!gate.ok) return coverageActionFailure(gate.errorKey);

  const parsed = serviceAreaFormSchema.safeParse(input);
  if (!parsed.success) {
    return coverageActionFailure(mapServiceAreaZodErrorKey(parsed.error.issues[0]));
  }

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("lp_service_area_save", {
    p_id: areaId || null,
    p_provider_id: providerId,
    p_city: parsed.data.city,
    p_postal_code_from: normalizePostal(parsed.data.postal_code_from),
    p_postal_code_to: normalizePostal(parsed.data.postal_code_to),
    p_min_employees: parsed.data.min_employees ?? null,
    p_max_employees: parsed.data.max_employees ?? null,
    p_available_days: parsed.data.available_days,
    p_active: parsed.data.active,
  });

  if (error) return coverageActionFailure(mapServiceAreaRpcErrorKey(error.message));

  const row = (data ?? {}) as Record<string, unknown>;
  revalidatePath("/leverandor/omrader");
  return { success: true, id: safeStr(row.id) || undefined };
}

export async function toggleServiceArea(
  providerId: string,
  areaId: string,
  active: boolean,
): Promise<ServiceAreaActionResult> {
  const gate = await assertProviderAdmin(providerId);
  if (!gate.ok) return coverageActionFailure(gate.errorKey);

  const sb = await supabaseServer();
  const { error } = await sb.rpc("lp_service_area_toggle_active", {
    p_id: areaId,
    p_active: active,
  });

  if (error) return coverageActionFailure(mapServiceAreaRpcErrorKey(error.message));

  revalidatePath("/leverandor/omrader");
  return { success: true, id: areaId };
}
