// lib/auth/getSessionUser.ts
import { supabaseServer } from "@/lib/supabase/server";

export type SessionUser = {
  userId: string;
  email: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.getUser();
    const user = data?.user ?? null;
    if (error || !user) return null;
    return { userId: user.id, email: user.email ?? null };
  } catch {
    return null;
  }
}
