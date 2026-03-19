-- Content tree persistence: parent/root placement + sort order.
-- Idempotent: adds columns and backfills; no block schema changes.
-- Tree roots (home, overlays, global, design) remain virtual in app; only content_pages rows are placed.
--
-- App truth: every content_pages insert MUST satisfy placement (content_pages_tree_placement_check):
--   (tree_parent_id IS NULL AND tree_root_key IS NOT NULL) OR (tree_parent_id IS NOT NULL AND tree_root_key IS NULL).
-- So set either (tree_root_key, tree_sort_order) when creating a root-level page, or (tree_parent_id, tree_sort_order) when creating under a page.

alter table public.content_pages
  add column if not exists tree_parent_id uuid null references public.content_pages(id) on delete set null,
  add column if not exists tree_root_key text null check (tree_root_key in ('home','overlays','global','design')),
  add column if not exists tree_sort_order int not null default 0;

-- Backfill: match current derived tree (slug-based attachment to virtual roots).
update public.content_pages
set tree_root_key = 'home', tree_sort_order = 0
where slug = 'home' and (tree_root_key is null or tree_parent_id is not null);

update public.content_pages
set tree_root_key = 'overlays', tree_sort_order = 0
where slug = 'week' and (tree_root_key is null or tree_parent_id is not null);

update public.content_pages
set tree_root_key = 'overlays', tree_sort_order = 1
where slug = 'dashboard' and (tree_root_key is null or tree_parent_id is not null);

update public.content_pages
set tree_root_key = 'overlays', tree_sort_order = 2
where slug = 'company-admin' and (tree_root_key is null or tree_parent_id is not null);

update public.content_pages
set tree_root_key = 'overlays', tree_sort_order = 3
where slug = 'superadmin' and (tree_root_key is null or tree_parent_id is not null);

update public.content_pages
set tree_root_key = 'overlays', tree_sort_order = 4
where slug = 'kitchen' and (tree_root_key is null or tree_parent_id is not null);

update public.content_pages
set tree_root_key = 'overlays', tree_sort_order = 5
where slug = 'driver' and (tree_root_key is null or tree_parent_id is not null);

update public.content_pages
set tree_root_key = 'global', tree_sort_order = 0
where slug = 'header' and (tree_root_key is null or tree_parent_id is not null);

update public.content_pages
set tree_root_key = 'global', tree_sort_order = 1
where slug = 'footer' and (tree_root_key is null or tree_parent_id is not null);

update public.content_pages
set tree_root_key = 'design', tree_sort_order = 0
where slug = 'design-tokens' and (tree_root_key is null or tree_parent_id is not null);

-- Remaining pages (global, design folder rows, any other slugs): default to overlays with high sort.
update public.content_pages
set tree_root_key = 'overlays', tree_sort_order = 100
where tree_root_key is null and tree_parent_id is null
  and slug not in ('home','week','dashboard','company-admin','superadmin','kitchen','driver','header','footer','design-tokens');

-- Ensure every row has placement (backfill may have missed rows without slug match).
update public.content_pages
set tree_root_key = 'overlays', tree_sort_order = 99
where tree_root_key is null and tree_parent_id is null;

-- Placement: either under a page (tree_parent_id set) or under a virtual root (tree_root_key set). Added after backfill.
alter table public.content_pages
  drop constraint if exists content_pages_tree_placement_check;
alter table public.content_pages
  add constraint content_pages_tree_placement_check check (
    (tree_parent_id is null and tree_root_key is not null)
    or (tree_parent_id is not null and tree_root_key is null)
  );
