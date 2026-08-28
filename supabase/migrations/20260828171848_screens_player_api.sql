-- Public RPC surface for activation, pairing, Player sync and telemetry.
-- Raw device tokens are never stored on public tables or returned to admins.

create or replace function private.valid_screen_token(p_screen_id uuid, p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_token is not null and exists (
    select 1
    from public.screens s
    where s.id = p_screen_id
      and s.is_active
      and s.device_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  );
$$;
revoke all on function private.valid_screen_token(uuid, text) from public, anon, authenticated;

create or replace function public.create_screen_activation()
returns table (activation_id uuid, activation_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_code text;
  v_expires_at timestamptz;
  v_attempt integer := 0;
begin
  delete from private.screen_activations activation
  where activation.expires_at < now() - interval '1 hour';
  loop
    v_attempt := v_attempt + 1;
    v_code := lpad((floor(random() * 1000000)::integer)::text, 6, '0');
    begin
      insert into private.screen_activations (code)
      values (v_code)
      returning id, private.screen_activations.expires_at into v_id, v_expires_at;
      exit;
    exception when unique_violation then
      if v_attempt >= 10 then raise exception 'ACTIVATION_CODE_UNAVAILABLE'; end if;
    end;
  end loop;
  return query select v_id, v_code, v_expires_at;
end;
$$;
revoke all on function public.create_screen_activation() from public;
grant execute on function public.create_screen_activation() to anon, authenticated;

create or replace function public.check_screen_activation(p_activation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.screen_activations%rowtype;
  v_result jsonb;
begin
  select * into v_row
  from private.screen_activations
  where id = p_activation_id;
  if not found or v_row.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  if v_row.claimed_screen_id is null then
    return jsonb_build_object('status', 'pending', 'expiresAt', v_row.expires_at);
  end if;
  if v_row.delivered_at is not null then
    return jsonb_build_object('status', 'delivered', 'screenId', v_row.claimed_screen_id);
  end if;
  v_result := jsonb_build_object(
    'status', 'claimed',
    'screenId', v_row.claimed_screen_id,
    'deviceToken', v_row.device_token
  );
  update private.screen_activations
  set delivered_at = now(), device_token = null
  where id = p_activation_id;
  return v_result;
end;
$$;
revoke all on function public.check_screen_activation(uuid) from public;
grant execute on function public.check_screen_activation(uuid) to anon, authenticated;

create or replace function public.claim_screen_activation(p_code text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_org_id uuid;
  v_activation private.screen_activations%rowtype;
  v_screen_id uuid;
  v_default_playlist_id uuid;
  v_token text;
  v_slug text;
  v_screen_limit integer;
  v_screen_count integer;
  v_name text := nullif(trim(p_name), '');
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if p_code is null or p_code !~ '^[0-9]{6}$' then raise exception 'INVALID_CODE' using errcode = '22023'; end if;
  if v_name is null or char_length(v_name) > 120 then raise exception 'INVALID_SCREEN_NAME' using errcode = '22023'; end if;

  select ou.organization_id into v_org_id
  from public.organization_users ou
  where ou.user_id = v_user_id and ou.role in ('owner','admin')
  order by ou.created_at limit 1;
  if v_org_id is null then raise exception 'PAIR_PERMISSION_DENIED' using errcode = '42501'; end if;

  select a.* into v_activation
  from private.screen_activations a
  where a.code = p_code and a.expires_at > now() and a.claimed_screen_id is null
  for update;
  if not found then raise exception 'CODE_NOT_FOUND_OR_EXPIRED' using errcode = 'P0002'; end if;

  select p.screen_limit into v_screen_limit
  from public.screen_subscriptions ss
  join public.plans p on p.id = ss.plan_id
  where ss.organization_id = v_org_id
    and (
      ss.status in ('trial','active')
      or (ss.status = 'past_due' and ss.grace_period_ends_at > now())
    );
  if v_screen_limit is null then raise exception 'SUBSCRIPTION_INACTIVE' using errcode = '42501'; end if;
  select count(*)::integer into v_screen_count from public.screens where organization_id = v_org_id and is_active;
  if v_screen_count >= v_screen_limit then raise exception 'SCREEN_LIMIT_REACHED' using errcode = '23514'; end if;

  select id into v_default_playlist_id
  from public.playlists where organization_id = v_org_id and is_default limit 1;
  v_screen_id := gen_random_uuid();
  v_slug := trim(both '-' from regexp_replace(lower(extensions.unaccent(v_name)), '[^a-z0-9]+', '-', 'g'));
  v_slug := coalesce(nullif(v_slug, ''), 'tela') || '-' || left(replace(v_screen_id::text, '-', ''), 6);
  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.screens (
    id, organization_id, name, slug, default_playlist_id, device_token_hash, paired_at, paired_by
  ) values (
    v_screen_id, v_org_id, v_name, v_slug, v_default_playlist_id,
    encode(extensions.digest(v_token, 'sha256'), 'hex'), now(), v_user_id
  );
  insert into public.screen_settings (screen_id, organization_id) values (v_screen_id, v_org_id);
  insert into public.screen_status (screen_id, organization_id, connectivity) values (v_screen_id, v_org_id, 'online');
  insert into public.screen_events (organization_id, screen_id, event_type, payload)
  values (v_org_id, v_screen_id, 'paired', jsonb_build_object('pairedBy', v_user_id));
  update private.screen_activations
  set claimed_screen_id = v_screen_id, device_token = v_token, claimed_at = now()
  where id = v_activation.id;
  return jsonb_build_object('screenId', v_screen_id, 'name', v_name);
end;
$$;
revoke all on function public.claim_screen_activation(text, text) from public;
grant execute on function public.claim_screen_activation(text, text) to authenticated;

create or replace function public.get_player_manifest(p_screen_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_screen public.screens%rowtype;
  v_settings jsonb;
  v_org jsonb;
  v_playlist_id uuid;
  v_playlist jsonb;
  v_items jsonb;
  v_messages jsonb;
  v_news jsonb;
begin
  if not (select private.valid_screen_token(p_screen_id, p_token)) then
    raise exception 'INVALID_DEVICE_TOKEN' using errcode = '42501';
  end if;
  select * into v_screen from public.screens where id = p_screen_id and is_active;

  select sch.playlist_id into v_playlist_id
  from public.schedules sch
  join public.schedule_rules rule on rule.schedule_id = sch.id and rule.organization_id = sch.organization_id
  where sch.organization_id = v_screen.organization_id
    and sch.is_active
    and (sch.starts_at is null or sch.starts_at <= now())
    and (sch.ends_at is null or sch.ends_at > now())
    and extract(dow from (now() at time zone sch.timezone))::smallint = any(rule.weekdays)
    and (
      (rule.start_time <= rule.end_time and (now() at time zone sch.timezone)::time between rule.start_time and rule.end_time)
      or (rule.start_time > rule.end_time and ((now() at time zone sch.timezone)::time >= rule.start_time or (now() at time zone sch.timezone)::time <= rule.end_time))
    )
    and (
      rule.screen_id = p_screen_id
      or exists (
        select 1 from public.screen_group_members gm
        where gm.group_id = rule.screen_group_id and gm.screen_id = p_screen_id
      )
    )
  order by case sch.priority when 'campaign' then 3 when 'timed' then 2 else 1 end desc,
           sch.starts_at desc nulls last, sch.created_at desc
  limit 1;
  v_playlist_id := coalesce(v_playlist_id, v_screen.default_playlist_id);

  select jsonb_build_object('id', p.id, 'name', p.name, 'revision', p.revision, 'updatedAt', p.updated_at)
  into v_playlist from public.playlists p
  where p.id = v_playlist_id and p.organization_id = v_screen.organization_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'itemId', pi.id,
    'position', pi.position,
    'durationSeconds', coalesce(pi.duration_seconds, m.duration_seconds),
    'itemSettings', pi.settings,
    'media', jsonb_build_object(
      'id', m.id, 'type', m.type, 'status', m.status, 'name', m.name,
      'durationSeconds', m.duration_seconds, 'onlineRequired', m.online_required,
      'thumbnailUrl', m.thumbnail_url, 'driveFileId', m.drive_file_id,
      'driveMimeType', m.drive_mime_type, 'driveModifiedTime', m.drive_modified_time,
      'driveChecksum', m.drive_checksum, 'youtubeVideoId', m.youtube_video_id,
      'youtubeOptions', m.youtube_options, 'pageUrl', m.page_url,
      'appKey', m.app_key, 'messageContent', m.message_content, 'metadata', m.metadata
    )
  ) order by pi.position), '[]'::jsonb)
  into v_items
  from public.playlist_items pi
  join public.media m on m.id = pi.media_id and m.organization_id = pi.organization_id
  where pi.playlist_id = v_playlist_id and pi.organization_id = v_screen.organization_id and m.status = 'ready';

  select to_jsonb(ss) - 'organization_id' - 'screen_id' into v_settings
  from public.screen_settings ss where ss.screen_id = p_screen_id;
  select jsonb_build_object('id', o.id, 'name', o.name, 'displayName', o.display_name, 'timezone', o.timezone, 'locale', o.locale, 'settings', o.settings)
  into v_org from public.organizations o where o.id = v_screen.organization_id;

  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'body', m.body) order by m.created_at desc), '[]'::jsonb)
  into v_messages
  from public.messages m
  join public.organizations o on o.id = m.organization_id
  where m.organization_id = v_screen.organization_id and m.is_active
    and (m.starts_at is null or m.starts_at <= now()) and (m.ends_at is null or m.ends_at > now())
    and extract(dow from (now() at time zone o.timezone))::smallint = any(m.weekdays)
    and (
      (m.start_time <= m.end_time and (now() at time zone o.timezone)::time between m.start_time and m.end_time)
      or (m.start_time > m.end_time and ((now() at time zone o.timezone)::time >= m.start_time or (now() at time zone o.timezone)::time <= m.end_time))
    )
    and (
      not exists (select 1 from public.message_screens ms0 where ms0.message_id = m.id)
      or exists (select 1 from public.message_screens ms where ms.message_id = m.id and ms.screen_id = p_screen_id)
    );

  select coalesce(jsonb_agg(to_jsonb(n) - 'fetched_at' - 'expires_at' order by n.published_at desc), '[]'::jsonb)
  into v_news from (
    select nc.* from public.news_cache nc
    where nc.expires_at > now()
      and nc.category = any(coalesce((select news_categories from public.screen_settings where screen_id = p_screen_id), array['general']::text[]))
    order by nc.published_at desc limit 12
  ) n;

  return jsonb_build_object(
    'screen', jsonb_build_object('id', v_screen.id, 'name', v_screen.name, 'orientation', v_screen.orientation, 'revision', v_screen.settings_revision),
    'organization', v_org,
    'settings', coalesce(v_settings, '{}'::jsonb),
    'playlist', v_playlist,
    'items', coalesce(v_items, '[]'::jsonb),
    'messages', coalesce(v_messages, '[]'::jsonb),
    'news', coalesce(v_news, '[]'::jsonb),
    'syncedAt', now()
  );
