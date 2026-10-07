-- Allow organizations explicitly exempt from billing to pair new screens.
-- Keep pairing restricted to authenticated owner/admin users and valid activation codes.

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
  v_subscription_ok boolean;
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

  select exists (
    select 1
    from public.screen_subscriptions ss
    where ss.organization_id = v_org_id
      and (
        ss.billing_exempt
        or ss.status = 'active'
        or (ss.status = 'trial' and ss.trial_ends_at > now())
        or (ss.status = 'trial' and ss.provider_status in ('authorized','payment_approved'))
        or (
          ss.status = 'past_due'
          and coalesce(ss.grace_period_ends_at, ss.current_period_end + interval '5 days') > now()
        )
      )
  ) into v_subscription_ok;

  if not v_subscription_ok then
    raise exception 'SUBSCRIPTION_INACTIVE' using errcode = '42501';
  end if;

  select id into v_default_playlist_id
  from public.playlists
  where organization_id = v_org_id and is_default
  limit 1;

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

  insert into public.screen_settings (screen_id, organization_id)
  values (v_screen_id, v_org_id);

  insert into public.screen_status (screen_id, organization_id, connectivity)
  values (v_screen_id, v_org_id, 'online');

  insert into public.screen_events (organization_id, screen_id, event_type, payload)
  values (v_org_id, v_screen_id, 'paired', jsonb_build_object('pairedBy', v_user_id));

  update private.screen_activations
  set claimed_screen_id = v_screen_id,
      device_token = v_token,
      claimed_at = now()
  where id = v_activation.id;

  return jsonb_build_object('screenId', v_screen_id, 'name', v_name);
end;
$$;

revoke all on function public.claim_screen_activation(text, text) from public, anon;
grant execute on function public.claim_screen_activation(text, text) to authenticated;
