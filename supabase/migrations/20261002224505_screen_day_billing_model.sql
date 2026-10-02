-- PontoView Telas: billing by linked screen-days.
-- One organization trial, five calendar days, then R$ 29/month per linked screen
-- prorated by the number of linked calendar days in each billing cycle.

insert into public.plans (
  code, name, description, price_cents, currency, billing_period,
  screen_limit, user_limit, trial_days, features, is_active, sort_order,
  list_price_cents, promotion_percent
)
values (
  'screen-metered',
  'PontoView Telas',
  'Cobrança por tela vinculada, proporcional aos dias de uso.',
  2900, 'BRL', 'monthly', 1000000, 100, 5,
  '{"drive":true,"youtube":true,"lframe":true,"news":true,"telemetry":true}'::jsonb,
  true, 1, null, 0
)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  billing_period = excluded.billing_period,
  screen_limit = excluded.screen_limit,
  user_limit = excluded.user_limit,
  trial_days = excluded.trial_days,
  features = excluded.features,
  is_active = true,
  sort_order = excluded.sort_order,
  list_price_cents = null,
  promotion_percent = 0,
  updated_at = now();

update public.plans
set is_active = false, updated_at = now()
where code <> 'screen-metered' and code in ('start','pro','business');

alter table public.screen_subscriptions
  add column if not exists billing_model text not null default 'screen_day',
  add column if not exists unit_price_cents integer not null default 2900,
  add column if not exists projected_amount_cents integer not null default 0,
  add column if not exists last_synced_amount_cents integer not null default 0,
  add column if not exists billing_started_at timestamptz;

alter table public.screen_subscriptions
  drop constraint if exists screen_subscriptions_billing_model_check;
alter table public.screen_subscriptions
  add constraint screen_subscriptions_billing_model_check
  check (billing_model = 'screen_day');

alter table public.screen_subscriptions
  drop constraint if exists screen_subscriptions_unit_price_cents_check;
alter table public.screen_subscriptions
  add constraint screen_subscriptions_unit_price_cents_check
  check (unit_price_cents > 0);

create table if not exists public.screen_bindings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  screen_id uuid not null,
  linked_at timestamptz not null default now(),
  unlinked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint screen_bindings_interval_check check (unlinked_at is null or unlinked_at >= linked_at)
);

create index if not exists screen_bindings_org_interval_idx
  on public.screen_bindings (organization_id, linked_at, unlinked_at);
create index if not exists screen_bindings_screen_idx
  on public.screen_bindings (screen_id, linked_at desc);
create unique index if not exists screen_bindings_one_open_per_screen_idx
  on public.screen_bindings (screen_id)
  where unlinked_at is null;

alter table public.screen_bindings enable row level security;
grant select on public.screen_bindings to authenticated;
grant all on public.screen_bindings to service_role;

drop policy if exists screen_bindings_member_read on public.screen_bindings;
create policy screen_bindings_member_read
on public.screen_bindings for select to authenticated
using ((select private.has_org_role(organization_id, array['owner','admin']::public.organization_role[])));

