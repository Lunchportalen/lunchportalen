"use client";

import Link from "next/link";

import type { StartIntent } from "@/lib/public/geographyParams";
import { buildContinuationPath } from "@/lib/public/geographyParams";

type Props = {
  city: string;
  postalCode: string;
  source: string;
  intent: StartIntent;
};

export default function StartCoveredResult({ city, postalCode, source, intent }: Props) {
  const href = buildContinuationPath(intent, { postalCode, city, source });
  const body =
    intent === "register"
      ? "Da er dere klare til å komme i gang."
      : "La oss vise dere hvordan Lunchportalen funker i praksis.";
  const cta = intent === "register" ? "Registrer bedriften" : "Book demo";

  return (
    <div className="lp-start-step">
      <h2 className="lp-start-step__heading">Vi leverer til {city}.</h2>
      <p className="lp-start-step__body">{body}</p>
      <Link href={href} className="ds-btn ds-btn--primary lp-start-btn">
        {cta}
      </Link>
    </div>
  );
}
