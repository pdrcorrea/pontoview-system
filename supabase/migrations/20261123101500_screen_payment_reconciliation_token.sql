-- Shared secret kept in Supabase Vault; never exposed to the browser or to clients.
select vault.create_secret(
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  'pv_screen_reconcile_token',
  'Token for scheduled payment reconciliation'
)
where not exists (select 1 from vault.decrypted_secrets where name = 'pv_screen_reconcile_token');

create or replace function public.screen_reconcile_token_valid(p_token text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select coalesce((
    select s.decrypted_secret = p_token
    from vault.decrypted_secrets s
    where s.name = 'pv_screen_reconcile_token'
    limit 1
  ), false)
$$;

revoke all on function public.screen_reconcile_token_valid(text) from public, anon, authenticated;
grant execute on function public.screen_reconcile_token_valid(text) to service_role;
