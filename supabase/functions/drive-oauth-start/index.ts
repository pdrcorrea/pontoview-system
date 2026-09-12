import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  cors,
  handleError,
  HttpError,
  reply,
  requireOrgRole,
  requireUser,
  signState,
} from "../_shared/common.ts";

const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")
    return reply({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const user = await requireUser(req);
    const body = await req.json();
    const organizationId = String(body.organizationId || "");
    let orgId = organizationId;

    if (!orgId) {
      const { admin } = await import("../_shared/common.ts");
      const { data } = await admin
        .from("organization_users")
        .select("organization_id")
        .eq("user_id", user.id)
        .order("created_at")
        .limit(1)
        .single();
      orgId = data?.organization_id || "";
    }

    await requireOrgRole(user.id, orgId, ["owner", "admin"]);

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
    if (!clientId) throw new HttpError(503, "GOOGLE_OAUTH_NOT_CONFIGURED");

    const configuredOrigin = Deno.env.get("APP_ORIGIN") || "";
    if (!configuredOrigin)
      throw new HttpError(503, "APP_ORIGIN_NOT_CONFIGURED");

    let appOrigin: string;
    try {
      appOrigin = new URL(configuredOrigin).origin;
    } catch {
      throw new HttpError(503, "APP_ORIGIN_INVALID");
    }

    const fallbackReturn = `${appOrigin}/conteudo`;
    const requestedReturn = String(body.returnTo || fallbackReturn);
    let returnTo = fallbackReturn;

    try {
      const candidate = new URL(requestedReturn, appOrigin);
      if (candidate.origin === appOrigin) returnTo = candidate.toString();
    } catch {
      returnTo = fallbackReturn;
    }

    const redirectUri =
      Deno.env.get("GOOGLE_REDIRECT_URI") ||
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/drive-oauth-callback`;

    const state = await signState({
      userId: user.id,
      organizationId: orgId,
      returnTo,
      exp: Date.now() + 10 * 60_000,
    });

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", `openid email ${DRIVE_FILE_SCOPE}`);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("include_granted_scopes", "false");
    url.searchParams.set("prompt", "consent select_account");
    url.searchParams.set("state", state);

    return reply({ url: url.toString() });
  } catch (error) {
    return handleError(error);
  }
});
