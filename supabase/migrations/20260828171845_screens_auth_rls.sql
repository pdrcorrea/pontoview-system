-- Authentication bootstrap, role checks and Row Level Security for Screens.

create or replace function private.has_org_role(
  p_organization_id uuid,
  p_roles public.organization_role[] default array['owner','admin','editor','viewer']::public.organization_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.organization_users ou
    where ou.organization_id = p_organization_id
      and ou.user_id = (select auth.uid())
      and ou.role = any(p_roles)
  );
$$;

revoke all on function private.has_org_role(uuid, public.organization_role[]) from public;
grant usage on schema private to authenticated;
grant execute on function private.has_org_role(uuid, public.organization_role[]) to authenticated;

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
  select id into v_plan_id from public.plans where code = 'start' and is_active limit 1;
  insert into public.screen_subscriptions (organization_id, plan_id, status, trial_ends_at)
  values (v_org_id, v_plan_id, 'trial', now() + interval '14 days');
  return v_org_id;
end;
$$;

revoke all on function public.ensure_screen_organization(text) from public;
grant execute on function public.ensure_screen_organization(text) to authenticated;

-- Preserve the existing profile creation used by PontoView Studio and add an
-- organization only when the new Screens frontend identifies itself.
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
    select id into v_plan_id from public.plans where code = 'start' and is_active limit 1;
    insert into public.screen_subscriptions (organization_id, plan_id, status, trial_ends_at)
    values (v_org_id, v_plan_id, 'trial', now() + interval '14 days');
  end if;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Explicit Data API grants are required by current Supabase projects.
grant select on public.plans to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, avatar_url, phone, onboarding_completed, updated_at) on public.profiles to authenticated;
grant select, insert, update on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_users to authenticated;
grant select, insert, update, delete on
  public.playlists, public.media, public.playlist_items, public.screens,
  public.screen_settings, public.screen_groups, public.screen_group_members,
  public.schedules, public.schedule_rules, public.drive_connections,
  public.messages, public.message_screens, public.app_instances,
  public.support_requests
to authenticated;
grant select on
  public.screen_status, public.screen_events, public.screen_subscriptions,
  public.billing_payments, public.news_cache
to authenticated;
grant usage, select on sequence public.screen_events_id_seq to service_role;
grant all on
  public.organizations, public.organization_users, public.playlists, public.media,
  public.playlist_items, public.screens, public.screen_settings, public.screen_status,
  public.screen_events, public.screen_groups, public.screen_group_members,
  public.schedules, public.schedule_rules, public.drive_connections, public.messages,
  public.message_screens, public.app_instances, public.plans, public.screen_subscriptions,
  public.billing_payments, public.support_requests, public.news_cache
to service_role;
grant all on private.drive_credentials, private.screen_activations to service_role;

-- Enable RLS on every table reachable through the Data API.
alter table public.organizations enable row level security;
alter table public.organization_users enable row level security;
alter table public.playlists enable row level security;
alter table public.media enable row level security;
alter table public.playlist_items enable row level security;
alter table public.screens enable row level security;
alter table public.screen_settings enable row level security;
alter table public.screen_status enable row level security;
alter table public.screen_events enable row level security;
alter table public.screen_groups enable row level security;
alter table public.screen_group_members enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_rules enable row level security;
alter table public.drive_connections enable row level security;
alter table public.messages enable row level security;
alter table public.message_screens enable row level security;
alter table public.app_instances enable row level security;
alter table public.plans enable row level security;
alter table public.screen_subscriptions enable row level security;
alter table public.billing_payments enable row level security;
alter table public.support_requests enable row level security;
alter table public.news_cache enable row level security;

drop policy if exists pv_profiles_self_read on public.profiles;
create policy pv_profiles_self_read on public.profiles for select to authenticated
using (id = (select auth.uid()));
drop policy if exists pv_profiles_self_update on public.profiles;
create policy pv_profiles_self_update on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists organizations_member_read on public.organizations;
create policy organizations_member_read on public.organizations for select to authenticated
using ((select private.has_org_role(id)));
drop policy if exists organizations_admin_update on public.organizations;
create policy organizations_admin_update on public.organizations for update to authenticated
using ((select private.has_org_role(id, array['owner','admin']::public.organization_role[])))
with check ((select private.has_org_role(id, array['owner','admin']::public.organization_role[])));

