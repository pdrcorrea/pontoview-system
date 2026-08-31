alter function public.get_player_manifest(uuid, text) rename to get_player_manifest_core;

revoke all on function public.get_player_manifest_core(uuid, text) from public, anon, authenticated;
grant execute on function public.get_player_manifest_core(uuid, text) to service_role;

create function public.get_player_manifest(p_screen_id uuid, p_token text)
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
  v_manifest := public.get_player_manifest_core(p_screen_id, p_token);

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
      updated_at = excluded.updated_at;
  end if;

  return v_manifest;
end;
$$;

revoke all on function public.get_player_manifest(uuid, text) from public;
grant execute on function public.get_player_manifest(uuid, text) to anon, authenticated, service_role;
