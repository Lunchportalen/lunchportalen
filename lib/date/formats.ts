// lib/date/formats.ts
import { formatDateNO } from "@/lib/date/format";

type FormatDateSmartOpts = {
  locale?: string;
  tz?: string;
};

export function formatDateSmart(dateISO: string, _opts?: FormatDateSmartOpts): string {
  return formatDateNO(dateISO);
}
