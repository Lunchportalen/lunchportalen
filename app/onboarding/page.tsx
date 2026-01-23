// app/onboarding/page.tsx
import OnboardingForm from "./OnboardingForm";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function OnboardingPage(props: { searchParams?: Promise<SearchParams> | SearchParams }) {
  // ✅ Next 15: searchParams kan være Promise. Vi støtter begge (robust).
  const spMaybe = props.searchParams;
  const sp: SearchParams =
    spMaybe && typeof (spMaybe as any)?.then === "function" ? await (spMaybe as Promise<SearchParams>) : (spMaybe as SearchParams) ?? {};

  const rawErr = first(sp.error);
  const error = rawErr ? decodeURIComponent(String(rawErr)) : null;

  return (
    <main className="mx-auto max-w-3xl p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Registrer firma</h1>
        <p className="mt-2 text-sm opacity-70">
          Opprett firmakonto og administrator. Avtalen aktiveres etter gjennomgang. Ansatte legges til av bedriften i
          etterkant.
        </p>
      </div>

      {/* Info box */}
      {!error && (
        <div className="mb-6 rounded-2xl border bg-white/70 p-4 text-sm">
          <p className="mb-1 font-medium">Slik fungerer det</p>
          <ol className="list-inside list-decimal space-y-1 opacity-80">
            <li>Du registrerer firma og firma-admin</li>
            <li>Vi gjennomgår forespørselen</li>
            <li>Avtalen aktiveres</li>
            <li>Du legger til ansatte og tar løsningen i bruk</li>
          </ol>
        </div>
      )}

      {/* Error box */}
      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      {/* Form */}
      <OnboardingForm />
    </main>
  );
}
