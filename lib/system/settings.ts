// lib/system/settings.ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import { opsLog } from "@/lib/ops/log";
import { fetchSystemSettingsRow } from "@/lib/system/settingsRepository";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";

export type SystemToggles = {
  enforce_cutoff?: boolean;          // håndhev 08:00 (default true)
  require_active_agreement?: boolean; // ingen bestilling uten avtale (default true)
  employee_self_service?: boolean;    // ansatt kan bestille/avbestille (default true)
  company_admin_can_order?: boolean;  // company_admin kan også bestille (default true)
  strict_mode?: boolean;              // ingen unntak (default true)
  esg_engine?: boolean;               // aktiver ESG-motor (default false/true som dere ønsker)
  email_backup?: boolean;             // ordre@... outbox/retry (default true)
  /** Autonom modus — master av (default). Krever Root ved aktivering via API. */
  autonomy_master_enabled?: boolean;
  autonomy_allow_auto_ads?: boolean;
  autonomy_allow_auto_pricing?: boolean;
  autonomy_allow_auto_procurement?: boolean;
  /** LLM-kall (runAI). Udefinert = på for bakoverkompatibilitet (RC). */
  ai_enabled?: boolean;
};

export type KillSwitch = {
  orders: boolean;
  cancellations: boolean;
  emails: boolean;
  kitchen_feed: boolean;
  /** Stenger AI motor (LLM) når true. */
  ai?: boolean;
  /** Optional JSONB — enterprise global halt (fail-closed when true). */
  global?: boolean;
};

export type Retention = {
  orders_months: number; // f.eks. 18
  audit_years: number;   // f.eks. 5
};

export type SystemSettings = {
  toggles: SystemToggles;
  killswitch: KillSwitch;
  retention: Retention;
  updated_at: string | null;
  updated_by: string | null;
};

export type SystemSettingsBaselineStatus =
  | "ready"
  | "row_missing"
  | "table_missing"
  | "read_error";

export type SystemSettingsBaselineSource = "service_role" | "request_scope";

export type SystemSettingsBaseline = {
  status: SystemSettingsBaselineStatus;
  source: SystemSettingsBaselineSource;
  operatorMessage: string;
  operatorAction: string | null;
  detail: string | null;
};

export type SystemSettingsBaselineReadResult = {
  settings: SystemSettings;
  baseline: SystemSettingsBaseline;
};

export function withDefaults(raw: Partial<SystemSettings> | null): SystemSettings {
  const toggles = (raw?.toggles ?? {}) as SystemToggles;
  const killswitch = (raw?.killswitch ?? {}) as Partial<KillSwitch>;
  const retention = (raw?.retention ?? {}) as Partial<Retention>;

  return {
    toggles: {
      enforce_cutoff: toggles.enforce_cutoff ?? true,
      require_active_agreement: toggles.require_active_agreement ?? true,
      employee_self_service: toggles.employee_self_service ?? true,
      company_admin_can_order: toggles.company_admin_can_order ?? true,
      strict_mode: toggles.strict_mode ?? true,
      esg_engine: toggles.esg_engine ?? false,
      email_backup: toggles.email_backup ?? true,
      autonomy_master_enabled: toggles.autonomy_master_enabled ?? false,
      autonomy_allow_auto_ads: toggles.autonomy_allow_auto_ads ?? false,
      autonomy_allow_auto_pricing: toggles.autonomy_allow_auto_pricing ?? false,
      autonomy_allow_auto_procurement: toggles.autonomy_allow_auto_procurement ?? false,
      ai_enabled: toggles.ai_enabled !== false,
    },
    killswitch: {
      orders: Boolean(killswitch.orders ?? false),
      cancellations: Boolean(killswitch.cancellations ?? false),
      emails: Boolean(killswitch.emails ?? false),
      kitchen_feed: Boolean(killswitch.kitchen_feed ?? false),
      ai: killswitch.ai === true,
      global: killswitch.global === true,
    },
    retention: {
      orders_months: Number.isFinite(retention.orders_months) ? Number(retention.orders_months) : 18,
      audit_years: Number.isFinite(retention.audit_years) ? Number(retention.audit_years) : 5,
    },
    updated_at: raw?.updated_at ?? null,
    updated_by: raw?.updated_by ?? null,
  };
}