drop policy if exists organization_users_member_read on public.organization_users;
create policy organization_users_member_read on public.organization_users for select to authenticated
using ((select private.has_org_role(organization_id)));
drop policy if exists organization_users_owner_insert on public.organization_users;
create policy organization_users_owner_insert on public.organization_users for insert to authenticated
with check (
  (select private.has_org_role(organization_id, array['owner']::public.organization_role[]))
  or (
    role in ('editor','viewer')
    and (select private.has_org_role(organization_id, array['admin']::public.organization_role[]))
  )
);
drop policy if exists organization_users_owner_update on public.organization_users;
create policy organization_users_owner_update on public.organization_users for update to authenticated
using (
  (select private.has_org_role(organization_id, array['owner']::public.organization_role[]))
  or (
    role in ('editor','viewer')
    and (select private.has_org_role(organization_id, array['admin']::public.organization_role[]))
  )
)
with check (
  (select private.has_org_role(organization_id, array['owner']::public.organization_role[]))
  or (
    role in ('editor','viewer')
    and (select private.has_org_role(organization_id, array['admin']::public.organization_role[]))
  )
);
drop policy if exists organization_users_owner_delete on public.organization_users;
create policy organization_users_owner_delete on public.organization_users for delete to authenticated
using (
  user_id <> (select auth.uid()) and (
    (select private.has_org_role(organization_id, array['owner']::public.organization_role[]))
    or (
      role in ('editor','viewer')
      and (select private.has_org_role(organization_id, array['admin']::public.organization_role[]))
    )
  )
);

-- Standard tenant tables: all members read, owner/admin/editor write.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'playlists','media','playlist_items','screens','screen_settings','screen_groups',
    'screen_group_members','schedules','schedule_rules','messages','message_screens',
    'app_instances'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_member_read', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.has_org_role(organization_id)))',
      table_name || '_member_read', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_editor_write', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select private.has_org_role(organization_id, array[''owner'',''admin'',''editor'']::public.organization_role[]))) with check ((select private.has_org_role(organization_id, array[''owner'',''admin'',''editor'']::public.organization_role[])))',
      table_name || '_editor_write', table_name
    );
  end loop;
end $$;

drop policy if exists drive_connections_member_read on public.drive_connections;
create policy drive_connections_member_read on public.drive_connections for select to authenticated
using ((select private.has_org_role(organization_id)));
drop policy if exists drive_connections_admin_write on public.drive_connections;
create policy drive_connections_admin_write on public.drive_connections for all to authenticated
using ((select private.has_org_role(organization_id, array['owner','admin']::public.organization_role[])))
with check (
  connected_by = (select auth.uid())
  and (select private.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
);

drop policy if exists screen_status_member_read on public.screen_status;
create policy screen_status_member_read on public.screen_status for select to authenticated
using ((select private.has_org_role(organization_id)));
drop policy if exists screen_events_member_read on public.screen_events;
create policy screen_events_member_read on public.screen_events for select to authenticated
using ((select private.has_org_role(organization_id)));

drop policy if exists plans_public_read on public.plans;
create policy plans_public_read on public.plans for select to anon, authenticated
using (is_active);
drop policy if exists screen_subscriptions_admin_read on public.screen_subscriptions;
create policy screen_subscriptions_admin_read on public.screen_subscriptions for select to authenticated
using ((select private.has_org_role(organization_id, array['owner','admin']::public.organization_role[])));
drop policy if exists billing_payments_admin_read on public.billing_payments;
create policy billing_payments_admin_read on public.billing_payments for select to authenticated
using ((select private.has_org_role(organization_id, array['owner','admin']::public.organization_role[])));

drop policy if exists support_requests_member_read on public.support_requests;
create policy support_requests_member_read on public.support_requests for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
);
drop policy if exists support_requests_member_insert on public.support_requests;
create policy support_requests_member_insert on public.support_requests for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.has_org_role(organization_id))
);

drop policy if exists news_cache_authenticated_read on public.news_cache;
create policy news_cache_authenticated_read on public.news_cache for select to authenticated
using (expires_at > now());

-- No browser role can reach sensitive credentials or activation state directly.
revoke all on private.drive_credentials, private.screen_activations from public, anon, authenticated;
