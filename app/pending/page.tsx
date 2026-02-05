// app/pending/page.tsx
import Link from "next/link";
import { SYSTEM_EMAILS } from "@/lib/system/emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PendingPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Venter på godkjenning</h1>

      <p className="mt-3 text-[rgb(var(--lp-muted))]">
        Vi har mottatt registreringen. Avtalen må godkjennes før dere får tilgang til admin og kan legge til ansatte.
      </p>

      <div className="mt-6 rounded-2xl border bg-white p-5 text-sm">
        <p className="font-medium">Normal behandlingstid</p>
        <p className="mt-1 text-[rgb(var(--lp-muted))]">1–2 virkedager</p>

        <div className="mt-4 rounded-xl bg-[rgb(var(--lp-bg-muted))] p-4">
          <p className="font-medium">Haster det?</p>
          <p className="mt-1 text-[rgb(var(--lp-muted))]">
            Send oss en e-post på{" "}
            <a className="font-medium underline hover:no-underline" href={`mailto:${SYSTEM_EMAILS.SUPPORT}`}>
              {SYSTEM_EMAILS.SUPPORT}
            </a>
            .
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/" className="rounded-xl border px-4 py-2">
          Til forsiden
        </Link>
        <a
          href={`mailto:${SYSTEM_EMAILS.SUPPORT}`}
          className="rounded-xl border px-4 py-2"
        >
          Kontakt oss
        </a>
        <Link href="/logout" className="rounded-xl border px-4 py-2">
          Logg ut
        </Link>
      </div>
    </main>
  );
}
