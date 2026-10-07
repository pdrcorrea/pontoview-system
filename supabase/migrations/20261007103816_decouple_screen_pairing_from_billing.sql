-- Keep the physical screen identity independent from billing entitlement.
-- Expiring a trial/subscription may pause playback, but it must never invalidate
-- the device token or force the Player back into the pairing flow.

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

create or replace function private.screen_subscription_allows_playback(p_screen_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.screens s
    join public.screen_subscriptions ss on ss.organization_id = s.organization_id
    where s.id = p_screen_id
      and s.is_active
      and (
        ss.status = 'active'
        or (ss.status = 'trial' and ss.trial_ends_at > now())
        or (ss.status = 'trial' and ss.provider_status in ('authorized','payment_approved'))
        or (ss.status = 'past_due' and ss.grace_period_ends_at > now())
      )
  );
$$;
revoke all on function private.screen_subscription_allows_playback(uuid) from public, anon, authenticated;

create or replace function public.get_player_manifest(p_screen_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manifest jsonb;
  v_org_id uuid;
  v_now timestamptz := now();
begin
  if not (select private.valid_screen_token(p_screen_id, p_token)) then
    raise exception 'INVALID_DEVICE_TOKEN' using errcode = '42501';
  end if;

  if not (select private.screen_subscription_allows_playback(p_screen_id)) then
    raise exception 'SUBSCRIPTION_INACTIVE' using errcode = '42501';
  end if;

  v_manifest := public.get_player_manifest_core(p_screen_id, p_token);

  v_manifest := jsonb_set(
    v_manifest,
    '{messages}',
    public.get_player_messages(p_screen_id, p_token),
    true
  );

  select organization_id
    into v_org_id
  from public.screens
  where id = p_screen_id
    and is_active;

  if v_org_id is not null then
    insert into public.screen_status (
      screen_id,
      organization_id,
      last_seen,
      connectivity,
      updated_at
    ) values (
      p_screen_id,
      v_org_id,
      v_now,
      'online',
      v_now
    )
    on conflict (screen_id) do update set
      last_seen = excluded.last_seen,
      connectivity = 'online',
      updated_at = excluded.updated_at
    where public.screen_status.last_seen is null
       or public.screen_status.last_seen < excluded.last_seen - interval '45 seconds';
  end if;

  return v_manifest;
end;
$$;
revoke all on function public.get_player_manifest(uuid, text) from public;
grant execute on function public.get_player_manifest(uuid, text) to anon, authenticated, service_role;
