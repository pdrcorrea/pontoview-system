import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  admin,
  cors,
  getDriveAccessToken,
  handleError,
  HttpError,
  requireOrgRole,
  requireUser,
} from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")
    return new Response("Method Not Allowed", { status: 405, headers: cors });

  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const mediaId = String(body.mediaId || "");
    if (!mediaId) throw new HttpError(400, "MEDIA_REQUIRED");

    const { data: media } = await admin
      .from("media")
      .select(
        "id,organization_id,drive_file_id,drive_mime_type,drive_connection_id,status",
      )
      .eq("id", mediaId)
      .single();

    if (
      !media ||
      !media.drive_file_id ||
      !media.drive_connection_id ||
      media.status !== "ready"
    )
      throw new HttpError(404, "MEDIA_NOT_FOUND");

    await requireOrgRole(user.id, media.organization_id, [
      "owner",
      "admin",
      "editor",
      "viewer",
    ]);

    const token = await getDriveAccessToken(media.drive_connection_id);
    const metadataResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(media.drive_file_id)}?fields=thumbnailLink,mimeType`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const metadata = await metadataResponse.json().catch(() => ({}));
    if (!metadataResponse.ok)
      throw new HttpError(502, "DRIVE_THUMBNAIL_METADATA_FAILED");

    let response: Response;
    if (metadata.thumbnailLink) {
      response = await fetch(String(metadata.thumbnailLink));
      if (!response.ok) {
        response = await fetch(String(metadata.thumbnailLink), {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } else if (String(metadata.mimeType || media.drive_mime_type).startsWith("image/")) {
      response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(media.drive_file_id)}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } else {
      throw new HttpError(404, "THUMBNAIL_NOT_AVAILABLE");
    }

    if (!response.ok || !response.body)
      throw new HttpError(502, "DRIVE_THUMBNAIL_FAILED");

    return new Response(response.body, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": response.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleError(error);
  }
});
