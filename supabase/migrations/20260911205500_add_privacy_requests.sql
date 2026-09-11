create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.profiles(id) on delete set null,
  organization_id uuid null references public.organizations(id) on delete set null,
  requester_email text not null,
  request_type text not null check (request_type in (
    'access',
    'correction',
    'portability',
    'deletion',
    'revocation',
    'sharing_information',
    'other'
  )),
  status text not null default 'received' check (status in ('received','in_review','completed','rejected')),
  details text null check (details is null or char_length(details) <= 2000),
  response_note text null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null
);

alter table public.privacy_requests enable row level security;

drop policy if exists privacy_requests_select_own on public.privacy_requests;
create policy privacy_requests_select_own
on public.privacy_requests
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists privacy_requests_insert_own on public.privacy_requests;
create policy privacy_requests_insert_own
on public.privacy_requests
for insert
to authenticated
with check (user_id = auth.uid());

revoke all on public.privacy_requests from anon;
grant select, insert on public.privacy_requests to authenticated;

create index if not exists privacy_requests_user_created_idx
  on public.privacy_requests (user_id, created_at desc);
