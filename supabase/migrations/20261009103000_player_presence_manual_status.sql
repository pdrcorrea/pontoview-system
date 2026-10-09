create table if not exists private.screen_presence (
  screen_id uuid primary key references public.screens(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  last_seen timestamptz not null default now(),
  player_version text,
  updated_at timestamptz not null default now()
);

create index if not exists screen_presence_org_idx
  on private.screen_presence(organization_id, last_seen desc);

create or replace function public.get_player_state_v2(
  p_screen_id uuid,
  p_token text,
  p_player_version text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state jsonb;
  v_org_id uuid;
  v_now timestamptz := now();
begin
  v_state := public.get_player_state(p_screen_id, p_token);

  select organization_id
    into v_org_id
  from public.screens
  where id = p_screen_id
    and is_active;

  insert into private.screen_presence (
    screen_id, organization_id, last_seen, player_version, updated_at
  ) values (
    p_screen_id, v_org_id, v_now, left(p_player_version, 40), v_now
  )
  on conflict (screen_id) do update set
    organization_id = excluded.organization_id,
    last_seen = excluded.last_seen,
    player_version = coalesce(excluded.player_version, private.screen_presence.player_version),
    updated_at = excluded.updated_at;

  return v_state || jsonb_build_object('presenceAt', v_now);
end;
$$;

revoke all on function public.get_player_state_v2(uuid, text, text) from public;
grant execute on function public.get_player_state_v2(uuid, text, text) to anon, authenticated;

create or replace function public.refresh_screen_statuses()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  insert into public.screen_status (
    screen_id,
    organization_id,
    last_seen,
    player_version,
    connectivity,
    updated_at
  )
  select
    s.id,
    s.organization_id,
    p.last_seen,
    p.player_version,
    case when p.last_seen >= v_now - interval '120 seconds' then 'online' else 'offline' end,
    v_now
  from public.screens s
  join public.organizations o on o.id = s.organization_id
  left join private.screen_presence p on p.screen_id = s.id
  where s.is_active
    and o.created_by = v_user_id
  on conflict (screen_id) do update set
    last_seen = excluded.last_seen,
    player_version = coalesce(excluded.player_version, public.screen_status.player_version),
    connectivity = excluded.connectivity,
    updated_at = excluded.updated_at;

  get diagnostics v_count = row_count;
  return jsonb_build_object('checkedAt', v_now, 'screens', v_count);
end;
$$;

revoke all on function public.refresh_screen_statuses() from public;
revoke execute on function public.refresh_screen_statuses() from anon;
grant execute on function public.refresh_screen_statuses() to authenticated;
