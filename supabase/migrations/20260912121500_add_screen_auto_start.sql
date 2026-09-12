alter table public.screen_settings
  add column if not exists auto_start boolean not null default true;

comment on column public.screen_settings.auto_start is
  'When true, supported native PontoView players persist the preference and attempt to launch automatically after Android boot.';
