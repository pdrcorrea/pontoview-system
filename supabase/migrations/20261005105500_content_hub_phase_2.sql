-- PontoView Central de Conteúdo — Fase 2 (Notícias)
-- Pré-requisitos mínimos da Fase 1 + modelo editorial necessário para ingestão, revisão e publicação.

create extension if not exists pgcrypto;

create table if not exists public.content_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  source_type text not null default 'api' check (source_type in ('rss','api','manual','partner')),
  site_url text,
  feed_url text,
  default_content_type text not null default 'news' check (default_content_type in ('news','curiosity','culture','health','institutional')),
  default_category text not null default 'general',
  is_active boolean not null default true,
  requires_review boolean not null default true,
  trust_level smallint not null default 1 check (trust_level between 0 and 5),
  attribution_label text,
  license_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.content_sources(id) on delete set null,
  content_type text not null default 'news' check (content_type in ('news','curiosity','culture','health','institutional')),
  category text not null default 'general',
  slug text not null unique,
  title text not null,
  summary text,
  body text,
  image_url text,
  source_name text not null,
  source_url text,
  source_author text,
  source_published_at timestamptz,
  status text not null default 'review' check (status in ('draft','imported','review','approved','published','rejected','expired','archived')),
  editorial_flags jsonb not null default '[]'::jsonb,
  review_notes text,
  imported_at timestamptz,
  reviewed_at timestamptz,
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_items_published_requirements check (
    status <> 'published' or (
      length(btrim(title)) > 0 and
      length(btrim(source_name)) > 0 and
      published_at is not null
    )
  )
);

create unique index if not exists content_items_source_url_unique
  on public.content_items(source_id, source_url)
  where source_id is not null and source_url is not null;

create index if not exists content_items_distribution_idx
  on public.content_items(content_type, status, category, published_at desc)
  where status = 'published';

create index if not exists content_items_review_queue_idx
  on public.content_items(status, imported_at desc)
  where status in ('imported','review','approved');

create index if not exists content_items_source_published_idx
  on public.content_items(source_id, source_published_at desc);

create table if not exists public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  change_type text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists content_revisions_item_idx
  on public.content_revisions(content_item_id, created_at desc);

create or replace function public.content_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.content_log_revision()
returns trigger
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  v_change_type text := 'update';
begin
  if old.status is distinct from new.status then
    v_change_type := 'status:' || old.status || '->' || new.status;
  end if;

  insert into public.content_revisions(content_item_id, changed_by, change_type, snapshot)
  values (
    new.id,
    auth.uid(),
    v_change_type,
    jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
  );

  return new;
end;
$$;

drop trigger if exists content_sources_touch_updated_at on public.content_sources;
create trigger content_sources_touch_updated_at
before update on public.content_sources
for each row execute function public.content_touch_updated_at();

drop trigger if exists content_items_touch_updated_at on public.content_items;
create trigger content_items_touch_updated_at
before update on public.content_items
for each row execute function public.content_touch_updated_at();

drop trigger if exists content_items_log_revision on public.content_items;
create trigger content_items_log_revision
after update on public.content_items
for each row execute function public.content_log_revision();

alter table public.content_sources enable row level security;
alter table public.content_items enable row level security;
alter table public.content_revisions enable row level security;

-- A Central é acessada por Edge Functions. O frontend não recebe acesso direto às tabelas editoriais.
revoke all on table public.content_sources from anon, authenticated;
revoke all on table public.content_items from anon, authenticated;
revoke all on table public.content_revisions from anon, authenticated;

-- Fonte técnica atual usada para a transição do fluxo legado screens-news.
insert into public.content_sources (
  name, slug, source_type, site_url, feed_url, default_content_type, default_category,
  is_active, requires_review, trust_level, attribution_label
)
values (
  'PontoView News Provider',
  'pontoview-news-provider',
  'api',
  'https://pontoview.com.br',
  'https://pontoview-api.pedrhc258.workers.dev/api/news',
  'news',
  'general',
  true,
  true,
  2,
  'Fonte original identificada em cada notícia'
)
on conflict (slug) do update set
  feed_url = excluded.feed_url,
  is_active = true,
  requires_review = true,
  updated_at = now();
