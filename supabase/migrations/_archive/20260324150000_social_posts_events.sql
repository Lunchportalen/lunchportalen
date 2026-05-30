-- Social engine persistence: calendar posts + click/lead events (service-role / admin API).

create table if not exists public.social_posts (
  id text primary key,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'planned',
  scheduled_at timestamptz,
  platform text not null default 'facebook',
  published_at timestamptz,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_posts_status_idx on public.social_posts (status);
create index if not exists social_posts_created_at_idx on public.social_posts (created_at desc);

create table if not exists public.social_events (
  id uuid primary key default gen_random_uuid(),
  post_id text,
  type text not null,
  created_at timestamptz not null default now()
);

create index if not exists social_events_post_id_idx on public.social_events (post_id);
create index if not exists social_events_created_at_idx on public.social_events (created_at desc);

alter table public.social_posts enable row level security;
alter table public.social_events enable row level security;
