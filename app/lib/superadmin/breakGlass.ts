// lib/superadmin/breakGlass.ts
import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

export type BreakGlassPurpose = "DRIFT" | "SUPPORT" | "SECURITY" | "OFFBOARDING" | "LEGAL";

export type BreakGlassSession = {
  id: string;
  actor_user_id: string;
  actor_email: string | null;
  purpose: BreakGlassPurpose | string;
  note: string | null;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
};

export function isActiveSession(s: BreakGlassSession | null) {
  if (!s) return false;
  if (s.ended_at) return false;
  return new Date(s.expires_at).getTime() > Date.now();
}

export async function getActiveBreakGlass(actorUserId: string): Promise<BreakGlassSession | null> {
  const sb = await supabaseServer();

  // Active = ended_at is null AND expires_at > now
  const { data, error } = await sb
    .from("break_glass_sessions")
    .select("id,actor_user_id,actor_email,purpose,note,started_at,expires_at,ended_at")
    .eq("actor_user_id", actorUserId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`break_glass read failed: ${error.message}`);

  const row = (data as any) as BreakGlassSession | null;
  if (!row) return null;
  if (!isActiveSession(row)) return null;
  return row;
}

export function requirePurpose(purpose: any) {
  const v = String(purpose ?? "").trim().toUpperCase();
  const ok = v === "DRIFT" || v === "SUPPORT" || v === "SECURITY" || v === "OFFBOARDING" || v === "LEGAL";
  if (!ok) throw new Error("PURPOSE_REQUIRED");
  return v as BreakGlassPurpose;
}
