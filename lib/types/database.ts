/**
 * Supabase `Database` types for `createClient<Database>` / SSR clients.
 * Hand-maintained (local `supabase gen types` needs Docker). Unknown columns use `Json | Date`;
 * `ai_action_memory` is strict snake_case to match migrations.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * Loose tables: permissive until `supabase gen types` (Docker) replaces this file.
 * `ai_action_memory` remains strict snake_case (migration contract).
 */
type LoosePublicTable = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Row: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Insert: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Update: Record<string, any>;
  Relationships: [];
};

/** Typed subset of `public.system_settings` (jsonb columns + metadata). */
type SystemSettingsTable = {
  Row: {
    id: string;
    toggles: Json | null;
    killswitch: Json | null;
    retention: Json | null;
    updated_at: string | null;
    updated_by: string | null;
  };
  Insert: {
    id?: string;
    toggles?: Json | null;
    killswitch?: Json | null;
    retention?: Json | null;
    updated_at?: string | null;
    updated_by?: string | null;
  };
  Update: Partial<{
    id: string;
    toggles: Json | null;
    killswitch: Json | null;
    retention: Json | null;
    updated_at: string | null;
    updated_by: string | null;
  }>;
  Relationships: [];
};

type AiActionMemoryTable = {
  Row: {
    id: string;
    action_key: string;
    surface: string;
    action_type: string;
    target_id: string | null;
    expires_at: string;
    created_at: string;
  };
  Insert: {
    id?: string;
    action_key: string;
    surface: string;
    action_type: string;
    target_id?: string | null;
    expires_at: string;
    created_at?: string;
  };
  Update: Partial<{
    id: string;
    action_key: string;
    surface: string;
    action_type: string;
    target_id: string | null;
    expires_at: string;
    created_at: string;
  }>;
  Relationships: [];
};

const PUBLIC_TABLE_NAMES = [
  "ab_experiments",
  "ab_variants",
  "agreements",
  "ai_action_memory",
  "ai_alerts",
  "ai_activity_log",
  "ai_config",
  "ai_autonomy_audit",
  "ai_demo_ab_context_state",
  "ai_demo_cta_ab_state",
  "ai_experiment_memory",
  "ai_experiment_results",
  "ai_experiments",
  "ai_intelligence_events",
  "ai_governance_apply_log",
  "ai_jobs",
  "ai_learning",
  "ai_learning_patterns",
  "ai_memory",
  "ai_metrics_history",
  "ai_models",
  "ai_observability",
  "ai_platform_governance",
  "ai_suggestions",
  "audit_events",
  "audit_log",
  "audit_logs",
  "audit_meta_events",
  "audit_rows",
  "billing_products",
  "billing_tax_codes",
  "break_glass_sessions",
  "companies",
  "company_agreements",
  "company_billing_accounts",
  "company_current_agreement",
  "company_current_agreement_rules",
  "company_deletions",
  "company_invites",
  "company_locations",
  "company_registrations",
  "company_terms_acceptance",
  "content_analytics_events",
  "content_audit_log",
  "content_experiments",
  "content_health",
  "content_page_variants",
  "content_pages",
  "content_release_items",
  "content_releases",
  "content_workflow_state",
  "cron_runs",
  "daily_company_rollup",
  "daily_employee_orders",
  "day_choices",
  "deliveries",
  "delivery_batches",
  "delivery_confirmations",
  "demo_interest_leads",
  "email_outbox",
  "employee_audit",
  "employee_invites",
  "enterprise_groups",
  "entities",
  "entity_relations",
  "esg_monthly",
  "esg_monthly_snapshots",
  "esg_yearly_snapshots",
  "experiment_events",
  "experiment_revenue",
  "experiment_results",
  "experiment_sessions",
  "experiment_variants",
  "experiments",
  "forecast_daily",
  "form_submissions",
  "forms",
  "global_content",
  "idempotency",
  "incidents",
  "invoice_exports",
  "invoice_lines",
  "invoice_periods",
  "invoice_runs",
  "invoices",
  "kitchen_batch",
  "kitchen_batches",
  "lead_pipeline",
  "location_audit",
  "media_items",
  "menu_visibility_days",
  "order_outbox",
  "orders",
  "ops_events",
  "outbox",
  "profiles",
  "quality_reports",
  "repair_jobs",
  "saas_subscriptions",
  "social_events",
  "social_posts",
  "superadmin_audit_log",
  "support_reports",
  "system_health_snapshots",
  "system_incidents",
  "system_settings",
  "tripletex_customers",
  "tripletex_exports",
  "waste_signals",
] as const;

type PublicTableName = (typeof PUBLIC_TABLE_NAMES)[number];

export type Database = {
  public: {
    Tables: {
      [K in PublicTableName]: K extends "ai_action_memory"
        ? AiActionMemoryTable
        : K extends "system_settings"
          ? SystemSettingsTable
          : LoosePublicTable;
    };
    Views: {
      v_company_current_agreement_daymap: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Row: Record<string, any>;
        Relationships: [];
      };
      v_receipt_rows: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Row: Record<string, any>;
        Relationships: [];
      };
    };
    Functions: {
      [fn: string]: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Args: Record<string, any>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Returns: any;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
