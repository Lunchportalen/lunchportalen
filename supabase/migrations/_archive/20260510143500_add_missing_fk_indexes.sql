-- Add missing indexes for public foreign-key columns.
-- Idempotent and ordered with operational tables first.

CREATE INDEX IF NOT EXISTS idx_orders_menu_service_day_id
  ON public.orders(menu_service_day_id);

CREATE INDEX IF NOT EXISTS idx_orders_created_by
  ON public.orders(created_by);

CREATE INDEX IF NOT EXISTS idx_standing_orders_company_id
  ON public.standing_orders(company_id);

CREATE INDEX IF NOT EXISTS idx_menu_service_days_company_id
  ON public.menu_service_days(company_id);

CREATE INDEX IF NOT EXISTS idx_menu_service_days_created_by
  ON public.menu_service_days(created_by);

CREATE INDEX IF NOT EXISTS idx_order_items_menu_service_day_item_id
  ON public.order_items(menu_service_day_item_id);

CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_by
  ON public.order_status_history(changed_by);

CREATE INDEX IF NOT EXISTS idx_delivery_runs_company_id
  ON public.delivery_runs(company_id);

CREATE INDEX IF NOT EXISTS idx_delivery_runs_created_by
  ON public.delivery_runs(created_by);

CREATE INDEX IF NOT EXISTS idx_delivery_run_items_product_id
  ON public.delivery_run_items(product_id);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_billing_adjustment_id
  ON public.invoice_lines(billing_adjustment_id);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_user_id
  ON public.invoice_lines(user_id);

CREATE INDEX IF NOT EXISTS idx_invoice_runs_created_by
  ON public.invoice_runs(created_by);

CREATE INDEX IF NOT EXISTS idx_billing_adjustments_created_by
  ON public.billing_adjustments(created_by);

CREATE INDEX IF NOT EXISTS idx_billing_adjustments_invoice_run_id
  ON public.billing_adjustments(invoice_run_id);

CREATE INDEX IF NOT EXISTS idx_billing_adjustments_location_id
  ON public.billing_adjustments(location_id);

CREATE INDEX IF NOT EXISTS idx_products_category_id
  ON public.products(category_id);

CREATE INDEX IF NOT EXISTS idx_agreements_reviewed_by
  ON public.agreements(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_companies_created_by
  ON public.companies(created_by);

CREATE INDEX IF NOT EXISTS idx_company_memberships_granted_by
  ON public.company_memberships(granted_by);

CREATE INDEX IF NOT EXISTS idx_platform_user_roles_granted_by
  ON public.platform_user_roles(granted_by);

CREATE INDEX IF NOT EXISTS idx_company_invites_created_by
  ON public.company_invites(created_by);

CREATE INDEX IF NOT EXISTS idx_employee_invites_created_by_user_id
  ON public.employee_invites(created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_company_registrations_reviewed_by
  ON public.company_registrations(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_user_id
  ON public.audit_log(actor_user_id);

CREATE INDEX IF NOT EXISTS idx_menu_visibility_days_updated_by
  ON public.menu_visibility_days(updated_by);
