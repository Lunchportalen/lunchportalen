// app/accept-invite/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AcceptInviteClient from "./AcceptInviteClient";

export const metadata: Metadata = {
  title: "Accept invite – Lunchportalen",
  description: "Aktiver brukerkontoen din ved å godta invitasjonen.",
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/* =========================================================
   Helpers
========================================================= */

function getParam(sp: Record<string, any> | undefined, key: string): string | null {
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

/**
 * UI skal aldri lekke DB/trigger-tekst.
 * Mapper tekniske feil til trygge, menneskelige meldinger.
 */
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

/* =========================================================
   Page
========================================================= */

export default async function Page(props: PageProps) {
  const sp = (await props.searchParams) ?? {};
  const token = getParam(sp, "token");
  const errRaw = safeDecode(getParam(sp, "e"));
  const err = mapUiError(errRaw);

  if (!token) redirect("/login?e=missing_token");

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-text">Aktiver konto</h1>
          <p className="mt-2 text-sm text-muted">Opprett passord og aktiver kontoen din. Invitasjonen gjelder kun én gang.</p>
        </div>

        {/* Server-side error (kun fra querystring) */}
        {err ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>
        ) : null}

        {/* ✅ Client submit: ingen server action → ingen 303 */}
        <AcceptInviteClient token={token} />
      </div>

      <p className="mx-auto mt-4 max-w-md text-center text-xs text-muted">
        Trenger du hjelp? Ta kontakt med administrator i din bedrift.
      </p>
    </main>
  );
}
