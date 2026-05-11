import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function InactiveAgreementPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-4 py-12 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">Tilgang stoppet</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">Avtalen er ikke aktiv</h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-neutral-600">
        Vi finner ikke en aktiv lunsjavtale for firmaet ditt akkurat nå. Logg inn på nytt, eller kontakt administrator
        dersom dette ikke stemmer.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <Link href="/login" className="lp-btn lp-btn--primary lp-neon-focus lp-neon-glow-hover">
          Gå til innlogging
        </Link>
        <Link href="/" className="lp-btn lp-btn--secondary lp-neon-focus">
          Til forsiden
        </Link>
      </div>
    </main>
  );
}
