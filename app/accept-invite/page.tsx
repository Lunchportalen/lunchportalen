// app/accept-invite/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Accept invite – Lunchportalen",
  description: "Aktiver brukerkontoen din ved å godta invitasjonen.",
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(sp: Record<string, any> | undefined, key: string): string | null {
  const v = sp?.[key];
  if (!v) return null;
  if (Array.isArray(v)) return String(v[0] ?? "");
  return String(v);
}

export default async function Page(props: PageProps) {
  const sp = (await props.searchParams) ?? {};
  const token = getParam(sp, "token");

  // Ingen token -> ta brukeren tilbake til login
  if (!token) redirect("/login?e=missing_token");

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-text">Aktiver konto</h1>
          <p className="mt-2 text-sm text-muted">
            Opprett passord og aktiver kontoen din. Invitasjonen gjelder kun én gang.
          </p>
        </div>

        <AcceptInviteForm token={token} />
      </div>

      <p className="mx-auto mt-4 max-w-md text-center text-xs text-muted">
        Trenger du hjelp? Ta kontakt med administrator i din bedrift.
      </p>
    </main>
  );
}

/* =========================================================
   Server Action (in same file – simplest + safe)
   Uses service role to:
   - validate invite token (hash)
   - create auth user
   - create profile (YOUR schema: profiles.user_id is PK)
   - mark invite accepted
   - sign user in (password login) and redirect to role landing
========================================================= */

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { homeForRole, type Role } from "@/lib/auth/redirect";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const SUPABASE_URL = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Client-side supabase (anon) for sign-in after account is created.
// This is server-side fetch (still safe) and does NOT expose service key.
const supabaseAnon = createClient(
  SUPABASE_URL,
  mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } }
);

type InviteRow = {
  id: string;
  email: string;
  role: Role;
  company_id: string | null;
  location_id: string | null;
};

async function acceptInvite(input: { token: string; password: string; full_name?: string }) {
  const token_hash = sha256(input.token);

  // 1) Fetch invite
  const { data: invite, error: invErr } = await supabaseAdmin
    .from("user_invites")
    .select("id,email,role,company_id,location_id,expires_at,status")
    .eq("token_hash", token_hash)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .single();

  if (invErr || !invite) throw new Error("Ugyldig eller utløpt invitasjon.");

  const safeInvite = invite as InviteRow;
  const email = String(safeInvite.email).toLowerCase().trim();

  // Basic password policy (enterprise-ish minimum)
  if (!input.password || input.password.length < 10) {
    throw new Error("Passord må være minst 10 tegn.");
  }

  // 2) Create auth user via admin API (stable)
  const { data: created, error: auErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name ?? "" },
  });

  if (auErr) {
    // If user already exists, give a clean message
    const msg = String(auErr.message || "");
    if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already exists")) {
      throw new Error("Denne e-posten har allerede en konto. Logg inn i stedet.");
    }
    throw new Error(auErr.message);
  }

  const userId = created.user.id;

  // 3) Upsert profile (YOUR DB: profiles.user_id is PK)
  const { error: pErr } = await supabaseAdmin.from("profiles").upsert({
    user_id: userId,
    email,
    full_name: input.full_name ?? null,
    role: safeInvite.role,
    company_id: safeInvite.company_id,
    location_id: safeInvite.location_id,
    is_active: true,
  });

  if (pErr) throw new Error(pErr.message);

  // 4) Mark invite accepted
  const { error: updErr } = await supabaseAdmin
    .from("user_invites")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", safeInvite.id);

  if (updErr) throw new Error(updErr.message);

  // 5) Sign in user immediately (so they land logged in)
  const { error: signErr } = await supabaseAnon.auth.signInWithPassword({
    email,
    password: input.password,
  });

  // If sign-in fails, we still accept the invite; user can log in manually.
  if (signErr) {
    return { ok: true as const, landing: "/login?ok=invite_accepted" };
  }

  return { ok: true as const, landing: homeForRole(safeInvite.role) };
}

/* =========================================================
   Form (client component) – minimal, safe, enterprise vibe
========================================================= */

function AcceptInviteForm({ token }: { token: string }) {
  return (
    <form action={acceptInviteAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div>
        <label className="mb-1 block text-sm font-medium text-text">Navn (valgfritt)</label>
        <input
          name="full_name"
          type="text"
          autoComplete="name"
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-text outline-none focus:ring-2 focus:ring-[rgb(var(--lp-ring))]"
          placeholder="Ola Nordmann"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-text">Passord</label>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-text outline-none focus:ring-2 focus:ring-[rgb(var(--lp-ring))]"
          placeholder="Minst 10 tegn"
          required
          minLength={10}
        />
        <p className="mt-1 text-xs text-muted">Bruk minst 10 tegn. Gjerne en setning du husker.</p>
      </div>

      <button
        type="submit"
        className="w-full rounded-2xl bg-[rgb(var(--lp-cta))] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 active:opacity-90"
      >
        Aktiver konto
      </button>

      <p className="text-center text-xs text-muted">
        Har du allerede konto?{" "}
        <a className="underline" href="/login">
          Logg inn
        </a>
      </p>
    </form>
  );
}

/**
 * Server Action wrapper for <form action=...>
 * Reads FormData, calls acceptInvite(), then redirects.
 */
async function acceptInviteAction(formData: FormData) {
  "use server";

  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const full_name = String(formData.get("full_name") ?? "").trim() || undefined;

  if (!token) redirect("/login?e=missing_token");

  try {
    const res = await acceptInvite({ token, password, full_name });
    redirect(res.landing);
  } catch (err: any) {
    const msg = encodeURIComponent(err?.message || "Kunne ikke aktivere konto.");
    redirect(`/accept-invite?token=${encodeURIComponent(token)}&e=${msg}`);
  }
}
