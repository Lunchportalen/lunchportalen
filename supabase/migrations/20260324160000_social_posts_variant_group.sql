-- A/B-gruppering for social_posts (valgfri kolonne; eksisterende rader forblir NULL → behandles som «ungrouped» i app).

alter table public.social_posts
  add column if not exists variant_group_id text;

create index if not exists social_posts_variant_group_id_idx on public.social_posts (variant_group_id);
