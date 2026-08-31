alter table public.screen_settings
  add column if not exists operating_hours jsonb not null
  default '{"enabled":false,"weekdays":[0,1,2,3,4,5,6],"start":"07:00","end":"22:00"}'::jsonb;

update public.screen_settings
set operating_hours = '{"enabled":false,"weekdays":[0,1,2,3,4,5,6],"start":"07:00","end":"22:00"}'::jsonb
where operating_hours is null;

alter table public.screen_settings
  drop constraint if exists screen_settings_operating_hours_object;

alter table public.screen_settings
  add constraint screen_settings_operating_hours_object
  check (jsonb_typeof(operating_hours) = 'object');
