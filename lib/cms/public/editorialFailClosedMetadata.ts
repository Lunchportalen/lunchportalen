/**
 * Nøktern Next.js Metadata når redaksjonelt innhold ikke er tilgjengelig fra Umbraco.
 * Skal ikke ligne full publisert marketing-SEO — brukes kun for seed / fail-closed.
 */
import type { Metadata } from "next";
import { canonicalForPath } from "@/lib/seo/site";

export type EditorialFailClosedKind = "seed-no-row" | "seed-empty-body";

/** Same short technical line as `buildEditorialFailClosedMetadata` description — for JSON-LD when editorial is not live. */
export const EDITORIAL_FAIL_CLOSED_DESCRIPTION =
  "Redaksjonelt innhold er ikke tilgjengelig fra CMS.";

export function buildEditorialFailClosedMetadata(
  canonicalPath: string,
  _kind: EditorialFailClosedKind,
): Metadata {
  const path = canonicalPath.startsWith("/") ? canonicalPath : `/${canonicalPath}`;
  const canonical = canonicalForPath(path === "" ? "/" : path);
  void _kind;
  return {
    title: "Lunchportalen",
    description: EDITORIAL_FAIL_CLOSED_DESCRIPTION,
    alternates: { canonical },
    robots: { index: false, follow: true },
    openGraph: {
      title: "Lunchportalen",
      description: EDITORIAL_FAIL_CLOSED_DESCRIPTION,
      url: canonical,
      siteName: "Lunchportalen",
      locale: "nb_NO",
      type: "website",
    },
  };
}
