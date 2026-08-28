-- PontoView Screens 1.0 - additive multi-tenant schema.
-- This project shares a Supabase instance with other PontoView products, so
-- billing tables are prefixed with screen_ and the existing profiles table is reused.

create extension if not exists unaccent with schema extensions;

do $$ begin
  create type public.organization_role as enum ('owner', 'admin', 'editor', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.screen_orientation as enum ('landscape', 'portrait');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.screen_layout_mode as enum ('fullscreen', 'lframe');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.media_type as enum ('drive_image', 'drive_video', 'youtube', 'webpage', 'app', 'message');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.media_status as enum ('ready', 'processing', 'unavailable', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.schedule_priority as enum ('default', 'timed', 'campaign');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.screen_subscription_status as enum ('trial', 'active', 'past_due', 'canceled', 'suspended');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists phone text,
  add column if not exists onboarding_completed boolean not null default false;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  display_name text not null check (char_length(display_name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  document text,
  timezone text not null default 'America/Sao_Paulo',
  locale text not null default 'pt-BR',
  settings jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, created_by)
);

create table if not exists public.organization_users (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.organization_role not null default 'viewer',
  invited_by uuid references public.profiles(id),
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists organization_users_user_id_idx
  on public.organization_users (user_id, organization_id);
create index if not exists organization_users_org_role_idx
  on public.organization_users (organization_id, role);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  is_default boolean not null default false,
  revision bigint not null default 1 check (revision > 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create unique index if not exists playlists_one_default_per_org_idx
  on public.playlists (organization_id) where is_default;
create index if not exists playlists_org_updated_idx
  on public.playlists (organization_id, updated_at desc);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type public.media_type not null,
  status public.media_status not null default 'ready',
  name text not null check (char_length(name) between 1 and 180),
  description text,
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 86400),
  online_required boolean not null default true,
  thumbnail_url text,
  drive_connection_id uuid,
  drive_file_id text,
  drive_mime_type text,
  drive_modified_time timestamptz,
  drive_checksum text,
  youtube_video_id text check (youtube_video_id is null or youtube_video_id ~ '^[A-Za-z0-9_-]{6,20}$'),
  youtube_options jsonb not null default '{"autoplay":true,"mute":false,"volume":100,"controls":false,"start":0}'::jsonb,
  page_url text,
  app_key text,
  message_content jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint media_source_required check (
    (type in ('drive_image','drive_video') and drive_file_id is not null)
    or (type = 'youtube' and youtube_video_id is not null)
    or (type = 'webpage' and page_url is not null)
    or (type = 'app' and app_key is not null)
    or (type = 'message' and message_content is not null)
  )
);
create index if not exists media_org_type_status_idx
  on public.media (organization_id, type, status);
create index if not exists media_org_updated_idx
  on public.media (organization_id, updated_at desc);
create unique index if not exists media_drive_file_org_idx
  on public.media (organization_id, drive_connection_id, drive_file_id)
  where drive_file_id is not null and status <> 'archived';

create table if not exists public.playlist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  playlist_id uuid not null,
  media_id uuid not null,
  position integer not null check (position >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 86400),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (playlist_id, position),
  foreign key (playlist_id, organization_id) references public.playlists(id, organization_id) on delete cascade,
  foreign key (media_id, organization_id) references public.media(id, organization_id) on delete restrict
);
create index if not exists playlist_items_playlist_position_idx
  on public.playlist_items (playlist_id, position);
create index if not exists playlist_items_media_id_idx
  on public.playlist_items (media_id);

create table if not exists public.screens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  orientation public.screen_orientation not null default 'landscape',
  default_playlist_id uuid,
  device_token_hash text,
  paired_at timestamptz,
  paired_by uuid references public.profiles(id),
  is_active boolean not null default true,
  settings_revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, slug),
  foreign key (default_playlist_id, organization_id) references public.playlists(id, organization_id) on delete set null (default_playlist_id)
);
create index if not exists screens_org_active_idx
  on public.screens (organization_id, is_active);
create index if not exists screens_default_playlist_idx
  on public.screens (default_playlist_id) where default_playlist_id is not null;

create table if not exists public.screen_settings (
  screen_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  layout_mode public.screen_layout_mode not null default 'fullscreen',
  side_position text not null default 'right' check (side_position in ('left','right')),
  bar_position text not null default 'bottom' check (bar_position in ('top','bottom')),
  side_width_percent integer not null default 24 check (side_width_percent between 15 and 40),
  bar_height_percent integer not null default 15 check (bar_height_percent between 8 and 30),
  widgets jsonb not null default '{"clock":true,"date":true,"weather":false,"news":false,"messages":false,"business":false}'::jsonb,
  weather_location jsonb,
  news_categories text[] not null default array['general']::text[],
  transition text not null default 'fade' check (transition in ('fade','cut')),
  image_duration_seconds integer not null default 15 check (image_duration_seconds between 3 and 3600),
  updated_at timestamptz not null default now(),
  foreign key (screen_id, organization_id) references public.screens(id, organization_id) on delete cascade
);
create index if not exists screen_settings_org_idx on public.screen_settings (organization_id);