function serializeRepositoryError(error: {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
} | null): string | null {
  if (!error) return null;
  const parts = [
    error.code ? `[${error.code}]` : null,
    error.message || null,
    error.details || null,
    error.hint || null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "SYSTEM_SETTINGS_READ_ERROR";
}

function isSystemSettingsTableMissingError(error: {
  message: string;
  code?: string | null;
} | null): boolean {
  if (!error) return false;
  const code = String(error.code ?? "").trim();
  const message = String(error.message ?? "").toLowerCase();
  if (code === "42P01") return true;
  if (message.includes("system_settings") && message.includes("does not exist")) return true;
  if (message.includes("system_settings") && message.includes("schema cache")) return true;
  if (message.includes("could not find the table") && message.includes("system_settings")) return true;
  return false;
}

function buildBaseline(
  status: SystemSettingsBaselineStatus,
  source: SystemSettingsBaselineSource,
  detail: string | null,
): SystemSettingsBaseline {
  switch (status) {
    case "row_missing":
      return {
        status,
        source,
        operatorMessage:
          "system_settings-raden mangler. Settings viser fail-closed standardverdier i read-only beredskap i stedet for å late som persisted truth finnes.",
        operatorAction:
          "Seed en rad i public.system_settings før du forventer varig styring eller forsøker å lagre fra system-workspacen.",
        detail,
      };
    case "table_missing":
      return {
        status,
        source,
        operatorMessage:
          "system_settings-tabellen mangler eller er utilgjengelig. Settings viser fail-closed standardverdier, ikke en falsk grønn baseline.",
        operatorAction:
          "Kjør baseline-migrasjonen som oppretter public.system_settings og seed første rad før du bruker denne arbeidsflaten operativt.",
        detail,
      };
    case "read_error":
      return {
        status,
        source,
        operatorMessage:
          "system_settings kunne ikke leses trygt. Settings viser fail-closed standardverdier til lesestien er reparert.",
        operatorAction:
          "Undersøk DB/schema/cache eller admin-klientkonfigurasjon før du stoler på eller lagrer systemstyring fra denne flaten.",
        detail,
      };
    default:
      return {
        status: "ready",
        source,
        operatorMessage: "system_settings lest fra kanonisk baseline.",
        operatorAction: null,
        detail,
      };
  }
}

export async function readSystemSettingsBaseline(options?: {
  sb?: SupabaseClient<Database>;
  source?: SystemSettingsBaselineSource;
}): Promise<SystemSettingsBaselineReadResult> {
  let sb = options?.sb;
  let source = options?.source;

  if (!sb) {
    if (hasSupabaseAdminConfig()) {
      sb = supabaseAdmin();
      source = source ?? "service_role";
    } else {
      sb = await supabaseServer();
      source = source ?? "request_scope";
    }
  }

  const { data, error } = await fetchSystemSettingsRow(sb);
  const resolvedSource = source ?? "request_scope";
  const detail = serializeRepositoryError(error);

  if (error) {
    const status = isSystemSettingsTableMissingError(error) ? "table_missing" : "read_error";
    return {
      settings: withDefaults(null),
      baseline: buildBaseline(status, resolvedSource, detail),
    };
  }

  if (!data) {
    return {
      settings: withDefaults(null),
      baseline: buildBaseline("row_missing", resolvedSource, null),
    };
  }

  return {
    settings: withDefaults(data as unknown as Parameters<typeof withDefaults>[0]),
    baseline: buildBaseline("ready", resolvedSource, null),
  };
}

/**
 * Fail-safe read (Control Tower): null ved feil/tom rad — logger, kaster ikke.
 */
export async function getSystemSettingsSafe(sb: SupabaseClient<Database>): Promise<SystemSettings | null> {
  try {
    const baselineRead = await readSystemSettingsBaseline({ sb, source: "request_scope" });
    if (baselineRead.baseline.status !== "ready") {
      opsLog("system_settings", {
        kind: "SETTINGS_BASELINE_DEGRADED",
        message: baselineRead.baseline.detail ?? baselineRead.baseline.status,
      });
      return null;
    }
    return baselineRead.settings;
  } catch (err) {
    opsLog("system_settings", {
      kind: "SETTINGS_FATAL",
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function getSystemSettings(): Promise<SystemSettings> {
  const baselineRead = await readSystemSettingsBaseline();
  if (baselineRead.baseline.status !== "ready") {
    opsLog("system_settings", {
      kind: "SETTINGS_BASELINE_FALLBACK",
      status: baselineRead.baseline.status,
      source: baselineRead.baseline.source,
      message: baselineRead.baseline.detail ?? baselineRead.baseline.operatorMessage,
    });
  }
  return baselineRead.settings;
}

/** Guards som resten av systemet kan bruke */
export function isOrdersBlocked(s: SystemSettings) {
  return s.killswitch.orders;
}
export function isCancellationsBlocked(s: SystemSettings) {
  return s.killswitch.cancellations;
}
export function isEmailsBlocked(s: SystemSettings) {
  return s.killswitch.emails;
}
