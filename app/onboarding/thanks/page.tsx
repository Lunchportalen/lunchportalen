// app/onboarding/thanks/page.tsx
import Link from "next/link";
import { SYSTEM_EMAILS } from "@/lib/system/emails";

export default function Thanks({ searchParams }: { searchParams?: Record<string, string> }) {
  const status = searchParams?.status ?? "pending";

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Takk for registreringen</h1>

      <p className="mt-3 text-[rgb(var(--lp-muted))]">
        Bedriften er opprettet. Du er nå logget inn.
      </p>

      <p className="mt-3 text-[rgb(var(--lp-muted))]">
        Vi har mottatt forespørselen. Avtalen aktiveres etter gjennomgang. Når avtalen er aktiv kan du legge til ansatte.
      </p>

      <div className="mt-6 rounded-2xl border bg-white p-4 text-sm">
        <b>Status:</b> {status}
      </div>

      <div className="mt-8 flex gap-3">
        <Link href="/login" className="rounded-xl border px-4 py-2">
          Gå til innlogging
        </Link>
        <Link href="/" className="rounded-xl border px-4 py-2">
          Til forsiden
        </Link>
      </div>

      {/* Kontaktinformasjon */}
      <div className="mt-12 rounded-2xl bg-[rgb(var(--lp-bg-muted))] p-5 text-sm">
        <p className="font-medium">Spørsmål eller behov for hjelp?</p>
        <p className="mt-1 text-[rgb(var(--lp-muted))]">
          Har du spørsmål om registreringen eller veien videre, er du hjertelig velkommen til å ta kontakt med oss.
        </p>
        <p className="mt-2">
          📧{" "}
          <a href={`mailto:${SYSTEM_EMAILS.SUPPORT}`} className="font-medium underline hover:no-underline">
            {SYSTEM_EMAILS.SUPPORT}
          </a>
        </p>
      </div>
    </main>
  );
}
