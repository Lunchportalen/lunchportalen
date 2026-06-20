import "server-only";

import { addDaysISO } from "@/lib/date/oslo";
import { loadProviderMenuDaysForDates } from "@/lib/provider-menu/loadProviderMenuDays";
import { resolveProviderMenuScopeForCompany } from "@/lib/menu/providerMenuScope";
import { sendMail } from "@/lib/orderBackup/smtp";
import {
  buildMenuWeekOpeningEmail,
} from "@/lib/notifications/menuWeekOpeningEmailTemplate";
import {
  filterRecipientsForSend,
  formatWeekRangeNo,
  MENU_WEEK_OPENING_CHANNEL_EMAIL,
  type MenuWeekOpeningRecipient,
  weekOpeningEventKey,
  weekOpeningThirdWeekMonday,
} from "@/lib/notifications/menuWeekOpeningCore";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminDb } from "@/lib/supabase/adminAny";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function appBaseUrl(): string {
  const env =
    process.env.PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL;
  if (!env) return "https://lunchportalen.no";
  return env.startsWith("http") ? env.replace(/\/+$/, "") : `https://${env.replace(/\/+$/, "")}`;
}

function smtpFrom(): string {
  return (
    safeStr(process.env.ORDER_SMTP_FROM) ||
    safeStr(process.env.LP_SMTP_FROM) ||
    safeStr(process.env.SMTP_FROM) ||
    "post@lunchportalen.no"
  );
}

async function loadEligibleEmployees(
  admin: ReturnType<typeof supabaseAdmin>,
): Promise<MenuWeekOpeningRecipient[]> {
  const { data: companies, error: cErr } = await admin
    .from("companies")
    .select("id")
    .eq("status", "active");

  if (cErr) throw new Error(`companies: ${cErr.message}`);
  const activeCompanyIds = new Set((companies ?? []).map((c) => safeStr((c as { id?: string }).id)).filter(Boolean));
  if (activeCompanyIds.size === 0) return [];

  const { data: agreements, error: aErr } = await admin
    .from("agreements")
    .select("company_id")
    .eq("status", "ACTIVE");

  if (aErr) throw new Error(`agreements: ${aErr.message}`);
  const withAgreement = new Set(
    (agreements ?? [])
      .map((a) => safeStr((a as { company_id?: string }).company_id))
      .filter((id) => id && activeCompanyIds.has(id)),
  );
  if (withAgreement.size === 0) return [];

  const { data: profiles, error: pErr } = await admin
    .from("profiles")
    .select("id, email, company_id, role")
    .eq("role", "employee")
    .not("email", "is", null)
    .not("company_id", "is", null);

  if (pErr) throw new Error(`profiles: ${pErr.message}`);

  const out: MenuWeekOpeningRecipient[] = [];
  for (const row of profiles ?? []) {
    const userId = safeStr((row as { id?: string }).id);
    const email = safeStr((row as { email?: string }).email).toLowerCase();
    const companyId = safeStr((row as { company_id?: string }).company_id);
    if (!userId || !email || !companyId || !withAgreement.has(companyId)) continue;
    out.push({ userId, email, companyId });
  }
  return out;
}

async function loadPrefsMap(
  admin: Awaited<ReturnType<typeof adminDb>>,
  userIds: string[],
): Promise<Map<string, boolean | null>> {
  const map = new Map<string, boolean | null>();
  if (userIds.length === 0) return map;

  const { data, error } = await admin
    .from("employee_notification_preferences")
    .select("user_id, menu_week_opening_enabled")
    .in("user_id", userIds);

  if (error) throw new Error(`prefs: ${error.message}`);
  for (const row of data ?? []) {
    const uid = safeStr((row as { user_id?: string }).user_id);
    if (!uid) continue;
    map.set(uid, (row as { menu_week_opening_enabled?: boolean }).menu_week_opening_enabled);
  }
  return map;
}

async function loadAlreadySent(
  admin: Awaited<ReturnType<typeof adminDb>>,
  eventKey: string,
  channel: string,
): Promise<Set<string>> {
  const { data, error } = await admin
    .from("menu_week_opening_send_log")
    .select("user_id")
    .eq("event_key", eventKey)
    .eq("channel", channel);

  if (error) throw new Error(`send_log: ${error.message}`);
  return new Set((data ?? []).map((r) => safeStr((r as { user_id?: string }).user_id)).filter(Boolean));
}

async function resolveMenuHighlightTitle(companyId: string, weekMonday: string): Promise<string> {
  const admin = supabaseAdmin();
  const scopeRes = await resolveProviderMenuScopeForCompany(admin, companyId);
  if (!scopeRes.ok) return "Nye lunchvalg";

  const dates = [weekMonday, addDaysISO(weekMonday, 1), addDaysISO(weekMonday, 2)];
  const rows = await loadProviderMenuDaysForDates(scopeRes.scope.providerId, dates, {
    providerSlug: scopeRes.scope.providerSlug,
  });

  const varmrett = rows.find((r) => r.category === "varmrett" && r.tier === "BASIS" && r.mealTitle.trim());
  if (varmrett?.mealTitle.trim()) return varmrett.mealTitle.trim();

  const any = rows.find((r) => r.mealTitle.trim());
  return any?.mealTitle.trim() || "Nye lunchvalg";
}

export type MenuWeekOpeningNotifyResult = {
  eventKey: string;
  weekMonday: string;
  sent: number;
  skippedOptOut: number;
  skippedAlready: number;
  failed: number;
  skippedNoWindow: boolean;
};

export async function runMenuWeekOpeningEmailNotify(now: Date = new Date()): Promise<MenuWeekOpeningNotifyResult> {
  const eventKey = weekOpeningEventKey(now);
  const weekMonday = weekOpeningThirdWeekMonday(now);
  const weekRangeLabel = formatWeekRangeNo(weekMonday);
  const baseUrl = appBaseUrl();
  const weekUrl = `${baseUrl}/week`;
  const logoUrl = `${baseUrl}/brand/LP-logo-uten-bakgrunn.png`;

  const admin = supabaseAdmin();
  const adminAny = await adminDb();
  const recipients = await loadEligibleEmployees(admin);
  const prefs = await loadPrefsMap(adminAny, recipients.map((r) => r.userId));
  const alreadySent = await loadAlreadySent(adminAny, eventKey, MENU_WEEK_OPENING_CHANNEL_EMAIL);
  const { toSend, skippedOptOut, skippedAlready } = filterRecipientsForSend(recipients, prefs, alreadySent);

  let sent = 0;
  let failed = 0;

  for (const recipient of toSend) {
    try {
      const menuTitle = await resolveMenuHighlightTitle(recipient.companyId, weekMonday);
      const mail = buildMenuWeekOpeningEmail({
        weekRangeLabel,
        menuTitle,
        weekUrl,
        logoUrl,
      });

      await sendMail({
        from: smtpFrom(),
        to: recipient.email,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });

      const { error: logErr } = await adminAny.from("menu_week_opening_send_log").insert({
        user_id: recipient.userId,
        event_key: eventKey,
        channel: MENU_WEEK_OPENING_CHANNEL_EMAIL,
      });

      if (logErr) {
        const code = String((logErr as { code?: string }).code ?? "");
        if (code !== "23505") throw logErr;
      }

      sent += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    eventKey,
    weekMonday,
    sent,
    skippedOptOut,
    skippedAlready,
    failed,
    skippedNoWindow: false,
  };
}
