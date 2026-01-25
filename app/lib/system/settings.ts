// lib/system/settings.ts
import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

export type SystemToggles = {
  enforce_cutoff?: boolean;          // håndhev 08:00 (default true)
  require_active_agreement?: boolean; // ingen bestilling uten avtale (default true)
  employee_self_service?: boolean;    // ansatt kan bestille/avbestille (default true)
  company_admin_can_order?: boolean;  // company_admin kan også bestille (default true)
  strict_mode?: boolean;              // ingen unntak (default true)
  esg_engine?: boolean;               // aktiver ESG-motor (default false/true som dere ønsker)
  email_backup?: boolean;             // ordre@... outbox/retry (default true)
};

export type KillSwitch = {
  orders: boolean;
  cancellations: boolean;
  emails: boolean;
  kitchen_feed: boolean;
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

function withDefaults(raw: Partial<SystemSettings> | null): SystemSettings {
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
    },
    killswitch: {
      orders: Boolean(killswitch.orders ?? false),
      cancellations: Boolean(killswitch.cancellations ?? false),
      emails: Boolean(killswitch.emails ?? false),
      kitchen_feed: Boolean(killswitch.kitchen_feed ?? false),
    },
    retention: {
      orders_months: Number.isFinite(retention.orders_months) ? Number(retention.orders_months) : 18,
      audit_years: Number.isFinite(retention.audit_years) ? Number(retention.audit_years) : 5,
    },
    updated_at: raw?.updated_at ?? null,
    updated_by: raw?.updated_by ?? null,
  };
}

export async function getSystemSettings(): Promise<SystemSettings> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("system_settings")
    .select("toggles,killswitch,retention,updated_at,updated_by")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error(`system_settings read failed: ${error.message}`);
  return withDefaults(data as any);
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
