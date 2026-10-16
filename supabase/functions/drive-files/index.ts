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
const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const IMPORT_CONCURRENCY = 5;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  );
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const requestedConnectionId = String(body.connectionId || "").trim();
    const requestedOrganizationId = String(body.organizationId || "").trim();

    let connection: any = null;

    if (requestedConnectionId) {
      let query = admin
        .from("drive_connections")
        .select("id,organization_id,scopes")
        .eq("id", requestedConnectionId)
        .eq("status", "active");

      if (requestedOrganizationId) {
        query = query.eq("organization_id", requestedOrganizationId);
      }

      const result = await query.maybeSingle();
      connection = result.data;
    } else {
      let orgId = requestedOrganizationId;
      if (!orgId) {
        const { data: membership } = await admin
          .from("organization_users")
          .select("organization_id")
          .eq("user_id", user.id)
          .order("created_at")
          .limit(1)
          .maybeSingle();
        orgId = String(membership?.organization_id || "");
      }

      await requireOrgRole(user.id, orgId, ["owner", "admin", "editor"]);
      const result = await admin
        .from("drive_connections")
        .select("id,organization_id,scopes")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      connection = result.data;
    }

    if (!connection) return reply({ error: "DRIVE_NOT_CONNECTED" }, 409);

    await requireOrgRole(user.id, String(connection.organization_id), [
      "owner",
      "admin",
      "editor",
    ]);

    const scopes = Array.isArray(connection.scopes)
      ? connection.scopes.map(String)
      : [];
    if (!scopes.includes(DRIVE_FILE_SCOPE)) {
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
    const results = await mapWithConcurrency(
      requestedIds,
      IMPORT_CONCURRENCY,
      async (fileId) => {
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
      },
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
        organizationId: connection.organization_id,
        isFolder: false,
      }));

    if (!files.length) {
      return reply({ error: "DRIVE_SELECTED_FILES_UNAVAILABLE" }, 422);
    }

    await admin
      .from("drive_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", connection.id)
      .eq("organization_id", connection.organization_id);

    return reply({ files });
  } catch (error) {
    if (error instanceof Error && error.message === "DRIVE_FILE_GET_FAILED") {
      return reply({ error: "DRIVE_LIST_FAILED" }, 502);
    }
    return handleError(error);
  }
});
