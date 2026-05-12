import Link from "next/link";

type CmsWeekMenuPublishControlsPanelProps = {
  studioUrl: string;
};

/** Én samlet governance-flate for operativ meny-kjede. */
export function CmsWeekMenuPublishControlsPanel({ studioUrl }: CmsWeekMenuPublishControlsPanelProps) {
  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm" aria-labelledby="cp-publish-operativ">
        <h2 id="cp-publish-operativ" className="text-sm font-semibold text-emerald-950">
          Operativ publish-kjede (ansatt / bestilling)
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-emerald-950/90">
          <strong>Kilde:</strong> Sanity <code className="rounded bg-white/80 px-1">menu</code> /{" "}
          <code className="rounded bg-white/80 px-1">menuDay</code> + aktiv avtale i DB.{" "}
          <strong>Runtime:</strong> <code className="rounded bg-white/80 px-1">GET /api/week</code> — samme forståelse som
          forhåndsvisning av data i denne tabellen (meny-rader).
        </p>
        <ul className="mt-3 space-y-1.5 text-xs text-emerald-950/90">
          <li>
            <span className="font-medium">Publisert sannhet</span> = dokumentene Sanity-serveren leser + avtalens
            måltidstyper/leveringsdager (ikke en separat CMS-DB-kopi).
          </li>
          <li>
            <span className="font-medium">Preview/publish:</span> rediger i Studio; API plukker opp publiserte dokumenter —
            ikke bland med Postgres content-preview.
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-50"
            href={studioUrl}
            target="_blank"
            rel="noreferrer"
          >
            Studio — menykilde
          </a>
          <Link
            className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-50"
            href="/backoffice/runtime"
          >
            Runtime-aggregater
          </Link>
        </div>
      </section>
    </div>
  );
}
