import "server-only";

import { supabaseServer } from "@/lib/supabase/server";

export type ServiceAreaRow = {
  id: string;
  provider_id: string;
  country: string;
  city: string;
  postal_code_from: string;
  postal_code_to: string;
  min_employees: number | null;
  max_employees: number | null;
  available_days: string[];
  active: boolean;
  created_at: string;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeDays(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((d) => safeStr(d).toLowerCase()).filter(Boolean);
}

export async function loadServiceAreas(providerId: string): Promise<ServiceAreaRow[]> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("provider_service_areas")
    .select(
      "id, provider_id, country, city, postal_code_from, postal_code_to, min_employees, max_employees, available_days, active, created_at",
    )
    .eq("provider_id", providerId)
    .order("active", { ascending: false })
    .order("city", { ascending: true })
    .order("postal_code_from", { ascending: true });

  if (error) throw new Error(error.message);

  return (Array.isArray(data) ? data : []).map((row) => ({
    id: safeStr(row.id),
    provider_id: safeStr(row.provider_id),
    country: safeStr(row.country) || "NO",
    city: safeStr(row.city),
    postal_code_from: safeStr(row.postal_code_from),
    postal_code_to: safeStr(row.postal_code_to),
    min_employees: row.min_employees ?? null,
    max_employees: row.max_employees ?? null,
    available_days: normalizeDays(row.available_days),
    active: Boolean(row.active),
    created_at: safeStr(row.created_at),
  }));
}

export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: "Man",
  tue: "Tir",
  wed: "Ons",
  thu: "Tor",
  fri: "Fre",
};
