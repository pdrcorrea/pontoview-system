-- Preserve the last manually checked snapshot independently from live player updates.
alter table public.screen_status
  add column if not exists checked_at timestamptz,
  add column if not exists checked_connectivity text;

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
    checked_at,
    checked_connectivity,
    updated_at
  )
  select
    s.id,
    s.organization_id,
    p.last_seen,
    p.player_version,
    case when p.last_seen >= v_now - interval '120 seconds' then 'online' else 'offline' end,
    v_now,
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
    checked_at = excluded.checked_at,
    checked_connectivity = excluded.checked_connectivity,
    updated_at = excluded.updated_at;

  get diagnostics v_count = row_count;
  return jsonb_build_object('checkedAt', v_now, 'screens', v_count);
end;
$$;

revoke all on function public.refresh_screen_statuses() from public;
revoke execute on function public.refresh_screen_statuses() from anon;
grant execute on function public.refresh_screen_statuses() to authenticated;
