alter table public.plans
  add column if not exists list_price_cents integer,
  add column if not exists promotion_percent integer not null default 0;

alter table public.plans
  drop constraint if exists plans_promotion_percent_check;

alter table public.plans
  add constraint plans_promotion_percent_check
  check (promotion_percent between 0 and 100);

update public.plans
set list_price_cents = price_cents
where list_price_cents is null;

update public.plans
set
  promotion_percent = 30,
  price_cents = round(list_price_cents * 0.70)::integer
where code in ('start', 'pro', 'business');

comment on column public.plans.list_price_cents is 'Preço de tabela em centavos antes de promoções.';
comment on column public.plans.promotion_percent is 'Percentual promocional aplicado ao preço de tabela.';
