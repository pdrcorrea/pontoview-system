import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  admin,
  cors,
  getDriveAccessToken,
  handleError,
  reply,
  requireOrgRole,
  requireUser,
} from "../_shared/common.ts";

const FILE_FIELDS =
  "id,name,mimeType,thumbnailLink,modifiedTime,md5Checksum,size,videoMediaMetadata,parents";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")
    return reply({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const user = await requireUser(req);
    const body = await req.json();

    const { data: membership } = await admin
      .from("organization_users")
      .select("organization_id")
      .eq("user_id", user.id)
      .order("created_at")
      .limit(1)
      .single();

    const orgId = membership?.organization_id || "";
    await requireOrgRole(user.id, orgId, ["owner", "admin", "editor"]);

    const { data: connection } = await admin
      .from("drive_connections")
      .select("id,scopes")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!connection) return reply({ error: "DRIVE_NOT_CONNECTED" }, 409);

    const scopes = Array.isArray(connection.scopes)
      ? connection.scopes.map(String)
      : [];
    if (!scopes.includes("https://www.googleapis.com/auth/drive.file")) {
      return reply({ error: "DRIVE_RECONNECT_REQUIRED" }, 409);
    }

    const requestedIds = Array.isArray(body.fileIds)
      ? Array.from(
          new Set(
            body.fileIds
              .map((value: unknown) => String(value || "").trim())
              .filter(Boolean),
          ),
        ).slice(0, 100)
      : [];

    if (!requestedIds.length) {
      return reply({ error: "DRIVE_FILE_IDS_REQUIRED" }, 400);
    }

    const token = await getDriveAccessToken(connection.id);

    const results = await Promise.all(
      requestedIds.map(async (fileId) => {
        const url = new URL(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
        );
        url.searchParams.set("fields", FILE_FIELDS);
        url.searchParams.set("supportsAllDrives", "true");

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 404 || response.status === 403) {
          console.warn("DRIVE_FILE_SKIPPED", {
            fileId,
            status: response.status,
          });
          return null;
        }

        if (!response.ok) {
          console.error("DRIVE_FILE_GET_FAILED", {
            fileId,
            status: response.status,
          });
          throw new Error("DRIVE_FILE_GET_FAILED");
        }

        return await response.json();
      }),
    );

    const files = results
      .filter(Boolean)
      .filter(
        (file: any) =>
          file.mimeType?.startsWith("image/") ||
          file.mimeType?.startsWith("video/"),
      )
      .map((file: any) => ({
        ...file,
        connectionId: connection.id,
        isFolder: false,
      }));

    if (!files.length) {
      return reply({ error: "DRIVE_SELECTED_FILES_UNAVAILABLE" }, 422);
    }

    await admin
      .from("drive_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", connection.id);

    return reply({ files });
  } catch (error) {
    if (error instanceof Error && error.message === "DRIVE_FILE_GET_FAILED") {
      return reply({ error: "DRIVE_LIST_FAILED" }, 502);
    }
    return handleError(error);
  }
});
