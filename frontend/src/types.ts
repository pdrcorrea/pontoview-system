export type OrganizationRole = "owner" | "admin" | "editor" | "viewer";
export type MediaType =
  | "drive_image"
  | "drive_video"
  | "youtube"
  | "webpage"
  | "app"
  | "message";

export interface Organization {
  id: string;
  name: string;
  display_name: string;
  slug: string;
  timezone: string;
  locale: string;
  settings: Record<string, unknown>;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
}

export interface Media {
  id: string;
  organization_id: string;
  type: MediaType;
  status: "ready" | "processing" | "unavailable" | "archived";
  name: string;
  description: string | null;
  duration_seconds: number | null;
  online_required: boolean;
  thumbnail_url: string | null;
  drive_file_id: string | null;
  drive_mime_type: string | null;
  youtube_video_id: string | null;
  youtube_options: Record<string, unknown>;
  page_url: string | null;
  app_key: string | null;
  message_content: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  updated_at: string;
}

export interface Playlist {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface Screen {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  orientation: "landscape" | "portrait";
  default_playlist_id: string | null;
  is_active: boolean;
  settings_revision: number;
  reload_revision?: number;
  screen_status?: ScreenStatus | ScreenStatus[] | null;
  screen_settings?: ScreenSettings | ScreenSettings[] | null;
}

export interface ScreenStatus {
  last_seen: string;
  current_media_id: string | null;
  current_playlist_id: string | null;
  player_version: string | null;
  screenshot_url: string | null;
  screenshot_at: string | null;
}

export interface OperatingHours {
  enabled: boolean;
  weekdays: number[];
  start: string;
  end: string;
}

export interface ScreenSettings {
  screen_id: string;
  layout_mode: "fullscreen" | "lframe";
  side_position: "left" | "right";
  bar_position: "top" | "bottom";
  side_width_percent: number;
  bar_height_percent: number;
  widgets: Record<string, boolean>;
  weather_location: {
    name?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  news_categories: string[];
  transition: "fade" | "cut";
  image_duration_seconds: number;
  operating_hours: OperatingHours;
}

export interface DashboardData {
  screensTotal: number;
  screensOnline: number;
  media: number;
  playlists: number;
  activeSchedules: number;
  recentEvents: Array<{
    id: number;
    screen_id: string;
    event_type: string;
    payload: Record<string, unknown>;
    occurred_at: string;
  }>;
}

export interface PlayerManifest {
  screen: { id: string; name: string; orientation: string; revision: number; reloadRevision?: number };
  organization: {
    id: string;
    name: string;
    displayName: string;
    timezone: string;
    locale: string;
    settings: Record<string, unknown>;
  };
  settings: ScreenSettings;
  playlist: {
    id: string;
    name: string;
    revision: number;
    updatedAt: string;
  } | null;
  items: Array<{
    itemId: string;
    position: number;
    durationSeconds: number | null;
    itemSettings: Record<string, unknown>;
    media: {
      id: string;
      type: MediaType;
      status: string;
      name: string;
      durationSeconds: number | null;
      onlineRequired: boolean;
      thumbnailUrl: string | null;
      driveFileId: string | null;
      driveMimeType: string | null;
      driveModifiedTime: string | null;
      driveChecksum: string | null;
      youtubeVideoId: string | null;
      youtubeOptions: Record<string, unknown>;
      pageUrl: string | null;
      appKey: string | null;
      messageContent: Record<string, unknown> | null;
      metadata: Record<string, unknown>;
    };
  }>;
  messages: Array<{ id: string; title: string | null; body: string }>;
  news: Array<{
    id: string;
    source?: string;
    title: string;
    summary: string | null;
    category: string;
    url: string;
    image_url?: string | null;
    published_at: string;
  }>;
  syncedAt: string;
}
