alter table public.messages
  add column if not exists display_location text not null default 'footer';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_display_location_check'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_display_location_check
      check (display_location in ('footer', 'sidebar'));
  end if;
end $$;

comment on column public.messages.display_location is
  'Defines whether an active message is shown in the footer bar or in the side highlight area.';

create or replace function public.get_player_messages(p_screen_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_screen public.screens%rowtype;
  v_timezone text;
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

  select o.timezone into v_timezone
  from public.organizations o
  where o.id = v_screen.organization_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'title', m.title,
        'body', m.body,
        'displayLocation', m.display_location
      )
      order by m.created_at desc
    ),
    '[]'::jsonb
  )
  into v_messages
  from public.messages m
  where m.organization_id = v_screen.organization_id
    and m.is_active
    and (m.starts_at is null or m.starts_at <= now())
    and (m.ends_at is null or m.ends_at > now())
    and extract(dow from (now() at time zone v_timezone))::smallint = any(m.weekdays)
    and (
      (m.start_time <= m.end_time
        and (now() at time zone v_timezone)::time between m.start_time and m.end_time)
      or
      (m.start_time > m.end_time
        and (
          (now() at time zone v_timezone)::time >= m.start_time
          or (now() at time zone v_timezone)::time <= m.end_time
        ))
    )
    and (
      not exists (
        select 1
        from public.message_screens ms0
        where ms0.message_id = m.id
      )
      or exists (
        select 1
        from public.message_screens ms
        where ms.message_id = m.id
          and ms.screen_id = p_screen_id
      )
    );

  return v_messages;
end;
$$;

revoke all on function public.get_player_messages(uuid, text) from public;
grant execute on function public.get_player_messages(uuid, text) to anon, authenticated;