create table if not exists public.screen_status (
  screen_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  last_seen timestamptz not null default now(),
  current_media_id uuid,
  current_playlist_id uuid,
  player_version text,
  connectivity text not null default 'online' check (connectivity in ('online','offline','degraded')),
  screenshot_url text,
  screenshot_at timestamptz,
  client_info jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  foreign key (screen_id, organization_id) references public.screens(id, organization_id) on delete cascade,
  foreign key (current_media_id, organization_id) references public.media(id, organization_id) on delete set null (current_media_id),
  foreign key (current_playlist_id, organization_id) references public.playlists(id, organization_id) on delete set null (current_playlist_id)
);
create index if not exists screen_status_org_last_seen_idx
  on public.screen_status (organization_id, last_seen desc);

create table if not exists public.screen_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  screen_id uuid not null,
  event_type text not null check (event_type in ('player_online','player_offline','content_started','content_ended','media_error','sync','paired')),
  media_id uuid,
  playlist_id uuid,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  foreign key (screen_id, organization_id) references public.screens(id, organization_id) on delete cascade,
  foreign key (media_id, organization_id) references public.media(id, organization_id) on delete set null (media_id),
  foreign key (playlist_id, organization_id) references public.playlists(id, organization_id) on delete set null (playlist_id)
);
create index if not exists screen_events_org_occurred_idx
  on public.screen_events (organization_id, occurred_at desc);
create index if not exists screen_events_screen_occurred_idx
  on public.screen_events (screen_id, occurred_at desc);

create table if not exists public.screen_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, name)
);

create table if not exists public.screen_group_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null,
  screen_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (group_id, screen_id),
  foreign key (group_id, organization_id) references public.screen_groups(id, organization_id) on delete cascade,
  foreign key (screen_id, organization_id) references public.screens(id, organization_id) on delete cascade
);
create index if not exists screen_group_members_screen_idx on public.screen_group_members (screen_id);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  playlist_id uuid not null,
  priority public.schedule_priority not null default 'timed',
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text not null default 'America/Sao_Paulo',
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (playlist_id, organization_id) references public.playlists(id, organization_id) on delete cascade,
  constraint schedules_window_valid check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists schedules_org_active_window_idx
  on public.schedules (organization_id, is_active, starts_at, ends_at);
create index if not exists schedules_playlist_id_idx on public.schedules (playlist_id);

create table if not exists public.schedule_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  schedule_id uuid not null,
  screen_id uuid,
  screen_group_id uuid,
  weekdays smallint[] not null default array[0,1,2,3,4,5,6]::smallint[],
  start_time time not null default '00:00',
  end_time time not null default '23:59:59',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (schedule_id, organization_id) references public.schedules(id, organization_id) on delete cascade,
  foreign key (screen_id, organization_id) references public.screens(id, organization_id) on delete cascade,
  foreign key (screen_group_id, organization_id) references public.screen_groups(id, organization_id) on delete cascade,
  constraint schedule_rule_target check ((screen_id is not null)::integer + (screen_group_id is not null)::integer = 1),
  constraint schedule_rule_weekdays check (weekdays <@ array[0,1,2,3,4,5,6]::smallint[])
);
create index if not exists schedule_rules_schedule_idx on public.schedule_rules (schedule_id);
create index if not exists schedule_rules_screen_idx on public.schedule_rules (screen_id) where screen_id is not null;
create index if not exists schedule_rules_group_idx on public.schedule_rules (screen_group_id) where screen_group_id is not null;

create table if not exists public.drive_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connected_by uuid not null references public.profiles(id),
  google_account_id text not null,
  google_email text not null,
  scopes text[] not null default '{}'::text[],
  root_folder_id text,
  status text not null default 'active' check (status in ('active','expired','revoked','error')),
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, google_account_id)
);
create index if not exists drive_connections_org_status_idx on public.drive_connections (organization_id, status);

alter table public.media
  add constraint media_drive_connection_fkey
  foreign key (drive_connection_id, organization_id)
  references public.drive_connections(id, organization_id) on delete set null (drive_connection_id);

