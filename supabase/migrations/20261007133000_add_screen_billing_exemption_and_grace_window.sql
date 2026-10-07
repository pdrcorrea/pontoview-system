-- Keep device pairing independent from billing while allowing explicit internal exemptions
-- and a five-day grace window for paid subscriptions that become past due.

alter table public.screen_subscriptions
  add column if not exists billing_exempt boolean not null default false,
  add column if not exists billing_exempt_reason text;

comment on column public.screen_subscriptions.billing_exempt is
  'When true, playback is allowed without an active paid subscription. Intended for internal, partner or manually exempt organizations.';

comment on column public.screen_subscriptions.billing_exempt_reason is
  'Internal administrative reason for billing exemption.';

create or replace function private.screen_subscription_allows_playback(p_screen_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.screens s
    join public.screen_subscriptions ss on ss.organization_id = s.organization_id
    where s.id = p_screen_id
      and s.is_active
      and (
        ss.billing_exempt
        or ss.status = 'active'
        or (ss.status = 'trial' and ss.trial_ends_at > now())
        or (ss.status = 'trial' and ss.provider_status in ('authorized','payment_approved'))
        or (
          ss.status = 'past_due'
          and coalesce(
            ss.grace_period_ends_at,
            ss.current_period_end + interval '5 days'
          ) > now()
        )
      )
  );
$$;

revoke all on function private.screen_subscription_allows_playback(uuid) from public, anon, authenticated;
