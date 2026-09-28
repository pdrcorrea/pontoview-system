-- Keep lightweight player state detection aligned with Central de Informacoes.

do $$
declare
  v_definition text;
  v_updated text;
begin
  v_definition := pg_get_functiondef('public.get_player_state(uuid,text)'::regprocedure);
  v_updated := replace(
    v_definition,
    '      m.style_variant,' || chr(10) || '      m.is_exclusive',
    '      m.style_variant,' || chr(10) || '      m.is_exclusive,' || chr(10) || '      m.content_type,' || chr(10) || '      m.event_at'
  );

  v_updated := replace(
    v_updated,
    '    and (m.starts_at is null or m.starts_at <= now())' || chr(10) ||
    '    and (m.ends_at is null or m.ends_at > now())' || chr(10) ||
    '    and extract(dow from (now() at time zone o.timezone))::smallint = any(m.weekdays)' || chr(10) ||
    '    and (' || chr(10) ||
    '      (m.start_time <= m.end_time and (now() at time zone o.timezone)::time between m.start_time and m.end_time)' || chr(10) ||
    '      or' || chr(10) ||
    '      (m.start_time > m.end_time and (' || chr(10) ||
    '        (now() at time zone o.timezone)::time >= m.start_time' || chr(10) ||
    '        or (now() at time zone o.timezone)::time <= m.end_time' || chr(10) ||
    '      ))' || chr(10) ||
    '    )',
    '    and (' || chr(10) ||
    '      (m.content_type = ''event''' || chr(10) ||
    '        and m.event_at is not null' || chr(10) ||
    '        and m.event_at >= now() - interval ''2 hours''' || chr(10) ||
    '        and m.event_at <= now() + interval ''30 days'')' || chr(10) ||
    '      or' || chr(10) ||
    '      (m.content_type <> ''event''' || chr(10) ||
    '        and (m.starts_at is null or m.starts_at <= now())' || chr(10) ||
    '        and (m.ends_at is null or m.ends_at > now())' || chr(10) ||
    '        and extract(dow from (now() at time zone o.timezone))::smallint = any(m.weekdays)' || chr(10) ||
    '        and (' || chr(10) ||
    '          (m.start_time <= m.end_time and (now() at time zone o.timezone)::time between m.start_time and m.end_time)' || chr(10) ||
    '          or (m.start_time > m.end_time and ((now() at time zone o.timezone)::time >= m.start_time or (now() at time zone o.timezone)::time <= m.end_time))' || chr(10) ||
    '        )' || chr(10) ||
    '      )' || chr(10) ||
    '    )'
  );

  if v_updated = v_definition then
    raise exception 'get_player_state patch did not change definition';
  end if;

  execute v_updated;
end
$$;

revoke all on function public.get_player_state(uuid, text) from public;
grant execute on function public.get_player_state(uuid, text) to anon, authenticated, service_role;
