import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { admin, cors, getDriveAccessToken, handleError, HttpError, requirePlayer } from "../_shared/common.ts";

const streamCors = {
  ...cors,
  "Access-Control-Allow-Headers": `${cors["Access-Control-Allow-Headers"]}, range`,
  "Access-Control-Expose-Headers": "Content-Type, Content-Length, Content-Range, Accept-Ranges, ETag, Last-Modified",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: streamCors });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: streamCors });

  try {
    const manifest = await requirePlayer(req);
    const body = await req.json();
    const mediaId = String(body.mediaId || "");
    const { data: media } = await admin
      .from("media")
      .select("id,organization_id,drive_file_id,drive_mime_type,drive_connection_id,status")
      .eq("id", mediaId)
      .eq("organization_id", String(manifest.organization.id))
      .single();

    if (!media || !media.drive_file_id || !media.drive_connection_id || media.status !== "ready") {
      throw new HttpError(404, "MEDIA_NOT_FOUND");
    }

    const token = await getDriveAccessToken(media.drive_connection_id);
    const driveHeaders = new Headers({ Authorization: `Bearer ${token}` });
    const requestedRange = req.headers.get("range") || "";
    if (/^bytes=\d*-\d*$/.test(requestedRange)) driveHeaders.set("Range", requestedRange);

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(media.drive_file_id)}?alt=media`,
      { headers: driveHeaders },
    );

    if ((!response.ok && response.status !== 416) || (response.status !== 416 && !response.body)) {
      throw new HttpError(response.status === 404 ? 404 : 502, "DRIVE_DOWNLOAD_FAILED");
    }

    const headers = new Headers(streamCors);
    headers.set("Content-Type", response.headers.get("content-type") || media.drive_mime_type || "application/octet-stream");
    headers.set("Accept-Ranges", response.headers.get("accept-ranges") || "bytes");
    headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Vary", "Range");

    for (const name of ["content-length", "content-range", "etag", "last-modified"]) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }

    return new Response(response.status === 416 ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    return handleError(error);
  }
});
