-- Player sync hardening: lightweight state/context RPCs.
-- Applied to production on 2026-09-27 and kept here for schema history.

create or replace function public.get_player_state(p_screen_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_screen public.screens%rowtype;
  v_playlist_id uuid;
  v_playlist_revision bigint;
  v_playlist_updated_at timestamptz;
  v_settings_updated_at timestamptz;
  v_org_updated_at timestamptz;
  v_items_key text;
  v_messages_key text;
  v_state_key text;
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

  select sch.playlist_id into v_playlist_id
  from public.schedules sch
  join public.schedule_rules rule
    on rule.schedule_id = sch.id
   and rule.organization_id = sch.organization_id
  where sch.organization_id = v_screen.organization_id
    and sch.is_active
    and (sch.starts_at is null or sch.starts_at <= now())
    and (sch.ends_at is null or sch.ends_at > now())
    and extract(dow from (now() at time zone sch.timezone))::smallint = any(rule.weekdays)
    and (
      (rule.start_time <= rule.end_time and (now() at time zone sch.timezone)::time between rule.start_time and rule.end_time)
      or
      (rule.start_time > rule.end_time and (
        (now() at time zone sch.timezone)::time >= rule.start_time
        or (now() at time zone sch.timezone)::time <= rule.end_time
      ))
    )
    and (
      rule.screen_id = p_screen_id
      or exists (
        select 1 from public.screen_group_members gm
        where gm.group_id = rule.screen_group_id
          and gm.screen_id = p_screen_id
      )
    )
  order by
    case sch.priority when 'campaign' then 3 when 'timed' then 2 else 1 end desc,
    sch.starts_at desc nulls last,
    sch.created_at desc
  limit 1;

  v_playlist_id := coalesce(v_playlist_id, v_screen.default_playlist_id);

  select p.revision, p.updated_at
    into v_playlist_revision, v_playlist_updated_at
  from public.playlists p
  where p.id = v_playlist_id
    and p.organization_id = v_screen.organization_id;

  select ss.updated_at into v_settings_updated_at
  from public.screen_settings ss
  where ss.screen_id = p_screen_id;

  select o.updated_at into v_org_updated_at
  from public.organizations o
  where o.id = v_screen.organization_id;

  select md5(coalesce(jsonb_agg(
    jsonb_build_array(
      pi.id,
      pi.position,
      pi.duration_seconds,
      pi.settings,
      pi.updated_at,
      m.id,
      m.status,
      m.updated_at
    )
    order by pi.position
  )::text, '[]'))
  into v_items_key
  from public.playlist_items pi
  join public.media m
    on m.id = pi.media_id
   and m.organization_id = pi.organization_id
  where pi.playlist_id = v_playlist_id
    and pi.organization_id = v_screen.organization_id
    and m.status = 'ready';

  select md5(coalesce(jsonb_agg(
    jsonb_build_array(
      m.id,
      m.updated_at,
      m.display_location,
      m.priority,
      m.duration_mode,
      m.duration_seconds,
      m.style_variant,
      m.is_exclusive
    )
    order by m.id
  )::text, '[]'))
  into v_messages_key
  from public.messages m
  join public.organizations o on o.id = m.organization_id
  where m.organization_id = v_screen.organization_id
    and m.is_active
    and (m.starts_at is null or m.starts_at <= now())
    and (m.ends_at is null or m.ends_at > now())
    and extract(dow from (now() at time zone o.timezone))::smallint = any(m.weekdays)
    and (
      (m.start_time <= m.end_time and (now() at time zone o.timezone)::time between m.start_time and m.end_time)
      or
      (m.start_time > m.end_time and (
        (now() at time zone o.timezone)::time >= m.start_time
        or (now() at time zone o.timezone)::time <= m.end_time
      ))
    )
    and (
      not exists (select 1 from public.message_screens ms0 where ms0.message_id = m.id)
      or exists (
        select 1 from public.message_screens ms
        where ms.message_id = m.id
          and ms.screen_id = p_screen_id
      )
    );

  v_state_key := md5(concat_ws('|',
    v_screen.id::text,
    coalesce(v_screen.updated_at::text, ''),
    coalesce(v_screen.settings_revision::text, '0'),
    coalesce(v_screen.reload_revision::text, '0'),
    coalesce(v_settings_updated_at::text, ''),
    coalesce(v_org_updated_at::text, ''),
    coalesce(v_playlist_id::text, ''),
    coalesce(v_playlist_revision::text, '0'),
    coalesce(v_playlist_updated_at::text, ''),
    coalesce(v_items_key, ''),
    coalesce(v_messages_key, '')
  ));

  return jsonb_build_object(
    'stateKey', v_state_key,
    'reloadRevision', coalesce(v_screen.reload_revision, 0),
    'playlistId', v_playlist_id,
    'playlistRevision', coalesce(v_playlist_revision, 0),
    'settingsRevision', coalesce(v_screen.settings_revision, 0),
    'checkedAt', now()
  );
end;
$function$;

revoke all on function public.get_player_state(uuid, text) from public;
grant execute on function public.get_player_state(uuid, text) to anon, authenticated, service_role;

create or replace function public.get_player_context(p_screen_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_screen public.screens%rowtype;
  v_settings jsonb;
  v_org jsonb;
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

  select to_jsonb(ss) - 'organization_id' - 'screen_id'
    into v_settings
  from public.screen_settings ss
  where ss.screen_id = p_screen_id;

  select jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'displayName', o.display_name,
    'timezone', o.timezone,
    'locale', o.locale,
    'settings', o.settings
  )
  into v_org
  from public.organizations o
  where o.id = v_screen.organization_id;

  return jsonb_build_object(
    'screen', jsonb_build_object(
      'id', v_screen.id,
      'organizationId', v_screen.organization_id,
      'orientation', v_screen.orientation,
      'rotation', v_screen.rotation
    ),
    'organization', coalesce(v_org, '{}'::jsonb),
    'settings', coalesce(v_settings, '{}'::jsonb)
  );
end;
$function$;

revoke all on function public.get_player_context(uuid, text) from public;
grant execute on function public.get_player_context(uuid, text) to anon, authenticated, service_role;
