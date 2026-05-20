"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { hasProviderRole } from "@/lib/auth/provider";
import { serviceAreaFormSchema, normalizePostal } from "@/lib/providers/serviceAreaSchema";
import { supabaseServer } from "@/lib/supabase/server";

export type ServiceAreaActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function mapRpcError(message: string): string {
  const m = message;
  if (m.includes("PERMISSION_DENIED")) return "Du har ikke tilgang til å endre dette området.";
  if (m.includes("POSTAL_CODE_FORMAT_INVALID")) return "Postnummer må være 4 siffer.";
  if (m.includes("POSTAL_RANGE_INVALID")) return "Fra-postnummer kan ikke være høyere enn til.";
  if (m.includes("EMPLOYEE_RANGE_INVALID")) return "Ugyldig ansatt-intervall.";
  if (m.includes("POSTAL_RANGE_OVERLAPS_EXISTING")) {
    const match = m.match(/POSTAL_RANGE_OVERLAPS_EXISTING:([^:]+):(\d{4})-(\d{4})/);
    if (match) {
      return `Overlapper med ${match[1]}: ${match[2]}–${match[3]}`;
    }
    return "Postnummer-intervallet overlapper et eksisterende aktivt område.";
  }
  if (m.includes("SERVICE_AREA_NOT_FOUND")) return "Området ble ikke funnet.";
  return "Kunne ikke lagre området. Prøv igjen.";
}

async function assertProviderAdmin(providerId: string) {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) {
    return { ok: false as const, error: "Ikke innlogget." };
  }
  const allowed = await hasProviderRole(auth.user.id, providerId, "provider_admin");
  if (!allowed) return { ok: false as const, error: "Kun provider-admin kan endre områder." };
  return { ok: true as const };
}

export async function saveServiceArea(
  providerId: string,
  areaId: string | null,
  input: unknown,
): Promise<ServiceAreaActionResult> {
  const gate = await assertProviderAdmin(providerId);
  if (!gate.ok) return { success: false, error: gate.error };

  const parsed = serviceAreaFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Ugyldig skjema." };
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

  if (error) return { success: false, error: mapRpcError(error.message) };

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
  if (!gate.ok) return { success: false, error: gate.error };

  const sb = await supabaseServer();
  const { error } = await sb.rpc("lp_service_area_toggle_active", {
    p_id: areaId,
    p_active: active,
  });

  if (error) return { success: false, error: mapRpcError(error.message) };

  revalidatePath("/leverandor/omrader");
  return { success: true, id: areaId };
}
