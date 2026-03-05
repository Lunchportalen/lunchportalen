import "server-only";

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export function isContentPageId(id: string): boolean {
  return UUID_REGEX.test(id);
}

export async function getPageIdBySlug(slug: string): Promise<string | null> {
  if (!slug || typeof slug !== "string") return null;
  const s = slug.trim().toLowerCase();
  if (!s) return null;
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("content_pages")
    .select("id")
    .eq("slug", s)
    .maybeSingle();
  if (error || !data?.id) return null;
  return String(data.id);
}
