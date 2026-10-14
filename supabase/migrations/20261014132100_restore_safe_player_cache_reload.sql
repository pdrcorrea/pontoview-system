create or replace function public.request_player_reload(p_screen_id uuid)
returns bigint
language plpgsql
set search_path to ''
as $function$
declare
  v_revision bigint;
begin
  update public.screens
  set reload_revision = reload_revision + 1,
      settings_revision = settings_revision + 1,
      updated_at = now()
  where id = p_screen_id
    and is_active
  returning reload_revision into v_revision;

  if v_revision is null then
    raise exception 'SCREEN_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  return v_revision;
end;
$function$;
