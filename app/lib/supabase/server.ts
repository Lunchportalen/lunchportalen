// lib/supabase/server.ts
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function supabaseServer() {
  // Next 15: cookies()/headers() er async
  const cookieStore = await cookies();
  const hdrs = await headers();

  const host = hdrs.get("host") || "";
  const isLocalhost =
    host.startsWith("localhost") || host.startsWith("127.0.0.1");

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // ✅ Må støtte SSR/route-handlers
        getAll() {
          return cookieStore.getAll();
        },

        // ✅ Supabase setter/roterer auth-cookies her
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // options kan inneholde httpOnly/secure/sameSite/path/domain/maxAge
              const patched: any = { ...options };

              // Lokal dev: unngå at secure/domain/samesite blokkerer cookies
              if (isLocalhost) {
                patched.secure = false;
                patched.sameSite = "lax";
                delete patched.domain;
              }

              // cookieStore.set forventer { name, value, ...options }
              cookieStore.set({
                name,
                value,
                ...patched,
              });
            });
          } catch {
            // I enkelte server contexts kan set feile – det er ok å ignorere
          }
        },
      },
    }
  );
}
