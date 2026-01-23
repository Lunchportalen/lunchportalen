import { supabaseAdmin } from "@/lib/supabase/admin";

export async function adminDb(): Promise<any> {
  const s: any = supabaseAdmin as any;
  return typeof s === "function" ? await s() : s;
}
