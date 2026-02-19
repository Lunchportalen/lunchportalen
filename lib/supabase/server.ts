// lib/supabase/server.ts
import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function mustEnv(name: string) {
  const v = String(process.env[name] ?? "").trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

/**
 * ✅ Enterprise: SSR auth via httpOnly cookies (single truth)
 * - Reads cookies from Next headers()
 * - Writes cookies back via setAll()
 */
export async function supabaseServer() {
  const cookieStore = await cookies();

  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // NOTE: This can throw in some edge contexts; ignore safely.
        try {
          for (const c of cookiesToSet) {
            cookieStore.set(c.name, c.value, c.options);
          }
        } catch {
          // ignore
        }
      },
    },
  });
}
