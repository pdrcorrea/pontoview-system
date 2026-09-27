-- Consolidate message presentation data into the canonical player manifest
-- and disable the obsolete direct messages RPC for public clients.

create or replace function public.get_player_manifest(p_screen_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_manifest jsonb;
  v_org_id uuid;
  v_now timestamptz := now();
begin
  v_manifest := public.get_player_manifest_core(p_screen_id, p_token);
  v_manifest := jsonb_set(v_manifest, '{messages}', public.get_player_messages(p_screen_id, p_token), true);

  select organization_id into v_org_id
  from public.screens
  where id = p_screen_id and is_active;

  if v_org_id is not null then
    insert into public.screen_status (screen_id, organization_id, last_seen, connectivity, updated_at)
    values (p_screen_id, v_org_id, v_now, 'online', v_now)
    on conflict (screen_id) do update set
      last_seen = excluded.last_seen,
      connectivity = 'online',
      updated_at = excluded.updated_at
    where public.screen_status.last_seen is null
       or public.screen_status.last_seen < excluded.last_seen - interval '45 seconds';
  end if;

  return v_manifest;
end;
$function$;

revoke execute on function public.get_player_messages(uuid, text) from public, anon, authenticated;
grant execute on function public.get_player_messages(uuid, text) to service_role;
