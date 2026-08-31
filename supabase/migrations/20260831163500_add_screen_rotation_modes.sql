alter table public.screens
  add column if not exists rotation text not null default 'standard';

alter table public.screens
  drop constraint if exists screens_rotation_check;

alter table public.screens
  add constraint screens_rotation_check
  check (rotation in ('standard','right','left','180'));

do $$
declare
  v_definition text;
  v_updated text;
begin
  v_definition := pg_get_functiondef('public.get_player_manifest_core(uuid,text)'::regprocedure);
  v_updated := replace(
    v_definition,
    '''orientation'', v_screen.orientation, ''revision''',
    '''orientation'', v_screen.orientation, ''rotation'', v_screen.rotation, ''revision'''
  );
  if v_updated = v_definition then
    raise exception 'Could not patch get_player_manifest_core rotation payload';
  end if;
  execute v_updated;
end;
$$;
