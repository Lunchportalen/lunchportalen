// lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function supabaseServer() {
  const cookieStore = await cookies(); // ✅ Next 16: cookies() er async hos deg

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // ✅ Ny anbefalt form i @supabase/ssr: getAll / setAll
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set({ name, value, ...options });
            });
          } catch {
            // I enkelte server-kontekster kan set feile (ok).
            // Auth-helpers/SSR håndterer fortsatt lesing.
          }
        },
      },
    }
  );
}
