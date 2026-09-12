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

const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const BROAD_DRIVE_SCOPES = new Set([
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.metadata",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")
    return reply({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const user = await requireUser(req);
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

    if (!connection)
      return reply({ error: "DRIVE_NOT_CONNECTED" }, 409);

    const scopes = Array.isArray(connection.scopes)
      ? connection.scopes.map(String)
      : [];

    if (
      !scopes.includes(DRIVE_FILE_SCOPE) ||
      scopes.some((scope) => BROAD_DRIVE_SCOPES.has(scope))
    ) {
      return reply({ error: "DRIVE_RECONNECT_REQUIRED" }, 409);
    }

    const accessToken = await getDriveAccessToken(connection.id);
    await admin
      .from("drive_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", connection.id);

    return reply({ accessToken, connectionId: connection.id });
  } catch (error) {
    return handleError(error);
  }
});
