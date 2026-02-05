import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

type ProfileRow = {
  role: string | null;
  disabled_at: string | null;
};

export async function requireSuperadmin(nextPath = "/superadmin") {
  const sb = await supabaseServer();

  // 1) Auth
  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr || !auth?.user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  // 2) Profile gate (profiles.id = auth.user.id)
  const { data: prof, error: profErr } = await sb
    .from("profiles")
    .select("role, disabled_at")
    .eq("id", auth.user.id)
    .maybeSingle<ProfileRow>();

  // Mangler profil eller DB-feil -> tilbake til login (med riktig next)
  if (profErr || !prof) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  // Deaktivert konto
  if (prof.disabled_at) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  // 3) Role gate
  if (String(prof.role ?? "").toLowerCase() !== "superadmin") {
    // superadmin-only -> send til ansatt/firma-hjem
    redirect("/week");
  }

  return { sb, user: auth.user };
}
