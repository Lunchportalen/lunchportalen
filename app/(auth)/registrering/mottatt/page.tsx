import Link from "next/link";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export default function RegistrationReceiptPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const companyIdRaw = searchParams?.companyId;
  const companyId = safeStr(Array.isArray(companyIdRaw) ? companyIdRaw[0] : companyIdRaw);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Registreringen er mottatt</h1>
      <p className="mt-3 text-[rgb(var(--lp-muted))]">
        Vi tar kontakt så snart alt er klart.
      </p>
      

      {companyId ? (
        <div className="mt-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4 text-sm">
          Referanse: <span className="font-mono">{companyId}</span>
        </div>
      ) : null}

      <div className="mt-8 flex gap-3">
        <Link href="/" className="rounded-xl border px-4 py-2 text-sm">
          Til forsiden
        </Link>
        <Link href="/login" className="rounded-xl border px-4 py-2 text-sm">
          Til innlogging
        </Link>
      </div>
    </main>
  );
}

