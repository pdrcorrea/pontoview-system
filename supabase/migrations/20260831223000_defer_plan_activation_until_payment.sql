alter table public.screen_subscriptions
  add column if not exists pending_plan_id uuid,
  add column if not exists pending_plan_requested_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'screen_subscriptions_pending_plan_id_fkey'
  ) then
    alter table public.screen_subscriptions
      add constraint screen_subscriptions_pending_plan_id_fkey
      foreign key (pending_plan_id) references public.plans(id) on delete restrict;
  end if;
end $$;

create index if not exists screen_subscriptions_pending_plan_idx
  on public.screen_subscriptions (pending_plan_id)
  where pending_plan_id is not null;
