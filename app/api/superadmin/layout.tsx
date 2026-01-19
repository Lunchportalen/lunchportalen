// app/superadmin/layout.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/login");

  // 🔒 Låst rolle
  const role = data.user.user_metadata?.role;
  if (role !== "superadmin") redirect("/");

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b bg-surface">
        <div className="mx-auto max-w-7xl p-4 font-semibold">Superadmin</div>
      </header>
      <main className="mx-auto max-w-7xl p-6">{children}</main>
    </div>
  );
}
