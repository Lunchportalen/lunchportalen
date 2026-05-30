-- FK support indexes for backoffice schema
-- Ensures performant joins and deletes for FK columns
-- Added after Phase D audit; idempotent for environments where indexes already exist

CREATE INDEX IF NOT EXISTS content_pages_tree_parent_idx
ON public.content_pages (tree_parent_id);

CREATE INDEX IF NOT EXISTS esg_daily_company_idx
ON public.esg_daily (company_id);

CREATE INDEX IF NOT EXISTS esg_daily_location_idx
ON public.esg_daily (location_id);

CREATE INDEX IF NOT EXISTS esg_monthly_company_idx
ON public.esg_monthly (company_id);

CREATE INDEX IF NOT EXISTS form_submissions_created_by_idx
ON public.form_submissions (created_by);

CREATE INDEX IF NOT EXISTS invoice_lines_location_idx
ON public.invoice_lines (location_id);
