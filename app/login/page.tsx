// app/login/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "./LoginForm";
import { supabaseServer } from "@/lib/supabase/server";

function safeNextPath(next: string | null | undefined) {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  if (next.startsWith("/login")) return null;

  if (
    next === "/register" ||
    next.startsWith("/register/") ||
    next === "/registrering" ||
    next.startsWith("/registrering/") ||
    next === "/forgot-password" ||
    next.startsWith("/forgot-password/") ||
    next === "/reset-password" ||
    next.startsWith("/reset-password/")
  ) {
    return null;
  }

  return next;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await Promise.resolve(searchParams);
  const nextRaw = Array.isArray(sp.next) ? sp.next[0] : sp.next ?? null;
  const nextSafe = safeNextPath(nextRaw);

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  const user = data?.user ?? null;

  if (!error && user) {
    const to = `/api/auth/post-login${
      nextSafe ? `?next=${encodeURIComponent(nextSafe)}` : ""
    }`;
    redirect(to);
  }

  return (
    <AuthShell title="Logg inn" subtitle="Tilgang for ansatte og administrator.">
      <LoginForm />
    </AuthShell>
  );
}
