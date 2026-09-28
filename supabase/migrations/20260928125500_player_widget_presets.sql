-- Presets individuais dos widgets e tema do player.

alter table public.screen_settings
  add column if not exists theme text not null default 'light',
  add column if not exists widget_settings jsonb not null default '{
    "clock":{"preset":"classic"},
    "weather":{"preset":"complete"},
    "news":{"preset":"editorial"},
    "messages":{"preset":"highlight"},
    "business":{"preset":"logo","position":"side_footer"}
  }'::jsonb;

alter table public.screen_settings
  drop constraint if exists screen_settings_theme_check,
  add constraint screen_settings_theme_check
    check (theme in ('light','dark'));
