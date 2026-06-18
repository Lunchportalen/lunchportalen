// lib/server/provider/providerCustomerAgreementValidation.ts
import "server-only";

import { normalizeDeliveryDaysStrict } from "@/lib/agreements/deliveryDays";
import { DAY_KEYS, type DayKey, type Tier } from "@/lib/agreements/normalize";
import { isValidNoPhone, normalizeNoPhone } from "@/lib/phone/no";
import type {
  ProviderAgreementPatchInput,
  ProviderAgreementPatchPayload,
} from "@/lib/providers/providerCustomerAgreementTypes";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

const MAX_NAME = 200;
const MAX_ADDRESS = 500;
const MAX_EMAIL = 254;
const MAX_REASON = 500;
const MAX_NOTE = 2000;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type ValidationOk = { ok: true; value: ProviderAgreementPatchPayload };
export type ValidationErr = { ok: false; code: string; message: string };
export type ValidationResult = ValidationOk | ValidationErr;

function normTier(v: unknown): Tier | null {
  const s = safeStr(v).toUpperCase();
  if (s === "BASIS" || s === "LUXUS" || s === "ENTERPRISE") return s;
  return null;
}

function parseTime(v: unknown): string | null {
  const s = safeStr(v);
  if (!s) return null;
  if (TIME_RE.test(s)) return s;
  const m = s.match(/^(\d{1,2}):(\d{2}):\d{2}$/);
  if (m) {
    const hh = m[1].padStart(2, "0");
    const mm = m[2];
    const candidate = `${hh}:${mm}`;
    return TIME_RE.test(candidate) ? candidate : null;
  }
  return null;
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function trimMax(v: unknown, max: number): string | undefined {
  const s = safeStr(v);
  if (!s) return undefined;
  return s.slice(0, max);
}

export function validateProviderAgreementPatch(raw: ProviderAgreementPatchInput): ValidationResult {
  const out: ProviderAgreementPatchPayload = {};
  const keys = Object.keys(raw ?? {});
  if (keys.length === 0) {
    return { ok: false, code: "EMPTY_PATCH", message: "Ingen endringer angitt." };
  }

  if (raw.plan !== undefined) {
    const tier = normTier(raw.plan);
    if (!tier) {
      return { ok: false, code: "INVALID_PLAN", message: "Ugyldig avtalenivå. Velg Basis, Luxus eller Enterprise." };
    }
    out.plan = tier;
  }

  if (raw.deliveryDays !== undefined) {
    if (!Array.isArray(raw.deliveryDays)) {
      return { ok: false, code: "INVALID_DELIVERY_DAYS", message: "Leveringsdager må være en liste." };
    }
    const norm = normalizeDeliveryDaysStrict(raw.deliveryDays);
    if (norm.days.length === 0) {
      return { ok: false, code: "EMPTY_DELIVERY_DAYS", message: "Velg minst én leveringsdag." };
    }
    if (norm.unknown.length > 0) {
      return { ok: false, code: "INVALID_DELIVERY_DAY", message: "Ugyldig leveringsdag." };
    }
    const unique = new Set(norm.days);
    if (unique.size !== norm.days.length) {
      return { ok: false, code: "DUPLICATE_DELIVERY_DAY", message: "Leveringsdager kan ikke dupliseres." };
    }
    const weekend = raw.deliveryDays.some((d) => {
      const s = safeStr(d).toLowerCase();
      return s === "sat" || s === "sun" || s === "lørdag" || s === "søndag";
    });
    if (weekend) {
      return {
        ok: false,
        code: "WEEKEND_NOT_SUPPORTED",
        message: "Lunchportalen støtter kun lunsjlevering mandag–fredag.",
      };
    }
    out.deliveryDays = norm.days.filter((d): d is DayKey => (DAY_KEYS as readonly string[]).includes(d));
  }

  if (raw.location !== undefined) {
    if (raw.location == null || typeof raw.location !== "object") {
      return { ok: false, code: "INVALID_LOCATION", message: "Ugyldig lokasjon." };
    }
    const loc: { name?: string; address?: string } = {};
    if (raw.location.name !== undefined) {
      const name = trimMax(raw.location.name, MAX_NAME);
      if (name) loc.name = name;
    }
    if (raw.location.address !== undefined) {
      const address = trimMax(raw.location.address, MAX_ADDRESS);
      if (address) loc.address = address;
    }
    if (Object.keys(loc).length > 0) out.location = loc;
  }

  if (raw.contact !== undefined) {
    if (raw.contact == null || typeof raw.contact !== "object") {
      return { ok: false, code: "INVALID_CONTACT", message: "Ugyldig kontaktinformasjon." };
    }
    const contact: { name?: string; email?: string; phone?: string } = {};
    if (raw.contact.name !== undefined) {
      const name = trimMax(raw.contact.name, MAX_NAME);
      if (name) contact.name = name;
      else contact.name = "";
    }
    if (raw.contact.email !== undefined) {
      const email = trimMax(raw.contact.email, MAX_EMAIL)?.toLowerCase();
      if (email) {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          return { ok: false, code: "INVALID_CONTACT_EMAIL", message: "Ugyldig e-postadresse." };
        }
        contact.email = email;
      } else {
        contact.email = "";
      }
    }
    if (raw.contact.phone !== undefined) {
      const digits = normalizeNoPhone(raw.contact.phone);
      if (digits && !isValidNoPhone(digits)) {
        return { ok: false, code: "INVALID_CONTACT_PHONE", message: "Telefon må være 8 siffer." };
      }
      contact.phone = digits || "";
    }
    if (Object.keys(contact).length > 0) out.contact = contact;
  }

  if (raw.deliveryWindow !== undefined) {
    if (raw.deliveryWindow == null || typeof raw.deliveryWindow !== "object") {
      return { ok: false, code: "INVALID_DELIVERY_WINDOW", message: "Ugyldig leveringsvindu." };
    }
    const from = parseTime(raw.deliveryWindow.from);
    const to = parseTime(raw.deliveryWindow.to);
    if (!from || !to) {
      return { ok: false, code: "INVALID_DELIVERY_WINDOW", message: "Leveringsvindu må angis som HH:mm." };
    }
    if (timeToMinutes(from) >= timeToMinutes(to)) {
      return { ok: false, code: "INVALID_DELIVERY_WINDOW", message: "Leveringsvindu: fra-tid må være før til-tid." };
    }
    const label = trimMax(raw.deliveryWindow.label, MAX_NAME);
    out.deliveryWindow = { from, to, label: label ?? `${from}–${to}` };
  }

  if (raw.status !== undefined) {
    const s = safeStr(raw.status).toUpperCase();
    if (s !== "ACTIVE" && s !== "PAUSED") {
      return { ok: false, code: "INVALID_STATUS", message: "Status må være Aktiv eller Pauset." };
    }
    out.status = s;
  }

  if (raw.reason !== undefined) {
    const reason = trimMax(raw.reason, MAX_REASON);
    out.reason = reason ?? null;
  }

  if (raw.deliveryNote !== undefined) {
    const note = trimMax(raw.deliveryNote, MAX_NOTE);
    out.deliveryNote = note ?? null;
  }

  if (Object.keys(out).length === 0) {
    return { ok: false, code: "EMPTY_PATCH", message: "Ingen gyldige endringer angitt." };
  }

  return { ok: true, value: out };
}

export function timeToDbValue(hhmm: string): string {
  return `${hhmm}:00`;
}

export function timeFromDbValue(raw: unknown): string | null {
  return parseTime(raw);
}