create or replace function private.track_screen_binding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_active then
      insert into public.screen_bindings (organization_id, screen_id, linked_at)
      select new.organization_id, new.id, coalesce(new.paired_at, new.created_at, now())
      where not exists (
        select 1 from public.screen_bindings b
        where b.screen_id = new.id and b.unlinked_at is null
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if not old.is_active and new.is_active then
      insert into public.screen_bindings (organization_id, screen_id, linked_at)
      select new.organization_id, new.id, now()
      where not exists (
        select 1 from public.screen_bindings b
        where b.screen_id = new.id and b.unlinked_at is null
      );
    elsif old.is_active and not new.is_active then
      update public.screen_bindings
      set unlinked_at = now()
      where screen_id = old.id and unlinked_at is null;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.screen_bindings
    set unlinked_at = now()
    where screen_id = old.id and unlinked_at is null;
    return old;
  end if;

  return null;
end;
$$;
revoke all on function private.track_screen_binding() from public, anon, authenticated;

drop trigger if exists screens_track_billing_binding on public.screens;
create trigger screens_track_billing_binding
after insert or update of is_active or delete on public.screens
for each row execute function private.track_screen_binding();

-- Existing screens start a fresh, non-retroactive metering history at rollout.
insert into public.screen_bindings (organization_id, screen_id, linked_at)
select s.organization_id, s.id, now()
from public.screens s
where s.is_active
  and not exists (
    select 1 from public.screen_bindings b
    where b.screen_id = s.id and b.unlinked_at is null
  );

-- Transition current subscriptions to the single metered product.
with metered as (
  select id from public.plans where code = 'screen-metered' limit 1
)
update public.screen_subscriptions ss
set plan_id = metered.id,
    pending_plan_id = null,
    pending_plan_requested_at = null,
    provider_plan_id = null,
    billing_model = 'screen_day',
    unit_price_cents = 2900,
    projected_amount_cents = 0,
    last_synced_amount_cents = 0
from metered;

-- Give existing trial accounts a clean five-calendar-day trial from rollout.
update public.screen_subscriptions ss
set trial_ends_at = (
      (date_trunc('day', now() at time zone o.timezone) + interval '5 days')
      at time zone o.timezone
    ),
    current_period_start = null,
    current_period_end = null,
    billing_started_at = null
from public.organizations o
where o.id = ss.organization_id
  and ss.status = 'trial';

create or replace function public.ensure_screen_organization(p_name text default 'Minha empresa')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_org_id uuid;
  v_name text := nullif(trim(p_name), '');
  v_slug text;
  v_plan_id uuid;
  v_trial_end timestamptz;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select ou.organization_id into v_org_id
  from public.organization_users ou
  where ou.user_id = v_user_id
  order by ou.created_at
  limit 1;
  if v_org_id is not null then return v_org_id; end if;

  v_name := coalesce(v_name, 'Minha empresa');
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'INVALID_ORGANIZATION_NAME' using errcode = '22023';
  end if;
  v_slug := trim(both '-' from regexp_replace(lower(extensions.unaccent(v_name)), '[^a-z0-9]+', '-', 'g'));
  v_slug := coalesce(nullif(v_slug, ''), 'empresa') || '-' || left(replace(v_user_id::text, '-', ''), 8);

  insert into public.organizations (name, display_name, slug, created_by)
  values (v_name, v_name, v_slug, v_user_id)
  returning id into v_org_id;
  insert into public.organization_users (organization_id, user_id, role)
  values (v_org_id, v_user_id, 'owner');
  insert into public.playlists (organization_id, name, description, is_default, created_by)
  values (v_org_id, 'Playlist principal', 'Conteúdo padrão das novas telas.', true, v_user_id);

  select id into v_plan_id from public.plans where code = 'screen-metered' and is_active limit 1;
  v_trial_end := ((date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '5 days') at time zone 'America/Sao_Paulo');
  insert into public.screen_subscriptions (
    organization_id, plan_id, status, trial_ends_at, billing_model, unit_price_cents
  ) values (
    v_org_id, v_plan_id, 'trial', v_trial_end, 'screen_day', 2900
  );
  return v_org_id;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_name text;
  v_slug text;
  v_plan_id uuid;
  v_trial_end timestamptz;
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();

  if coalesce(new.raw_user_meta_data->>'product', '') = 'screens'
     and not exists (select 1 from public.organization_users where user_id = new.id) then
    v_name := coalesce(nullif(trim(new.raw_user_meta_data->>'organization_name'), ''), 'Minha empresa');
    v_slug := trim(both '-' from regexp_replace(lower(extensions.unaccent(v_name)), '[^a-z0-9]+', '-', 'g'));
    v_slug := coalesce(nullif(v_slug, ''), 'empresa') || '-' || left(replace(new.id::text, '-', ''), 8);
    insert into public.organizations (name, display_name, slug, created_by)
    values (v_name, v_name, v_slug, new.id)
    returning id into v_org_id;
    insert into public.organization_users (organization_id, user_id, role)
    values (v_org_id, new.id, 'owner');
    insert into public.playlists (organization_id, name, description, is_default, created_by)
    values (v_org_id, 'Playlist principal', 'Conteúdo padrão das novas telas.', true, new.id);
    select id into v_plan_id from public.plans where code = 'screen-metered' and is_active limit 1;
    v_trial_end := ((date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '5 days') at time zone 'America/Sao_Paulo');
    insert into public.screen_subscriptions (
      organization_id, plan_id, status, trial_ends_at, billing_model, unit_price_cents
    ) values (
      v_org_id, v_plan_id, 'trial', v_trial_end, 'screen_day', 2900
    );
  end if;
  return new;
end;
$$;

create or replace function private.valid_screen_token(p_screen_id uuid, p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_token is not null and exists (
    select 1
    from public.screens s
    join public.screen_subscriptions ss on ss.organization_id = s.organization_id
    where s.id = p_screen_id
      and s.is_active
      and s.device_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and (
        ss.status = 'active'
        or (ss.status = 'trial' and ss.trial_ends_at > now())
        or (ss.status = 'trial' and ss.provider_status in ('authorized','payment_approved'))
        or (ss.status = 'past_due' and ss.grace_period_ends_at > now())
      )
  );
$$;
revoke all on function private.valid_screen_token(uuid, text) from public, anon, authenticated;

create or replace function public.claim_screen_activation(p_code text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_org_id uuid;
  v_activation private.screen_activations%rowtype;
  v_screen_id uuid;
  v_default_playlist_id uuid;
  v_token text;
  v_slug text;
  v_subscription_ok boolean;
  v_name text := nullif(trim(p_name), '');
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if p_code is null or p_code !~ '^[0-9]{6}$' then raise exception 'INVALID_CODE' using errcode = '22023'; end if;
  if v_name is null or char_length(v_name) > 120 then raise exception 'INVALID_SCREEN_NAME' using errcode = '22023'; end if;

  select ou.organization_id into v_org_id
  from public.organization_users ou
  where ou.user_id = v_user_id and ou.role in ('owner','admin')
  order by ou.created_at limit 1;
  if v_org_id is null then raise exception 'PAIR_PERMISSION_DENIED' using errcode = '42501'; end if;

  select a.* into v_activation
  from private.screen_activations a
  where a.code = p_code and a.expires_at > now() and a.claimed_screen_id is null
  for update;
  if not found then raise exception 'CODE_NOT_FOUND_OR_EXPIRED' using errcode = 'P0002'; end if;

  select exists (
    select 1 from public.screen_subscriptions ss
    where ss.organization_id = v_org_id
      and (
        ss.status = 'active'
        or (ss.status = 'trial' and ss.trial_ends_at > now())
        or (ss.status = 'trial' and ss.provider_status in ('authorized','payment_approved'))
        or (ss.status = 'past_due' and ss.grace_period_ends_at > now())
      )
  ) into v_subscription_ok;
  if not v_subscription_ok then raise exception 'SUBSCRIPTION_INACTIVE' using errcode = '42501'; end if;

  select id into v_default_playlist_id
  from public.playlists where organization_id = v_org_id and is_default limit 1;
  v_screen_id := gen_random_uuid();
  v_slug := trim(both '-' from regexp_replace(lower(extensions.unaccent(v_name)), '[^a-z0-9]+', '-', 'g'));
  v_slug := coalesce(nullif(v_slug, ''), 'tela') || '-' || left(replace(v_screen_id::text, '-', ''), 6);
  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.screens (
    id, organization_id, name, slug, default_playlist_id, device_token_hash, paired_at, paired_by
  ) values (
    v_screen_id, v_org_id, v_name, v_slug, v_default_playlist_id,
    encode(extensions.digest(v_token, 'sha256'), 'hex'), now(), v_user_id
  );
  insert into public.screen_settings (screen_id, organization_id) values (v_screen_id, v_org_id);
  insert into public.screen_status (screen_id, organization_id, connectivity) values (v_screen_id, v_org_id, 'online');
  insert into public.screen_events (organization_id, screen_id, event_type, payload)
  values (v_org_id, v_screen_id, 'paired', jsonb_build_object('pairedBy', v_user_id));
  update private.screen_activations
  set claimed_screen_id = v_screen_id, device_token = v_token, claimed_at = now()
  where id = v_activation.id;
  return jsonb_build_object('screenId', v_screen_id, 'name', v_name);
end;
$$;
revoke all on function public.claim_screen_activation(text, text) from public;
grant execute on function public.claim_screen_activation(text, text) to authenticated;

create or replace function public.screen_billing_summary(
  p_organization_id uuid,
  p_at timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_subscription public.screen_subscriptions%rowtype;
  v_timezone text;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_start_date date;
  v_end_date date;
  v_today date;
  v_period_days integer;
  v_active_screens integer := 0;
  v_accrued_days integer := 0;
  v_projected_days integer := 0;
  v_accrued_amount integer := 0;
  v_projected_amount integer := 0;
  v_trial_days_remaining integer := 0;
begin
  select ss.* into v_subscription
  from public.screen_subscriptions ss
  where ss.organization_id = p_organization_id;
  if not found then return null; end if;

  select o.timezone into v_timezone
  from public.organizations o
  where o.id = p_organization_id;
  v_timezone := coalesce(v_timezone, 'America/Sao_Paulo');

  v_period_start := coalesce(v_subscription.current_period_start, v_subscription.trial_ends_at);
  v_period_end := coalesce(v_subscription.current_period_end, v_period_start + interval '1 month');
  v_start_date := (v_period_start at time zone v_timezone)::date;
  v_end_date := (v_period_end at time zone v_timezone)::date;
  v_today := (p_at at time zone v_timezone)::date;
  v_period_days := greatest(1, v_end_date - v_start_date);

  select count(*)::integer into v_active_screens
  from public.screens s
  where s.organization_id = p_organization_id and s.is_active;

  with linked_days as (
    select distinct b.screen_id, d::date as billing_day
    from public.screen_bindings b
    cross join lateral generate_series(
      greatest((b.linked_at at time zone v_timezone)::date, v_start_date),
      least(
        coalesce((b.unlinked_at at time zone v_timezone)::date, v_end_date - 1),
        v_end_date - 1
      ),
      interval '1 day'
    ) d
    where b.organization_id = p_organization_id
      and (b.linked_at at time zone v_timezone)::date < v_end_date
      and (b.unlinked_at is null or (b.unlinked_at at time zone v_timezone)::date >= v_start_date)
  )
  select count(*)::integer into v_projected_days from linked_days;

  if p_at >= v_period_start then
    with linked_days as (
      select distinct b.screen_id, d::date as billing_day
      from public.screen_bindings b
      cross join lateral generate_series(
        greatest((b.linked_at at time zone v_timezone)::date, v_start_date),
        least(
          coalesce((b.unlinked_at at time zone v_timezone)::date, least(v_today, v_end_date - 1)),
          least(v_today, v_end_date - 1)
        ),
        interval '1 day'
      ) d
      where b.organization_id = p_organization_id
        and (b.linked_at at time zone v_timezone)::date <= least(v_today, v_end_date - 1)
        and (b.unlinked_at is null or (b.unlinked_at at time zone v_timezone)::date >= v_start_date)
    )
    select count(*)::integer into v_accrued_days from linked_days;
  end if;

  v_accrued_amount := round((v_accrued_days::numeric * v_subscription.unit_price_cents::numeric) / v_period_days)::integer;
  v_projected_amount := round((v_projected_days::numeric * v_subscription.unit_price_cents::numeric) / v_period_days)::integer;
  v_trial_days_remaining := greatest(
    0,
    ((v_subscription.trial_ends_at at time zone v_timezone)::date - v_today)::integer
  );

  return jsonb_build_object(
    'billingModel', v_subscription.billing_model,
    'unitPriceCents', v_subscription.unit_price_cents,
    'activeScreens', v_active_screens,
    'trialEndsAt', v_subscription.trial_ends_at,
    'trialActive', p_at < v_subscription.trial_ends_at,
    'trialDaysRemaining', v_trial_days_remaining,
    'periodStart', v_period_start,
    'periodEnd', v_period_end,
    'periodDays', v_period_days,
    'screenDaysAccrued', v_accrued_days,
    'screenDaysProjected', v_projected_days,
    'accruedAmountCents', v_accrued_amount,
    'projectedAmountCents', v_projected_amount
  );
end;
$$;

grant execute on function public.screen_billing_summary(uuid, timestamptz) to authenticated, service_role;
