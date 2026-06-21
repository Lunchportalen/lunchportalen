import { OSLO_TZ } from "@/lib/date/oslo";
import { intlLocaleForAppLocale, type AppLocale } from "@/lib/i18n/middlewareLocale";

export function formatDate(
  input: Date | string | number,
  locale: AppLocale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(intlLocaleForAppLocale(locale), {
    timeZone: OSLO_TZ,
    ...options,
  }).format(date);
}

export function formatCurrency(
  amount: number,
  locale: AppLocale,
  currency = "NOK",
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(intlLocaleForAppLocale(locale), {
    style: "currency",
    currency,
    ...options,
  }).format(amount);
}

export function formatNumber(value: number, locale: AppLocale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocaleForAppLocale(locale), options).format(value);
}
