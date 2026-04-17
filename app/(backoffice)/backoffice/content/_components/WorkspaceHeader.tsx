"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellissimaWorkspaceHeader } from "@/components/backoffice/BellissimaWorkspaceHeader";
import { resolveBackofficeContentRoute } from "@/lib/cms/backofficeContentRoute";

/**
 * Umbraco-lignende seksjonstop for innholdsredigering: mørk blå stripe med seksjonslenker.
 * Synlig paritet med klassisk backoffice — ikke app-header.
 */
const CONTENT_DETAIL_SECTION_NAV = [
  { href: "/backoffice/content", label: "Innhold", test: (p: string) => /^\/backoffice\/content(\/|$)/.test(p) },
  { href: "/backoffice/media", label: "Media", test: (p: string) => p.startsWith("/backoffice/media") },
  { href: "/backoffice/templates", label: "Maler", test: (p: string) => p.startsWith("/backoffice/templates") },
  { href: "/backoffice/users", label: "Brukere", test: (p: string) => p.startsWith("/backoffice/users") },
  { href: "/backoffice/members", label: "Medlemmer", test: (p: string) => p.startsWith("/backoffice/members") },
  { href: "/backoffice/forms", label: "Skjemaer", test: (p: string) => p.startsWith("/backoffice/forms") },
  { href: "/backoffice/translation", label: "Oversettelse", test: (p: string) => p.startsWith("/backoffice/translation") },
] as const;

function ContentDetailUmbracoSectionNavChrome() {
  const pathname = usePathname() ?? "";
  return (
    <header
      className="shrink-0 border-b border-black/25 bg-[#3544b1] text-white shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)]"
      data-lp-content-detail-umbraco-section-nav="true"
    >
      <nav
        className="flex min-h-10 min-w-0 flex-wrap items-stretch gap-0 px-0.5 sm:px-1"
        aria-label="Backoffice-seksjoner"
      >
        {CONTENT_DETAIL_SECTION_NAV.map((item) => {
          const active = item.test(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center border-b-2 border-transparent px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors sm:px-3 sm:text-[12px] ${
                active
                  ? "border-[#7eb8ff] bg-black/10 text-white"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

export function WorkspaceHeader() {
  const pathname = usePathname() ?? "";
  if (resolveBackofficeContentRoute(pathname).kind === "detail") {
    return <ContentDetailUmbracoSectionNavChrome />;
  }
  return <BellissimaWorkspaceHeader />;
}
