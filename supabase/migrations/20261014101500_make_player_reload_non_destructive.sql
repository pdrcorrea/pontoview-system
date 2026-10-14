create or replace function public.request_player_reload(p_screen_id uuid)
returns bigint
language plpgsql
set search_path to ''
as $function$
declare
  v_revision bigint;
begin
  -- A remote reload must never force a destructive browser/WebView navigation.
  -- Bumping settings_revision changes get_player_state.stateKey, so the player
  -- performs a fresh manifest sync while preserving its device token, runtime,
  -- native bridge and local pairing state.
  update public.screens
  set settings_revision = settings_revision + 1,
      updated_at = now()
  where id = p_screen_id
    and is_active
  returning settings_revision into v_revision;

  if v_revision is null then
    raise exception 'SCREEN_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  return v_revision;
end;
$function$;
