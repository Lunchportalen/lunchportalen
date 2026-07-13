// app/(auth)/accept-invite/page.tsx
// LEGACY REDIRECT (Fase 3 — canonical invitation flow).
// The employee invite UX now lives at ONE canonical URL: /register/employee.
// This route preserves any existing/bookmarked invite links by forwarding the
// token to the canonical page. No acceptance logic runs here.
import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(sp: Record<string, unknown> | undefined, key: string): string | null {
  const v = sp?.[key];
  if (!v) return null;
  if (Array.isArray(v)) return String(v[0] ?? "");
  return String(v);
}

export default async function Page(props: PageProps) {
  const sp = (await props.searchParams) ?? {};
  const token = getParam(sp, "token");

  if (!token) redirect("/login?e=missing_token");
  redirect(`/register/employee?token=${encodeURIComponent(token)}`);
}
