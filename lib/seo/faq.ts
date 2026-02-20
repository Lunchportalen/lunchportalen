import faqData from "./faq-data.json";
import { normalizePath } from "./site";

export type FAQItem = { q: string; a: string };

export const FAQS: Record<string, FAQItem[]> = faqData as Record<string, FAQItem[]>;

function sanitizeFaqItems(items: FAQItem[]): FAQItem[] {
  return (items || [])
    .map((item) => ({
      q: String(item?.q ?? "").trim(),
      a: String(item?.a ?? "").trim(),
    }))
    .filter((item) => item.q.length > 0 && item.a.length > 0);
}

export function faqForPage(path: string): FAQItem[] {
  const key = normalizePath(path);

  if (!Object.prototype.hasOwnProperty.call(FAQS, key)) {
    throw new Error(`SEO_FAQ_PATH_MISSING:${key}`);
  }

  const sanitized = sanitizeFaqItems(FAQS[key]);
  if (sanitized.length === 0) {
    throw new Error(`SEO_FAQ_EMPTY:${key}`);
  }

  return sanitized;
}
