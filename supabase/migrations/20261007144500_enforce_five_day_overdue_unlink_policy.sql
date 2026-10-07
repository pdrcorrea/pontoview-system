create or replace function private.set_screen_subscription_grace_window()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.billing_exempt then
    new.grace_period_ends_at := null;
    return new;
  end if;

  if new.status = 'past_due' and (tg_op = 'INSERT' or old.status is distinct from 'past_due') then
    new.grace_period_ends_at := now() + interval '5 days';
  elsif new.status in ('active', 'trial') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.grace_period_ends_at := null;
  end if;

  return new;
end;
$$;

revoke all on function private.set_screen_subscription_grace_window() from public, anon, authenticated;

drop trigger if exists screen_subscription_grace_window on public.screen_subscriptions;
create trigger screen_subscription_grace_window
before insert or update of status, billing_exempt on public.screen_subscriptions
for each row execute function private.set_screen_subscription_grace_window();

create or replace function private.detach_overdue_screens()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  with overdue as (
    select ss.id as subscription_id, ss.organization_id
    from public.screen_subscriptions ss
    where not ss.billing_exempt
      and ss.status = 'past_due'
      and coalesce(
        ss.grace_period_ends_at,
        ss.current_period_end + interval '5 days'
      ) <= now()
  ), detached as (
    update public.screens s
       set is_active = false,
           device_token_hash = null,
           updated_at = now()
      from overdue o
     where s.organization_id = o.organization_id
       and s.is_active
    returning s.id
  )
  select count(*) into v_count from detached;

  update public.screen_subscriptions ss
     set status = 'suspended',
         updated_at = now()
   where not ss.billing_exempt
     and ss.status = 'past_due'
     and coalesce(
       ss.grace_period_ends_at,
       ss.current_period_end + interval '5 days'
     ) <= now();

  return v_count;
end;
$$;

revoke all on function private.detach_overdue_screens() from public, anon, authenticated;

select cron.schedule(
  'pontoview-overdue-screen-unlink',
  '17 * * * *',
  $$select private.detach_overdue_screens();$$
);
