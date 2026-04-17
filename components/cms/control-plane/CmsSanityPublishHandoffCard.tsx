/**
 * In-CMS orkestrering: én tydelig handoff til Sanity Studio som eneste trygge mutasjon for operativ meny.
 * Ingen iframe (ofte blokkert) — eksplisitt handoff er mer pålitelig enn «fake embedded».
 */

type CmsSanityPublishHandoffCardProps = {
  studioUrl: string;
};

export function CmsSanityPublishHandoffCard({ studioUrl }: CmsSanityPublishHandoffCardProps) {
  return (
    <section
      className="rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm"
      aria-labelledby="sanity-handoff-heading"
    >
      <h3 id="sanity-handoff-heading" className="text-base font-semibold text-emerald-950">
        Publiser operativ meny (handoff til Sanity Studio)
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-emerald-950/90">
        Den operative menykilden er <strong>Sanity</strong>. Redigering og publisering av{" "}
        <code className="rounded bg-white/90 px-1 text-xs">menu</code> /{" "}
        <code className="rounded bg-white/90 px-1 text-xs">menuContent</code> skjer i Studio — dette er den trygge
        handoffen fra CMS control plane uten duplikat motor i Lunchportalen.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a
          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-emerald-700 px-6 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
          href={studioUrl}
          target="_blank"
          rel="noreferrer"
        >
          Åpne Sanity Studio — utfør publish
        </a>
        <p className="flex min-h-[44px] max-w-md items-center text-xs text-emerald-900/80">
          Etter publish: oppdater denne siden for å se oppdatert beredskapstabell (samme data som{" "}
          <code className="rounded bg-white/80 px-1">GET /api/week</code> bruker).
        </p>
      </div>
    </section>
  );
}
