export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST() {
  const res = NextResponse.json({ ok: true }, { status: 200 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        res.cookies.set({
          name,
          value,
          ...options,
          secure: process.env.NODE_ENV === "production",
          sameSite: options?.sameSite ?? "lax",
          path: options?.path ?? "/",
        });
      },
      remove(name: string, options: any) {
        res.cookies.set({
          name,
          value: "",
          ...options,
          maxAge: 0,
          secure: process.env.NODE_ENV === "production",
          sameSite: options?.sameSite ?? "lax",
          path: options?.path ?? "/",
        });
      },
    },
  });

  await supabase.auth.signOut();
  return res;
}
