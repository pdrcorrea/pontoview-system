-- Central de Informacoes: mensagens, informacoes do local e proximos eventos.

alter table public.messages
  add column if not exists content_type text not null default 'message',
  add column if not exists event_at timestamptz;

alter table public.messages
  drop constraint if exists messages_content_type_check,
  add constraint messages_content_type_check
    check (content_type in ('message','local_info','event'));

comment on column public.messages.content_type is
  'Communication hub content type: message, local_info or event.';

comment on column public.messages.event_at is
  'Optional event date/time used by upcoming event content.';

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
    'isExclusive', m.is_exclusive,
    'contentType', m.content_type,
    'eventAt', m.event_at
  ) order by
    case m.content_type when 'message' then 1 when 'event' then 2 else 3 end,
    case m.priority when 'urgent' then 3 when 'important' then 2 else 1 end desc,
    coalesce(m.event_at, m.created_at) asc
  ), '[]'::jsonb)
  into v_messages
  from public.messages m
  join public.organizations o on o.id = m.organization_id
  where m.organization_id = v_screen.organization_id
    and m.is_active
    and (
      (m.content_type = 'event'
        and m.event_at is not null
        and m.event_at >= now() - interval '2 hours'
        and m.event_at <= now() + interval '30 days')
      or
      (m.content_type <> 'event'
        and (m.starts_at is null or m.starts_at <= now())
        and (m.ends_at is null or m.ends_at > now())
        and extract(dow from (now() at time zone o.timezone))::smallint = any(m.weekdays)
        and (
          (m.start_time <= m.end_time and (now() at time zone o.timezone)::time between m.start_time and m.end_time)
          or (m.start_time > m.end_time and ((now() at time zone o.timezone)::time >= m.start_time or (now() at time zone o.timezone)::time <= m.end_time))
        )
      )
    )
    and (
      not exists (select 1 from public.message_screens ms0 where ms0.message_id = m.id)
      or exists (select 1 from public.message_screens ms where ms.message_id = m.id and ms.screen_id = p_screen_id)
    );

  return v_messages;
end;
$$;

revoke execute on function public.get_player_messages(uuid, text) from public, anon, authenticated;
grant execute on function public.get_player_messages(uuid, text) to service_role;
