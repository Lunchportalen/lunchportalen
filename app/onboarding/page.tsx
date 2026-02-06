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
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Enklere firmalunsj starter her</h1>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          Registrer bedriften og få full kontroll på lunsjlevering, bestillinger og rammer — uten manuelle unntak.
        </p>
      </div>

      {/* Error box */}
      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      {/* Form */}
      <OnboardingForm />
    </main>
  );
}
