import type { Metadata } from "next";
import Link from "next/link";

import { getMarketingPage } from "@/lib/seo/marketingRegistry";
import { createPageMetadata } from "@/lib/seo/meta";

const PATH = "/sikkerhet";

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata(getMarketingPage(PATH));
}

export default function SikkerhetPage() {
  return (
    <main className="lp-home">
      <section className="lp-section">
        <div className="lp-container">
          <h1 className="lp-h1">Sikkerhet og datagrunnmur</h1>
          <p className="lp-lead">
            Modellen bygger på tydelige rammer, sporbar status og et klart beslutningsgrunnlag i den daglige driften.
          </p>
          <div className="lp-linkChips" style={{ marginTop: 20 }}>
            <Link className="lp-linkChip" href="/lunsjordning">Lunsjordning for bedrifter</Link>
            <Link className="lp-linkChip" href="/system-for-lunsjbestilling">System for lunsjbestilling</Link>
            <Link className="lp-linkChip" href="/kontakt">Kontakt om firmalunsj</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

