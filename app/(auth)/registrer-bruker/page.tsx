export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import crypto from "node:crypto";
import Link from "next/link";

import PageShell from "@/components/PageShell";
import { supabaseAdmin } from "@/lib/supabase/admin";

import RegisterCompanyAdminClient from "./RegisterCompanyAdminClient";

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
    <PageShell>
      <main className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-4 py-10">
        <section className="w-full rounded-3xl border bg-white/85 p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-text">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{text}</p>
          <Link href="/kontakt" className="mt-6 inline-flex min-h-[44px] items-center rounded-2xl border bg-white px-4 text-sm font-semibold">
            Kontakt oss
          </Link>
        </section>
      </main>
    </PageShell>
  );
}

export default async function RegisterCompanyAdminPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const sp = await Promise.resolve(searchParams ?? {});
  const token = safeStr(firstParam(sp?.token));
  if (!token) {
    return <MessageCard title="Lenken mangler token" text="Be superadmin sende en ny invitasjon til firmaadministrator." />;
  }

  const admin = supabaseAdmin();
  const tokenHash = hashToken(token);
  const { data: invite, error } = await (admin as any)
    .from("company_invites")
    .select("id, company_id, contact_email, contact_name, expires_at, used_at, companies:company_id(name)")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !invite) {
    return <MessageCard title="Ugyldig invitasjon" text="Invitasjonslenken er ugyldig eller finnes ikke lenger." />;
  }
  if (invite.used_at) {
    return <MessageCard title="Invitasjonen er brukt" text="Denne invitasjonen er allerede brukt. Logg inn eller kontakt oss for ny tilgang." />;
  }
  if (!invite.expires_at || new Date(invite.expires_at).getTime() <= Date.now()) {
    return <MessageCard title="Invitasjonen er utløpt" text="Lenken er ikke lenger gyldig. Be om en ny invitasjon." />;
  }

  const companyName = safeStr(invite.companies?.name) || "Lunchportalen";
  const email = safeStr(invite.contact_email).toLowerCase();
  const name = safeStr(invite.contact_name);

  return (
    <PageShell>
      <main className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-4 py-10">
        <section className="w-full rounded-3xl border bg-white/85 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Firmaadministrator</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text">Fullfør opprettelsen</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Avtalen er godkjent. Opprett innlogging for {companyName}, så sendes du videre til adminområdet.
          </p>
          <div className="mt-6">
            <RegisterCompanyAdminClient token={token} email={email} initialName={name} companyName={companyName} />
          </div>
        </section>
      </main>
    </PageShell>
  );
}
