"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    })();
  }, [router]);

  return (
    <main className="p-6">
      <p className="text-sm opacity-80">Logger ut…</p>
    </main>
  );
}
