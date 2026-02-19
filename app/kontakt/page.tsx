import type { Metadata } from "next";

import { getMarketingPage } from "@/lib/seo/marketingRegistry";
import { createPageMetadata } from "@/lib/seo/meta";
import KontaktClient from "./KontaktClient";

const PATH = "/kontakt";

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata(getMarketingPage(PATH));
}

export default function KontaktPage() {
  return <KontaktClient />;
}
