// lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  // ✅ Hos deg er cookies() async (Next 16-oppsett)
  const cookieStore = await cookies();

  return createServerClient(url, anon, {
    cookies: {
      // ✅ Anbefalt i @supabase/ssr
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set({
              name,
              value,
              ...(options ?? {}),
            });
          });
        } catch {
          // Noen server-kontekster tillater ikke set (f.eks. static rendering).
          // Det er ok – SSR kan fortsatt lese session fra cookies.
        }
      },
    },
  });
}
