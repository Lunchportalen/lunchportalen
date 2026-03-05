"use client";

import { useState } from "react";

type Props = {
  slug: string;
  suggestedTitle: string;
};

export default function CreateMissingPageClient({ slug, suggestedTitle }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/content/pages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: suggestedTitle,
          slug,
          locale: "nb",
          environment: "prod",
        }),
      });

      // 409: slug already exists – resolve to id and redirect by ID.
      if (res.status === 409) {
        const bySlug = await fetch(
          `/api/backoffice/content/pages/by-slug?slug=${encodeURIComponent(slug)}`,
          { cache: "no-store" }
        ).then((r) => r.json()).catch(() => null);
        const id = bySlug?.data?.id;
        if (id) window.location.replace(`/backoffice/content/${id}`);
        else window.location.replace("/backoffice/content");
        return;
      }

      if (!res.ok) {
        setError("Kunne ikke opprette siden. Prøv igjen, eller kontakt systemansvarlig.");
        return;
      }

      const json = (await res.json()) as any;
      const pageId: string | null =
        json?.data?.page?.id ??
        json?.page?.id ??
        json?.data?.id ??
        json?.pageId ??
        null;

      if (!pageId) {
        setError("Svar fra server mangler side-ID. Sjekk loggene.");
        return;
      }

      window.location.replace(`/backoffice/content/${pageId}`);
    } catch (e) {
      setError("Uventet feil ved oppretting av side.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    window.location.href = "/backoffice/content";
  };

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-slate-600">
        Du kan opprette siden nå. Dette vil lage en CMS-side med slug <code>{slug}</code> og åpne den
        i editoren.
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleCreate}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Oppretter side …" : "Opprett siden nå"}
        </button>
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Tilbake til innhold
        </button>
      </div>
    </div>
  );
}

