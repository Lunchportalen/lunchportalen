// lib/supabase/browser.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";

function mustEnv(name: string) {
  const v = String(process.env[name] ?? "").trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function supabaseBrowser() {
  return createBrowserClient(
    mustEnv("NEXT_PUBLIC_SUPABASE_URL"),
    mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}
