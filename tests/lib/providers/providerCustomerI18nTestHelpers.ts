import { loadMessagesForLocale } from "@/lib/i18n/messages";
import type { ProviderAgreementTranslate } from "@/lib/providers/providerCustomerAgreementSurface";
import type { ProviderCustomerDetailTranslators } from "@/lib/providers/providerCustomerDetailSurface";

type ProviderCustomersMessages = {
  provider: {
    customers: {
      detail: Record<string, unknown>;
      status: Record<string, string>;
      agreement: Record<string, unknown>;
      activity: Record<string, unknown>;
    };
  };
};

export function nestedTranslator(root: Record<string, unknown>): (key: string, values?: Record<string, string | number>) => string {
  return (key, values) => {
    const parts = key.split(".");
    let node: unknown = root;
    for (const p of parts) {
      if (node && typeof node === "object" && p in (node as object)) {
        node = (node as Record<string, unknown>)[p];
      } else {
        return key;
      }
    }
    if (typeof node !== "string") return key;
    let s = node;
    if (values) {
      for (const [k, v] of Object.entries(values)) {
        s = s.replaceAll(`{${k}}`, String(v));
      }
    }
    return s;
  };
}

export async function loadProviderCustomerMessages(locale: "nb" | "en" = "nb") {
  return (await loadMessagesForLocale(locale)) as ProviderCustomersMessages;
}

export async function loadAgreementTranslator(locale: "nb" | "en" = "nb"): Promise<ProviderAgreementTranslate> {
  const messages = await loadProviderCustomerMessages(locale);
  return nestedTranslator(messages.provider.customers.agreement);
}

export async function loadDetailTranslators(locale: "nb" | "en" = "nb"): Promise<ProviderCustomerDetailTranslators> {
  const messages = await loadProviderCustomerMessages(locale);
  const detail = messages.provider.customers.detail;
  const agreement = messages.provider.customers.agreement;
  return {
    tDetail: nestedTranslator(detail),
    tStatus: (key) => messages.provider.customers.status[key] ?? key,
    tAgreementStatus: (key) => {
      const status = agreement.status as Record<string, string> | undefined;
      return status?.[key] ?? key;
    },
  };
}
