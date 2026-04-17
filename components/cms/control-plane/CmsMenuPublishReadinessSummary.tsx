type MenuDoc = { title?: string | null } | null | undefined;

type CmsMenuPublishReadinessSummaryProps = {
  mealKeys: string[];
  menus: Map<string, MenuDoc>;
};

/**
 * Readiness basert på samme data som operative menyer — ingen ny kilde.
 */
export function CmsMenuPublishReadinessSummary({ mealKeys, menus }: CmsMenuPublishReadinessSummaryProps) {
  const total = mealKeys.length;
  const found = mealKeys.filter((k) => Boolean(menus.get(k))).length;
  const missing = total - found;

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      aria-labelledby="menu-readiness-heading"
    >
      <h3 id="menu-readiness-heading" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Publiseringsberedskap (Sanity, lest nå)
      </h3>
      <p className="mt-2 text-sm text-slate-800">
        <strong>
          {found} av {total}
        </strong>{" "}
        måltidsnøkler har meny-dokument i dette miljøet.
        {missing > 0 ? (
          <span className="text-amber-800">
            {" "}
            {missing} mangler — runtime kan få tomt innhold for disse nøklene inntil Studio er oppdatert.
          </span>
        ) : (
          <span className="text-emerald-800"> Alle nøkler har dokument.</span>
        )}
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Dette er samme avledning som tabellen under — forhåndsvisning og runtime følger samme forståelse.
      </p>
    </section>
  );
}
