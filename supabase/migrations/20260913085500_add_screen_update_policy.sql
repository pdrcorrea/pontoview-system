alter table public.screen_settings
  add column if not exists auto_update boolean not null default true,
  add column if not exists update_channel text not null default 'stable',
  add column if not exists update_request_revision bigint not null default 0;

alter table public.screen_settings
  drop constraint if exists screen_settings_update_channel_check;

alter table public.screen_settings
  add constraint screen_settings_update_channel_check
  check (update_channel in ('stable', 'beta'));
