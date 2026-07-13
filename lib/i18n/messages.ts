import type { AppLocale } from "@/lib/i18n/middlewareLocale";

type MessageTree = Record<string, unknown>;

function isPlainObject(value: unknown): value is MessageTree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function deepMergeMessages(base: MessageTree, override: MessageTree): MessageTree {
  const out: MessageTree = { ...base };
  for (const key of Object.keys(override)) {
    const baseVal = base[key];
    const overrideVal = override[key];
    if (isPlainObject(baseVal) && isPlainObject(overrideVal)) {
      out[key] = deepMergeMessages(baseVal, overrideVal);
    } else if (overrideVal !== undefined) {
      out[key] = overrideVal;
    }
  }
  return out;
}

const LOCALE_MESSAGE_IMPORTS: Record<Exclude<AppLocale, "nb">, () => Promise<{ default: MessageTree }>> = {
  en: () => import("../../messages/en.json"),
  sv: () => import("../../messages/sv.json"),
  da: () => import("../../messages/da.json"),
  fi: () => import("../../messages/fi.json"),
  de: () => import("../../messages/de.json"),
  fr: () => import("../../messages/fr.json"),
  es: () => import("../../messages/es.json"),
  it: () => import("../../messages/it.json"),
  nl: () => import("../../messages/nl.json"),
  pl: () => import("../../messages/pl.json"),
  ro: () => import("../../messages/ro.json"),
  cs: () => import("../../messages/cs.json"),
  pt: () => import("../../messages/pt.json"),
  el: () => import("../../messages/el.json"),
};

export async function loadMessagesForLocale(locale: AppLocale): Promise<MessageTree> {
  const nb = (await import("../../messages/nb.json")).default as MessageTree;
  if (locale === "nb") return nb;

  const loadOverride = LOCALE_MESSAGE_IMPORTS[locale];
  const override = (await loadOverride()).default as MessageTree;
  return deepMergeMessages(nb, override);
}
