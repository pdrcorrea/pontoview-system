-- Cover every foreign key introduced by PontoView Screens. These indexes keep
-- deletes, cascades and tenant-filtered joins predictable as the account grows.

create index if not exists screen_activations_claimed_screen_id_fkey_idx on private.screen_activations (claimed_screen_id);

create index if not exists app_instances_created_by_fkey_idx on public.app_instances (created_by);
create index if not exists drive_connections_connected_by_fkey_idx on public.drive_connections (connected_by);
create index if not exists media_created_by_fkey_idx on public.media (created_by);
create index if not exists media_drive_connection_fkey_idx on public.media (drive_connection_id);
create index if not exists message_screens_message_id_organization_id_fkey_idx on public.message_screens (message_id, organization_id);
create index if not exists message_screens_organization_id_fkey_idx on public.message_screens (organization_id);
create index if not exists message_screens_screen_id_organization_id_fkey_idx on public.message_screens (screen_id, organization_id);
create index if not exists messages_created_by_fkey_idx on public.messages (created_by);
create index if not exists organization_users_invited_by_fkey_idx on public.organization_users (invited_by);
create index if not exists organizations_created_by_fkey_idx on public.organizations (created_by);
create index if not exists playlist_items_media_id_organization_id_fkey_idx on public.playlist_items (media_id, organization_id);
create index if not exists playlist_items_organization_id_fkey_idx on public.playlist_items (organization_id);
create index if not exists playlist_items_playlist_id_organization_id_fkey_idx on public.playlist_items (playlist_id, organization_id);
create index if not exists playlists_created_by_fkey_idx on public.playlists (created_by);
create index if not exists schedule_rules_organization_id_fkey_idx on public.schedule_rules (organization_id);
create index if not exists schedule_rules_schedule_id_organization_id_fkey_idx on public.schedule_rules (schedule_id, organization_id);
create index if not exists schedule_rules_screen_group_id_organization_id_fkey_idx on public.schedule_rules (screen_group_id, organization_id);
create index if not exists schedule_rules_screen_id_organization_id_fkey_idx on public.schedule_rules (screen_id, organization_id);
create index if not exists schedules_created_by_fkey_idx on public.schedules (created_by);
create index if not exists schedules_playlist_id_organization_id_fkey_idx on public.schedules (playlist_id, organization_id);
create index if not exists screen_events_media_id_organization_id_fkey_idx on public.screen_events (media_id, organization_id);
create index if not exists screen_events_playlist_id_organization_id_fkey_idx on public.screen_events (playlist_id, organization_id);
create index if not exists screen_events_screen_id_organization_id_fkey_idx on public.screen_events (screen_id, organization_id);
create index if not exists screen_group_members_group_id_organization_id_fkey_idx on public.screen_group_members (group_id, organization_id);
create index if not exists screen_group_members_organization_id_fkey_idx on public.screen_group_members (organization_id);
create index if not exists screen_group_members_screen_id_organization_id_fkey_idx on public.screen_group_members (screen_id, organization_id);
create index if not exists screen_settings_screen_id_organization_id_fkey_idx on public.screen_settings (screen_id, organization_id);
create index if not exists screen_status_current_media_id_organization_id_fkey_idx on public.screen_status (current_media_id, organization_id);
create index if not exists screen_status_current_playlist_id_organization_id_fkey_idx on public.screen_status (current_playlist_id, organization_id);
create index if not exists screen_status_screen_id_organization_id_fkey_idx on public.screen_status (screen_id, organization_id);
create index if not exists screens_default_playlist_id_organization_id_fkey_idx on public.screens (default_playlist_id, organization_id);
create index if not exists screens_paired_by_fkey_idx on public.screens (paired_by);
create index if not exists support_requests_screen_id_organization_id_fkey_idx on public.support_requests (screen_id, organization_id);
