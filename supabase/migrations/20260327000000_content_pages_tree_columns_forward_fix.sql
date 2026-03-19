-- Corrective forward fix: ensure content_pages has tree columns required by /api/backoffice/content/tree.
-- Idempotent: safe to run when 20260320000000_content_tree_persistence was applied or skipped.
-- Scope: content tree only. No media, forms, or other tables.

-- 1) Add tree columns if missing (no-op if already present)
alter table public.content_pages
  add column if not exists tree_parent_id uuid null references public.content_pages(id) on delete set null,
  add column if not exists tree_root_key text null check (tree_root_key in ('home','overlays','global','design')),
  add column if not exists tree_sort_order int not null default 0;

-- 2) Backfill: only rows that still need placement (tree_root_key and tree_parent_id both null)
update public.content_pages
set tree_root_key = 'home', tree_sort_order = 0
where slug = 'home' and (tree_root_key is null and tree_parent_id is null);

update public.content_pages
set tree_root_key = 'overlays', tree_sort_order = 0
where slug = 'week' and (tree_root_key is null and tree_parent_id is null);

update public.content_pages
set tree_root_key = 'overlays', tree_sort_order = 1
where slug = 'dashboard' and (tree_root_key is null and tree_parent_id is null);

update public.content_pages
set tree_root_key = 'overlays', tree_sort_order = 2
where slug = 'company-admin' and (tree_root_key is null and tree_parent_id is null);

update public.content_pages
set tree_root_key = 'overlays', tree_sort_order = 3
where slug = 'superadmin' and (tree_root_key is null and tree_parent_id is null);

update public.content_pages
set tree_root_key = 'overlays', tree_sort_order = 4
where slug = 'kitchen' and (tree_root_key is null and tree_parent_id is null);

update public.content_pages
set tree_root_key = 'overlays', tree_sort_order = 5
where slug = 'driver' and (tree_root_key is null and tree_parent_id is null);

update public.content_pages
set tree_root_key = 'global', tree_sort_order = 0
where slug = 'header' and (tree_root_key is null and tree_parent_id is null);

update public.content_pages
set tree_root_key = 'global', tree_sort_order = 1
where slug = 'footer' and (tree_root_key is null and tree_parent_id is null);

update public.content_pages
set tree_root_key = 'design', tree_sort_order = 0
where slug = 'design-tokens' and (tree_root_key is null and tree_parent_id is null);

update public.content_pages
set tree_root_key = 'overlays', tree_sort_order = 100
where tree_root_key is null and tree_parent_id is null
  and slug not in ('home','week','dashboard','company-admin','superadmin','kitchen','driver','header','footer','design-tokens');

update public.content_pages
set tree_root_key = 'overlays', tree_sort_order = 99
where tree_root_key is null and tree_parent_id is null;

-- 3) Placement constraint (drop if exists then add)
alter table public.content_pages
  drop constraint if exists content_pages_tree_placement_check;
alter table public.content_pages
  add constraint content_pages_tree_placement_check check (
    (tree_parent_id is null and tree_root_key is not null)
    or (tree_parent_id is not null and tree_root_key is null)
  );
