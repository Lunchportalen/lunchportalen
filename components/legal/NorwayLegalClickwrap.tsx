"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { NorwaySubjectRole } from "@/lib/legal/norwayDocuments";

type DocMeta = {
  documentType: string;
  version: string;
  checksum: string;
  effectiveDate: string;
  title: string;
  href: string;
};

export type NorwayLegalAcceptancePayload = {
  documentType: string;
  documentVersion: string;
  documentChecksum: string;
  accepted: true;
};

type Props = {
  role: NorwaySubjectRole;
  onChange: (payload: NorwayLegalAcceptancePayload[] | null) => void;
};

export function NorwayLegalClickwrap({ role, onChange }: Props) {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [openType, setOpenType] = useState<string | null>(null);
  const [body, setBody] = useState<string>("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/legal/norway/documents?role=${role}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (cancelled) return;
      if (!res.ok || !json?.ok) {
        setError("Kunne ikke hente vilkår.");
        onChangeRef.current(null);
        return;
      }
      const list = (json.data?.documents ?? []) as DocMeta[];
      setDocs(list);
      const init: Record<string, boolean> = {};
      for (const d of list) init[d.documentType] = false;
      setChecked(init);
      onChangeRef.current(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [role]);

  const allAccepted = useMemo(
    () => docs.length > 0 && docs.every((d) => checked[d.documentType] === true),
    [docs, checked],
  );

  useEffect(() => {
    if (!allAccepted) {
      onChangeRef.current(null);
      return;
    }
    onChangeRef.current(
      docs.map((d) => ({
        documentType: d.documentType,
        documentVersion: d.version,
        documentChecksum: d.checksum,
        accepted: true as const,
      })),
    );
  }, [allAccepted, docs]);

  async function openDoc(type: string) {
    setOpenType(type);
    setBody("Laster…");
    const res = await fetch(`/api/legal/norway/documents/${type}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      setBody("Kunne ikke åpne dokumentet.");
      return;
    }
    setBody(String(json.data?.document?.body || ""));
  }

  if (error) {
    return <p className="text-sm text-red-700">{error}</p>;
  }

  return (
    <div className="space-y-4 rounded-[1.5rem] border border-[#eadfce] bg-white p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a7a32]">Norske vilkår</p>
        <h3 className="mt-2 text-lg font-semibold text-[#181715]">Aksept kreves for å fortsette</h3>
        <p className="mt-1 text-sm text-[#6f6657]">
          Avkrysningsboksene er ikke forhåndsvalgt. Hvert dokument må åpnes via lenken til eksakt versjon.
        </p>
      </div>

      <ul className="space-y-3">
        {docs.map((d) => (
          <li key={d.documentType} className="rounded-2xl bg-[#fbf7ef] p-3">
            <label className="flex items-start gap-3 text-sm text-[#34302a]">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0"
                checked={checked[d.documentType] === true}
                onChange={(e) =>
                  setChecked((prev) => ({ ...prev, [d.documentType]: e.target.checked }))
                }
              />
              <span>
                Jeg aksepterer{" "}
                <button
                  type="button"
                  className="font-semibold underline underline-offset-2"
                  onClick={() => void openDoc(d.documentType)}
                >
                  {d.title}
                </button>{" "}
                (v{d.version})
              </span>
            </label>
            <p className="mt-1 pl-8 text-xs text-[#8b8170]">Sjekksum: {d.checksum.slice(0, 12)}…</p>
          </li>
        ))}
      </ul>

      {openType ? (
        <div className="max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl border border-[#eadfce] bg-[#fffdf8] p-4 text-xs text-[#34302a]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <strong>{openType}</strong>
            <button type="button" className="underline" onClick={() => setOpenType(null)}>
              Lukk
            </button>
          </div>
          {body}
        </div>
      ) : null}
    </div>
  );
}
