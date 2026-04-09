import Link from "next/link";
import { LanguagesListClient } from "./LanguagesListClient";

export default function LanguagesSettingsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <nav className="text-sm text-slate-600">
        <Link href="/backoffice/settings" className="hover:text-slate-900">
          ← Innstillinger
        </Link>
      </nav>
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Språk (CMS)</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Kanonisk kilde for kulturkoder og variant-rad-mapping (nb/en). Endringer lagres i global settings og publiseres.
        </p>
      </header>
      <LanguagesListClient />
    </div>
  );
}
