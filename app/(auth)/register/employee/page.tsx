import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AcceptInviteClient from "@/app/(auth)/accept-invite/AcceptInviteClient";

export const metadata: Metadata = {
  title: "Registrer som ansatt – Lunchportalen",
  description: "Fullfør invitasjon og opprett ansattkonto.",
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(sp: Record<string, unknown> | undefined, key: string): string | null {
  const v = sp?.[key];
  if (!v) return null;
  if (Array.isArray(v)) return String(v[0] ?? "");
  return String(v);
}

function safeDecode(v: string | null) {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function mapUiError(raw: string | null) {
  if (!raw) return null;
  const msg = raw.toLowerCase();

  if (msg.includes("utløpt") || msg.includes("ugyldig") || msg.includes("invalid") || msg.includes("expired")) {
    return "Invitasjonen er ugyldig eller utløpt. Be administrator sende en ny invitasjon.";
  }

  if (msg.includes("passord")) return raw;

  if (msg.includes("annet firma") || msg.includes("mismatch") || msg.includes("company")) {
    return "Kontoen er allerede knyttet til et annet firma. Kontakt superadmin.";
  }

  if (msg.includes("ikke synlig") || msg.includes("prøv igjen") || msg.includes("try again") || msg.includes("vent")) {
    return "Kontoen opprettes. Vent et øyeblikk og prøv igjen.";
  }

  if (msg.includes("db") || msg.includes("trigger") || msg.includes("auth.users") || msg.includes("public.profiles")) {
    return "Kunne ikke aktivere konto akkurat nå. Prøv igjen om litt.";
  }

  return raw;
}

export default async function RegisterEmployeePage(props: PageProps) {
  const sp = (await props.searchParams) ?? {};
  const token = getParam(sp, "token");
  const errRaw = safeDecode(getParam(sp, "e"));
  const err = mapUiError(errRaw);

  if (!token) redirect("/login?e=missing_token");

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-text">Registrer som ansatt</h1>
          <p className="mt-1 text-sm text-muted">Du er invitert til å bli med i Lunchportalen for ditt firma.</p>
        </div>

        {err ? (
          <div className="mb-4 rounded-2xl bg-rose-50 p-3 text-sm text-rose-900 ring-1 ring-rose-200" role="alert">
            {err}
          </div>
        ) : null}

        <AcceptInviteClient token={token} />
      </div>
    </main>
  );
}
