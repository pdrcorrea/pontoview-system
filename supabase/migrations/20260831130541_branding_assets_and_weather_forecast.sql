alter table public.weather_cache
  add column if not exists forecast jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-branding',
  'organization-branding',
  true,
  2097152,
  array['image/png','image/jpeg','image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "organization_branding_select" on storage.objects;
create policy "organization_branding_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'organization-branding'
  and exists (
    select 1 from public.organization_users ou
    where ou.user_id = (select auth.uid())
      and ou.organization_id::text = (storage.foldername(name))[1]
      and ou.role in ('owner','admin')
  )
);

drop policy if exists "organization_branding_insert" on storage.objects;
create policy "organization_branding_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'organization-branding'
  and exists (
    select 1 from public.organization_users ou
    where ou.user_id = (select auth.uid())
      and ou.organization_id::text = (storage.foldername(name))[1]
      and ou.role in ('owner','admin')
  )
);

drop policy if exists "organization_branding_update" on storage.objects;
create policy "organization_branding_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'organization-branding'
  and exists (
    select 1 from public.organization_users ou
    where ou.user_id = (select auth.uid())
      and ou.organization_id::text = (storage.foldername(name))[1]
      and ou.role in ('owner','admin')
  )
)
with check (
  bucket_id = 'organization-branding'
  and exists (
    select 1 from public.organization_users ou
    where ou.user_id = (select auth.uid())
      and ou.organization_id::text = (storage.foldername(name))[1]
      and ou.role in ('owner','admin')
  )
);

drop policy if exists "organization_branding_delete" on storage.objects;
create policy "organization_branding_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'organization-branding'
  and exists (
    select 1 from public.organization_users ou
    where ou.user_id = (select auth.uid())
      and ou.organization_id::text = (storage.foldername(name))[1]
      and ou.role in ('owner','admin')
  )
);