end;
$$;
revoke all on function public.get_player_manifest(uuid, text) from public;
grant execute on function public.get_player_manifest(uuid, text) to anon, authenticated;

create or replace function public.player_heartbeat(
  p_screen_id uuid,
  p_token text,
  p_media_id uuid default null,
  p_playlist_id uuid default null,
  p_player_version text default null,
  p_client_info jsonb default '{}'::jsonb
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_previous_seen timestamptz;
  v_now timestamptz := now();
begin
  if not (select private.valid_screen_token(p_screen_id, p_token)) then
    raise exception 'INVALID_DEVICE_TOKEN' using errcode = '42501';
  end if;
  select organization_id into v_org_id from public.screens where id = p_screen_id;
  select last_seen into v_previous_seen from public.screen_status where screen_id = p_screen_id;
  insert into public.screen_status (
    screen_id, organization_id, last_seen, current_media_id, current_playlist_id,
    player_version, connectivity, client_info, updated_at
  ) values (
    p_screen_id, v_org_id, v_now, p_media_id, p_playlist_id,
    left(p_player_version, 40), 'online', coalesce(p_client_info, '{}'::jsonb), v_now
  )
  on conflict (screen_id) do update set
    last_seen = excluded.last_seen,
    current_media_id = excluded.current_media_id,
    current_playlist_id = excluded.current_playlist_id,
    player_version = excluded.player_version,
    connectivity = 'online',
    client_info = excluded.client_info,
    updated_at = excluded.updated_at;
  if v_previous_seen is null or v_previous_seen < v_now - interval '2 minutes' then
    insert into public.screen_events (organization_id, screen_id, event_type, media_id, playlist_id)
    values (v_org_id, p_screen_id, 'player_online', p_media_id, p_playlist_id);
  end if;
  return v_now;
end;
$$;
revoke all on function public.player_heartbeat(uuid, text, uuid, uuid, text, jsonb) from public;
grant execute on function public.player_heartbeat(uuid, text, uuid, uuid, text, jsonb) to anon, authenticated;

create or replace function public.player_event(
  p_screen_id uuid,
  p_token text,
  p_event_type text,
  p_media_id uuid default null,
  p_playlist_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_org_id uuid; v_id bigint;
begin
  if not (select private.valid_screen_token(p_screen_id, p_token)) then
    raise exception 'INVALID_DEVICE_TOKEN' using errcode = '42501';
  end if;
  if p_event_type not in ('content_started','content_ended','media_error','sync','player_offline') then
    raise exception 'INVALID_EVENT_TYPE' using errcode = '22023';
  end if;
  if pg_column_size(coalesce(p_payload, '{}'::jsonb)) > 16384 then
    raise exception 'EVENT_PAYLOAD_TOO_LARGE' using errcode = '22023';
  end if;
  select organization_id into v_org_id from public.screens where id = p_screen_id;
  insert into public.screen_events (organization_id, screen_id, event_type, media_id, playlist_id, payload)
  values (v_org_id, p_screen_id, p_event_type, p_media_id, p_playlist_id, coalesce(p_payload, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.player_event(uuid, text, text, uuid, uuid, jsonb) from public;
grant execute on function public.player_event(uuid, text, text, uuid, uuid, jsonb) to anon, authenticated;

create or replace function public.get_screen_dashboard(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if not (select private.has_org_role(p_organization_id)) then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'screensTotal', (select count(*) from public.screens where organization_id = p_organization_id and is_active),
    'screensOnline', (select count(*) from public.screen_status where organization_id = p_organization_id and last_seen > now() - interval '90 seconds'),
    'media', (select count(*) from public.media where organization_id = p_organization_id and status <> 'archived'),
    'playlists', (select count(*) from public.playlists where organization_id = p_organization_id),
    'activeSchedules', (select count(*) from public.schedules where organization_id = p_organization_id and is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())),
    'recentEvents', coalesce((select jsonb_agg(e order by e.occurred_at desc) from (select id, screen_id, event_type, payload, occurred_at from public.screen_events where organization_id = p_organization_id order by occurred_at desc limit 12) e), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.get_screen_dashboard(uuid) from public;
grant execute on function public.get_screen_dashboard(uuid) to authenticated;

create or replace function public.replace_playlist_items(p_playlist_id uuid, p_items jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_org_id uuid; v_revision bigint;
begin
  select organization_id into v_org_id from public.playlists where id = p_playlist_id for update;
  if v_org_id is null or not (select private.has_org_role(v_org_id, array['owner','admin','editor']::public.organization_role[])) then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 500 then
    raise exception 'INVALID_PLAYLIST_ITEMS' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) item
    left join public.media m on m.id = (item->>'mediaId')::uuid and m.organization_id = v_org_id and m.status <> 'archived'
    where m.id is null
  ) then raise exception 'INVALID_MEDIA_REFERENCE' using errcode = '23503'; end if;

  delete from public.playlist_items where playlist_id = p_playlist_id;
  insert into public.playlist_items (organization_id, playlist_id, media_id, position, duration_seconds, settings)
  select v_org_id, p_playlist_id, (item->>'mediaId')::uuid, ordinality::integer - 1,
         nullif(item->>'durationSeconds','')::integer, coalesce(item->'settings','{}'::jsonb)
  from jsonb_array_elements(p_items) with ordinality as x(item, ordinality);
  update public.playlists set revision = revision + 1, updated_at = now() where id = p_playlist_id returning revision into v_revision;
  update public.screens set settings_revision = settings_revision + 1, updated_at = now()
  where organization_id = v_org_id and default_playlist_id = p_playlist_id;
  return v_revision;
end;
$$;
revoke all on function public.replace_playlist_items(uuid, jsonb) from public;
grant execute on function public.replace_playlist_items(uuid, jsonb) to authenticated;
