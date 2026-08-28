-- Output column names are PL/pgSQL variables. Qualifying the table column
-- avoids ambiguity when expired activation rows are cleaned up.

create or replace function public.create_screen_activation()
returns table (activation_id uuid, activation_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_code text;
  v_expires_at timestamptz;
  v_attempt integer := 0;
begin
  delete from private.screen_activations activation
  where activation.expires_at < now() - interval '1 hour';

  loop
    v_attempt := v_attempt + 1;
    v_code := lpad((floor(random() * 1000000)::integer)::text, 6, '0');
    begin
      insert into private.screen_activations (code)
      values (v_code)
      returning id, private.screen_activations.expires_at into v_id, v_expires_at;
      exit;
    exception when unique_violation then
      if v_attempt >= 10 then
        raise exception 'ACTIVATION_CODE_UNAVAILABLE';
      end if;
    end;
  end loop;

  return query select v_id, v_code, v_expires_at;
end;
$$;

revoke all on function public.create_screen_activation() from public, anon, authenticated;
grant execute on function public.create_screen_activation() to anon, authenticated;
