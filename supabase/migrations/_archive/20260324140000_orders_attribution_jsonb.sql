-- Additive: optional marketing attribution on orders (AI Social / explainable revenue path).
-- Written server-side after lp_order_set; null = no claim (fail-closed analytics).

begin;

alter table if exists public.orders
  add column if not exists attribution jsonb;

comment on column public.orders.attribution is
  'Optional JSON: { "postId"?: string, "source"?: "ai_social", "productId"?: string, "capturedAt"?: number }. No synthetic revenue.';

commit;
