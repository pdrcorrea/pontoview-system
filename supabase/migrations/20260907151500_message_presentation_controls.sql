alter table public.messages
  add column if not exists priority text not null default 'normal',
  add column if not exists duration_mode text not null default 'auto',
  add column if not exists duration_seconds integer,
  add column if not exists style_variant text not null default 'standard',
  add column if not exists is_exclusive boolean not null default false;

alter table public.messages
  drop constraint if exists messages_priority_check,
  add constraint messages_priority_check check (priority in ('normal','important','urgent')),
  drop constraint if exists messages_duration_mode_check,
  add constraint messages_duration_mode_check check (duration_mode in ('auto','manual')),
  drop constraint if exists messages_duration_seconds_check,
  add constraint messages_duration_seconds_check check (duration_seconds is null or duration_seconds between 5 and 120),
  drop constraint if exists messages_style_variant_check,
  add constraint messages_style_variant_check check (style_variant in ('standard','attention','info','success'));

create or replace function public.get_player_messages(p_screen_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_screen public.screens%rowtype;
  v_messages jsonb;
begin
  if not (select private.valid_screen_token(p_screen_id, p_token)) then
    raise exception 'INVALID_DEVICE_TOKEN' using errcode = '42501';
  end if;

  select * into v_screen
  from public.screens
  where id = p_screen_id and is_active;

  if not found then
    raise exception 'SCREEN_NOT_FOUND' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'title', m.title,
    'body', m.body,
    'displayLocation', m.display_location,
    'priority', m.priority,
    'durationMode', m.duration_mode,
    'durationSeconds', m.duration_seconds,
    'styleVariant', m.style_variant,
    'isExclusive', m.is_exclusive
  ) order by
    case m.priority when 'urgent' then 3 when 'important' then 2 else 1 end desc,
    m.created_at desc
  ), '[]'::jsonb)
  into v_messages
  from public.messages m
  join public.organizations o on o.id = m.organization_id
  where m.organization_id = v_screen.organization_id
    and m.is_active
    and (m.starts_at is null or m.starts_at <= now())
    and (m.ends_at is null or m.ends_at > now())
    and extract(dow from (now() at time zone o.timezone))::smallint = any(m.weekdays)
    and (
      (m.start_time <= m.end_time and (now() at time zone o.timezone)::time between m.start_time and m.end_time)
      or (m.start_time > m.end_time and ((now() at time zone o.timezone)::time >= m.start_time or (now() at time zone o.timezone)::time <= m.end_time))
    )
    and (
      not exists (select 1 from public.message_screens ms0 where ms0.message_id = m.id)
      or exists (select 1 from public.message_screens ms where ms.message_id = m.id and ms.screen_id = p_screen_id)
    );

  return v_messages;
end;
$$;

revoke all on function public.get_player_messages(uuid, text) from public;
grant execute on function public.get_player_messages(uuid, text) to anon, authenticated;
