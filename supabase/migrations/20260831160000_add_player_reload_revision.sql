alter table public.screens
  add column if not exists reload_revision bigint not null default 0;

create or replace function public.request_player_reload(p_screen_id uuid)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_revision bigint;
begin
  update public.screens
  set reload_revision = reload_revision + 1
  where id = p_screen_id
    and is_active
  returning reload_revision into v_revision;

  if v_revision is null then
    raise exception 'SCREEN_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  return v_revision;
end;
$$;

grant execute on function public.request_player_reload(uuid) to authenticated;

do $$
declare
  v_definition text;
  v_updated text;
begin
  v_definition := pg_get_functiondef('public.get_player_manifest_core(uuid,text)'::regprocedure);
  v_updated := replace(
    v_definition,
    '''revision'', v_screen.settings_revision)',
    '''revision'', v_screen.settings_revision, ''reloadRevision'', v_screen.reload_revision)'
  );

  if v_updated = v_definition then
    raise exception 'Could not patch get_player_manifest_core screen payload';
  end if;

  execute v_updated;
end;
$$;
