-- Advisor-driven hardening: explicit function ACLs and one policy per action.

revoke all on function public.create_screen_activation() from public, anon, authenticated;
revoke all on function public.check_screen_activation(uuid) from public, anon, authenticated;
revoke all on function public.claim_screen_activation(text, text) from public, anon, authenticated;
revoke all on function public.ensure_screen_organization(text) from public, anon, authenticated;
revoke all on function public.get_player_manifest(uuid, text) from public, anon, authenticated;
revoke all on function public.player_heartbeat(uuid, text, uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.player_event(uuid, text, text, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.get_screen_dashboard(uuid) from public, anon, authenticated;
revoke all on function public.replace_playlist_items(uuid, jsonb) from public, anon, authenticated;

grant execute on function public.create_screen_activation() to anon, authenticated;
grant execute on function public.check_screen_activation(uuid) to anon, authenticated;
grant execute on function public.get_player_manifest(uuid, text) to anon, authenticated;
grant execute on function public.player_heartbeat(uuid, text, uuid, uuid, text, jsonb) to anon, authenticated;
grant execute on function public.player_event(uuid, text, text, uuid, uuid, jsonb) to anon, authenticated;
grant execute on function public.claim_screen_activation(text, text) to authenticated;
grant execute on function public.ensure_screen_organization(text) to authenticated;
grant execute on function public.get_screen_dashboard(uuid) to authenticated;
grant execute on function public.replace_playlist_items(uuid, jsonb) to authenticated;

-- The shared profiles table already had equivalent self policies.
drop policy if exists pv_profiles_self_read on public.profiles;
drop policy if exists pv_profiles_self_update on public.profiles;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'playlists','media','playlist_items','screens','screen_settings','screen_groups',
    'screen_group_members','schedules','schedule_rules','messages','message_screens',
    'app_instances'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_editor_write', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_editor_insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_editor_update', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_editor_delete', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.has_org_role(organization_id, array[''owner'',''admin'',''editor'']::public.organization_role[])))',
      table_name || '_editor_insert', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.has_org_role(organization_id, array[''owner'',''admin'',''editor'']::public.organization_role[]))) with check ((select private.has_org_role(organization_id, array[''owner'',''admin'',''editor'']::public.organization_role[])))',
      table_name || '_editor_update', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select private.has_org_role(organization_id, array[''owner'',''admin'',''editor'']::public.organization_role[])))',
      table_name || '_editor_delete', table_name
    );
  end loop;
end $$;

drop policy if exists drive_connections_admin_write on public.drive_connections;
drop policy if exists drive_connections_admin_insert on public.drive_connections;
drop policy if exists drive_connections_admin_update on public.drive_connections;
drop policy if exists drive_connections_admin_delete on public.drive_connections;
create policy drive_connections_admin_insert on public.drive_connections for insert to authenticated
with check (connected_by = (select auth.uid()) and (select private.has_org_role(organization_id, array['owner','admin']::public.organization_role[])));
create policy drive_connections_admin_update on public.drive_connections for update to authenticated
using ((select private.has_org_role(organization_id, array['owner','admin']::public.organization_role[])))
with check ((select private.has_org_role(organization_id, array['owner','admin']::public.organization_role[])));
create policy drive_connections_admin_delete on public.drive_connections for delete to authenticated
using ((select private.has_org_role(organization_id, array['owner','admin']::public.organization_role[])));

-- Cache tables are server-maintained. This explicit deny policy documents that
-- browser roles cannot read them and removes the no-policy advisor ambiguity.
drop policy if exists weather_cache_no_browser on public.weather_cache;
create policy weather_cache_no_browser on public.weather_cache for select to anon, authenticated using (false);
