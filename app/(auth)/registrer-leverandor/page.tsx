export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import crypto from "node:crypto";
import Link from "next/link";

import { supabaseAdmin } from "@/lib/supabase/admin";
import RegisterProviderAdminClient from "./RegisterProviderAdminClient";

type SearchParams = Record<string, string | string[] | undefined> | undefined;

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}
function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function MessageCard({ title, text }: { title: string; text: string }) {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-4 py-10">
      <section className="w-full rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-text">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{text}</p>
        <Link href="/kontakt" className="mt-6 inline-flex min-h-[44px] items-center rounded-2xl border bg-white px-4 text-sm font-semibold">
          Kontakt oss
        </Link>
      </section>
    </main>
  );
}

export default async function RegisterProviderAdminPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const sp = await Promise.resolve(searchParams ?? {});
  const token = safeStr(firstParam(sp?.token));
  if (!token) {
    return <MessageCard title="Lenken mangler token" text="Be superadmin sende en ny leverandørinvitasjon." />;
  }

  const admin = supabaseAdmin();
  const tokenHash = hashToken(token);
  const { data: invite, error } = await (admin as any)
    .from("provider_invites")
    .select("id, provider_id, email, full_name, expires_at, used_at, revoked_at, providers:provider_id(name)")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !invite) {
    return <MessageCard title="Ugyldig invitasjon" text="Invitasjonslenken er ugyldig eller finnes ikke lenger." />;
  }
  if (invite.revoked_at) {
    return <MessageCard title="Invitasjonen er trukket tilbake" text="Kontakt oss for en ny invitasjon." />;
  }
  if (invite.used_at) {
    return <MessageCard title="Invitasjonen er brukt" text="Denne invitasjonen er allerede brukt. Logg inn eller kontakt oss." />;
  }
  if (!invite.expires_at || new Date(invite.expires_at).getTime() <= Date.now()) {
    return <MessageCard title="Invitasjonen er utløpt" text="Lenken er ikke lenger gyldig. Be om en ny invitasjon." />;
  }

  const companyName = safeStr(invite.providers?.name) || "cateringfirmaet";
  const email = safeStr(invite.email).toLowerCase();
  const name = safeStr(invite.full_name);

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-4 py-10">
      <section className="w-full rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Leverandøradministrator</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text">Fullfør opprettelsen</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Søknaden er godkjent. Opprett innlogging for {companyName}, så sendes du videre til leverandørområdet.
        </p>
        <div className="mt-6">
          <RegisterProviderAdminClient token={token} email={email} initialName={name} companyName={companyName} />
        </div>
      </section>
    </main>
  );
}
