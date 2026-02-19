import { getMarketingPage, listMarketingPages } from "@/lib/seo/marketingRegistry";

export type IntentLink = {
  href: string;
  label: string;
};

export function getIntentLinks(path: string): IntentLink[] {
  return getMarketingPage(path).intentLinks;
}

export function intentRegistry(): Record<string, IntentLink[]> {
  const out: Record<string, IntentLink[]> = {};
  for (const page of listMarketingPages()) {
    out[page.path] = page.intentLinks;
  }
  return out;
}
