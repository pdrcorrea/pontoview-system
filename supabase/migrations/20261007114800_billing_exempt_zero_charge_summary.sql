-- Billing-exempt organizations must never accrue or project charges.
-- The summary exposes billingExempt so the frontend can render the correct state.

create or replace function public.screen_billing_summary(p_organization_id uuid, p_at timestamptz default now())
returns jsonb
language plpgsql
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
  v_effective_unit_price integer := 0;
begin
  select ss.* into v_subscription
  from public.screen_subscriptions ss
  where ss.organization_id = p_organization_id;
  if not found then return null; end if;

  select o.timezone into v_timezone
  from public.organizations o
  where o.id = p_organization_id;
  v_timezone := coalesce(v_timezone, 'America/Sao_Paulo');

  v_period_start := coalesce(v_subscription.current_period_start, v_subscription.trial_ends_at, p_at);
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
      least(coalesce((b.unlinked_at at time zone v_timezone)::date, v_end_date - 1), v_end_date - 1),
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

  v_effective_unit_price := case when v_subscription.billing_exempt then 0 else v_subscription.unit_price_cents end;
  v_accrued_amount := round((v_accrued_days::numeric * v_effective_unit_price::numeric) / v_period_days)::integer;
  v_projected_amount := round((v_projected_days::numeric * v_effective_unit_price::numeric) / v_period_days)::integer;
  v_trial_days_remaining := case
    when v_subscription.billing_exempt then 0
    else greatest(0, ((v_subscription.trial_ends_at at time zone v_timezone)::date - v_today)::integer)
  end;

  return jsonb_build_object(
    'billingModel', v_subscription.billing_model,
    'billingExempt', v_subscription.billing_exempt,
    'unitPriceCents', v_effective_unit_price,
    'activeScreens', v_active_screens,
    'trialEndsAt', v_subscription.trial_ends_at,
    'trialActive', (not v_subscription.billing_exempt) and p_at < v_subscription.trial_ends_at,
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
