import type { Metadata } from "next";
import Link from "next/link";

import { getMarketingPage } from "@/lib/seo/marketingRegistry";
import { createPageMetadata } from "@/lib/seo/meta";

const PATH = "/priser";

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata(getMarketingPage(PATH));
}

export default function PriserPage() {
  return (
    <main className="lp-home">
      <section className="lp-section">
        <div className="lp-container">
          <h1 className="lp-h1">Priser for firmalunsj</h1>
          <p className="lp-lead">
            Pris settes med tydelige rammer i avtalen. Målet er en forutsigbar ordning med mindre administrasjon over tid.
          </p>
          <div className="lp-linkChips" style={{ marginTop: 20 }}>
            <Link className="lp-linkChip" href="/lunsjordning">Lunsjordning for bedrifter</Link>
            <Link className="lp-linkChip" href="/kontakt">Kontakt om firmalunsj</Link>
            <Link className="lp-linkChip" href="/registrering">Registrer firma</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

