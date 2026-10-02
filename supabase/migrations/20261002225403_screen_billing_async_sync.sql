-- Asynchronously synchronize the Mercado Pago recurring amount only when a
-- billing-relevant screen binding changes. Player heartbeats/status never call it.

create extension if not exists pg_net with schema extensions;

create table if not exists private.screen_billing_sync_config (
  id boolean primary key default true check (id),
  endpoint text not null,
  secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into private.screen_billing_sync_config (id, endpoint, secret)
values (
  true,
  'https://fpdojntvnhiszagczfqr.supabase.co/functions/v1/screens-billing-sync',
  encode(extensions.gen_random_bytes(32), 'hex')
)
on conflict (id) do update set
  endpoint = excluded.endpoint,
  updated_at = now();

revoke all on private.screen_billing_sync_config from public, anon, authenticated;
grant select on private.screen_billing_sync_config to service_role;

create or replace function public.screen_billing_sync_secret_valid(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_secret is not null and exists (
    select 1
    from private.screen_billing_sync_config c
    where c.id = true and c.secret = p_secret
  );
$$;
revoke all on function public.screen_billing_sync_secret_valid(text) from public, anon, authenticated;
grant execute on function public.screen_billing_sync_secret_valid(text) to service_role;

create or replace function private.queue_screen_billing_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_endpoint text;
  v_secret text;
begin
  v_org_id := coalesce(new.organization_id, old.organization_id);
  select c.endpoint, c.secret into v_endpoint, v_secret
  from private.screen_billing_sync_config c
  where c.id = true;

  if v_endpoint is not null and v_secret is not null and v_org_id is not null then
    perform net.http_post(
      url := v_endpoint,
      body := jsonb_build_object('organizationId', v_org_id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-billing-sync', v_secret
      ),
      timeout_milliseconds := 3000
    );
  end if;

  return coalesce(new, old);
end;
$$;
revoke all on function private.queue_screen_billing_sync() from public, anon, authenticated;

drop trigger if exists screen_bindings_queue_billing_sync on public.screen_bindings;
create trigger screen_bindings_queue_billing_sync
after insert or update of unlinked_at on public.screen_bindings
for each row execute function private.queue_screen_billing_sync();
