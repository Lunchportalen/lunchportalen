// app/onboarding/page.tsx
import OnboardingForm from "./OnboardingForm";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function safeDecode(v: string) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export default async function OnboardingPage(props: { searchParams?: Promise<SearchParams> | SearchParams }) {
  // ✅ Next 15: searchParams kan være Promise. Vi støtter begge (robust).
  const spMaybe = props.searchParams;
  const sp: SearchParams =
    spMaybe && typeof (spMaybe as any)?.then === "function" ? await (spMaybe as Promise<SearchParams>) : (spMaybe as SearchParams) ?? {};

  const rawErr = first(sp.error);
  const error = rawErr ? safeDecode(String(rawErr)) : null;

  const rawRid = first(sp.rid);
  const rid = rawRid ? safeDecode(String(rawRid)) : null;

  const rawCode = first(sp.code);
  const code = rawCode ? safeDecode(String(rawCode)) : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Enklere firmalunsj starter her</h1>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          Registrer bedriften og send inn grunnlaget for avtale. Vi aktiverer kontoen når alt er kontrollert — én sannhetskilde, ingen manuelle unntak.
        </p>
      </div>

      {/* Error box */}
      {(error || code || rid) && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="font-medium">Registrering feilet</div>

          {error && <div className="mt-1">{error}</div>}

          {/* If no explicit error message, show a safe default */}
          {!error && (
            <div className="mt-1">
              Noe gikk galt. Prøv igjen, eller kontakt support hvis problemet fortsetter.
            </div>
          )}

          {(code || rid) && (
            <div className="mt-2 text-xs text-red-700">
              {code ? (
                <span>
                  Feilkode: <span className="font-mono">{code}</span>
                </span>
              ) : null}
              {code && rid ? <span className="mx-2">•</span> : null}
              {rid ? (
                <span>
                  Ref: <span className="font-mono">{rid}</span>
                </span>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Info box (Blueprint-correct expectations) */}
      <div className="mb-6 rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 text-sm">
        <div className="font-medium">Hva skjer etter registrering?</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[rgb(var(--lp-muted))]">
          <li>Bedriften registreres med status <span className="font-mono">PENDING</span>.</li>
          <li>Avtalen kvalitetssikres og aktiveres før innlogging og bestilling blir tilgjengelig.</li>
          <li>Du får bekreftelse på e-post når alt er klart.</li>
        </ul>
      </div>

      {/* Form */}
      <OnboardingForm />
    </main>
  );
}
