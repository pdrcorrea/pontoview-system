-- The Drive connection foreign key is composite, so both columns must be
-- covered in order for PostgreSQL to use the index for referential checks.

drop index if exists public.media_drive_connection_fkey_idx;
create index media_drive_connection_fkey_idx
  on public.media (drive_connection_id, organization_id);
