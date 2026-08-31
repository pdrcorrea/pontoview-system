create or replace function public.get_drive_credentials(p_connection_id uuid)
returns table (
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    dc.access_token_encrypted,
    dc.refresh_token_encrypted,
    dc.token_expires_at
  from private.drive_credentials dc
  where dc.connection_id = p_connection_id;
$$;

create or replace function public.upsert_drive_credentials(
  p_connection_id uuid,
  p_access_token_encrypted text,
  p_refresh_token_encrypted text,
  p_token_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.drive_credentials (
    connection_id,
    access_token_encrypted,
    refresh_token_encrypted,
    token_expires_at,
    updated_at
  ) values (
    p_connection_id,
    p_access_token_encrypted,
    p_refresh_token_encrypted,
    p_token_expires_at,
    now()
  )
  on conflict (connection_id) do update set
    access_token_encrypted = excluded.access_token_encrypted,
    refresh_token_encrypted = coalesce(
      excluded.refresh_token_encrypted,
      private.drive_credentials.refresh_token_encrypted
    ),
    token_expires_at = excluded.token_expires_at,
    updated_at = now();
end;
$$;

revoke all on function public.get_drive_credentials(uuid) from public, anon, authenticated;
revoke all on function public.upsert_drive_credentials(uuid, text, text, timestamptz) from public, anon, authenticated;

grant execute on function public.get_drive_credentials(uuid) to service_role;
grant execute on function public.upsert_drive_credentials(uuid, text, text, timestamptz) to service_role;
