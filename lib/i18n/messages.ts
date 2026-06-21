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

export async function loadMessagesForLocale(locale: AppLocale): Promise<MessageTree> {
  const nb = (await import("../../messages/nb.json")).default as MessageTree;
  if (locale === "nb") return nb;

  const en = (await import("../../messages/en.json")).default as MessageTree;
  return deepMergeMessages(nb, en);
}