create table if not exists private.drive_credentials (
  connection_id uuid primary key references public.drive_connections(id) on delete cascade,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text,
  body text not null check (char_length(body) between 1 and 1000),
  starts_at timestamptz,
  ends_at timestamptz,
  weekdays smallint[] not null default array[0,1,2,3,4,5,6]::smallint[],
  start_time time not null default '00:00',
  end_time time not null default '23:59:59',
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint messages_window_valid check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists messages_org_active_window_idx on public.messages (organization_id, is_active, starts_at, ends_at);

create table if not exists public.message_screens (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  message_id uuid not null,
  screen_id uuid not null,
  primary key (message_id, screen_id),
  foreign key (message_id, organization_id) references public.messages(id, organization_id) on delete cascade,
  foreign key (screen_id, organization_id) references public.screens(id, organization_id) on delete cascade
);
create index if not exists message_screens_screen_idx on public.message_screens (screen_id);

create table if not exists public.app_instances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  app_key text not null check (app_key in ('clock','weather','news','menu_board','messages','busboard','business')),
  name text not null check (char_length(name) between 1 and 120),
  config jsonb not null default '{}'::jsonb,
  online_required boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index if not exists app_instances_org_app_idx on public.app_instances (organization_id, app_key);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  billing_period text not null default 'monthly' check (billing_period in ('monthly','yearly')),
  screen_limit integer not null check (screen_limit > 0),
  user_limit integer not null check (user_limit > 0),
  trial_days integer not null default 14 check (trial_days between 0 and 90),
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.screen_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status public.screen_subscription_status not null default 'trial',
  provider text check (provider is null or provider = 'mercadopago'),
  provider_subscription_id text unique,
  provider_plan_id text,
  payer_email text,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  provider_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists screen_subscriptions_status_idx on public.screen_subscriptions (status, current_period_end);
create index if not exists screen_subscriptions_plan_id_idx on public.screen_subscriptions (plan_id);

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid not null references public.screen_subscriptions(id) on delete cascade,
  provider_payment_id text not null unique,
  status text not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'BRL',
  paid_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists billing_payments_org_created_idx on public.billing_payments (organization_id, created_at desc);
create index if not exists billing_payments_subscription_idx on public.billing_payments (subscription_id);

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  screen_id uuid,
  category text not null check (category in ('technical','financial','commercial','other')),
  subject text not null check (char_length(subject) between 3 and 180),
  message text not null check (char_length(message) between 10 and 5000),
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (screen_id, organization_id) references public.screens(id, organization_id) on delete set null (screen_id)
);
create index if not exists support_requests_org_created_idx on public.support_requests (organization_id, created_at desc);
create index if not exists support_requests_user_id_idx on public.support_requests (user_id);

create table if not exists public.news_cache (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  category text not null,
  title text not null,
  summary text,
  url text not null,
  image_url text,
  published_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (source, url)
);
create index if not exists news_cache_category_published_idx on public.news_cache (category, published_at desc);
create index if not exists news_cache_expiry_idx on public.news_cache (expires_at);

create table if not exists private.screen_activations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[0-9]{6}$'),
  claimed_screen_id uuid references public.screens(id) on delete set null,
  device_token text,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  claimed_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists screen_activations_expiry_idx on private.screen_activations (expires_at);

insert into public.plans (code, name, description, price_cents, screen_limit, user_limit, trial_days, features, sort_order)
values
  ('start', 'PontoView Start', 'Para colocar a primeira tela no ar.', 4990, 1, 2, 14, '{"drive":true,"youtube":true,"lframe":true}'::jsonb, 10),
  ('pro', 'PontoView Pro', 'Para operações com várias telas e programações.', 7990, 5, 5, 14, '{"drive":true,"youtube":true,"lframe":true,"news":true,"telemetry":true}'::jsonb, 20),
  ('business', 'PontoView Business', 'Mais telas, usuários e suporte prioritário.', 14990, 15, 10, 14, '{"drive":true,"youtube":true,"lframe":true,"news":true,"telemetry":true,"priority_support":true}'::jsonb, 30)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  screen_limit = excluded.screen_limit,
  user_limit = excluded.user_limit,
  features = excluded.features,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Consistent updated_at behavior for mutable entities.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'organizations','organization_users','playlists','media','playlist_items','screens',
    'screen_settings','screen_status','screen_groups','schedules','schedule_rules',
    'drive_connections','messages','app_instances','plans','screen_subscriptions',
    'billing_payments','support_requests'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || table_name || '_updated_at', table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', 'trg_' || table_name || '_updated_at', table_name);
  end loop;
end $$;

-- Realtime only for data the Player must refresh immediately. The block is
-- idempotent because publications do not support ADD TABLE IF NOT EXISTS.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'playlists') then
    alter publication supabase_realtime add table public.playlists;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'playlist_items') then
    alter publication supabase_realtime add table public.playlist_items;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'screens') then
    alter publication supabase_realtime add table public.screens;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'screen_settings') then
    alter publication supabase_realtime add table public.screen_settings;
  end if;
end $$;
