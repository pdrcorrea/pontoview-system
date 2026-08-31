import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { admin, encrypt, handleError, HttpError, verifyState } from "../_shared/common.ts";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const state = await verifyState(url.searchParams.get("state") || "");
    const returnTo = String(state.returnTo);
    if (url.searchParams.get("error")) {
      return Response.redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}drive=denied`, 302);
    }

    const code = url.searchParams.get("code");
    if (!code) throw new HttpError(400, "MISSING_AUTHORIZATION_CODE");

    const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI") || `${Deno.env.get("SUPABASE_URL")}/functions/v1/drive-oauth-callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get("GOOGLE_CLIENT_ID") || "",
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") || "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.access_token) throw new HttpError(400, "GOOGLE_TOKEN_EXCHANGE_FAILED");

    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser = await userInfoResponse.json();
    if (!userInfoResponse.ok || !googleUser.sub) throw new HttpError(400, "GOOGLE_ACCOUNT_LOOKUP_FAILED");

    const expiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString();
    const { data: connection, error } = await admin.from("drive_connections").upsert({
      organization_id: String(state.organizationId),
      connected_by: String(state.userId),
      google_account_id: String(googleUser.sub),
      google_email: String(googleUser.email || ""),
      scopes: String(tokens.scope || "").split(" ").filter(Boolean),
      status: "active",
      token_expires_at: expiresAt,
    }, { onConflict: "organization_id,google_account_id" }).select("id").single();
    if (error || !connection) throw new HttpError(500, "DRIVE_CONNECTION_SAVE_FAILED");

    const { data: existing, error: existingError } = await admin
      .rpc("get_drive_credentials", { p_connection_id: connection.id })
      .maybeSingle();
    if (existingError) throw new HttpError(500, "DRIVE_CREDENTIAL_LOOKUP_FAILED");

    const accessTokenEncrypted = await encrypt(tokens.access_token);
    const refreshTokenEncrypted = tokens.refresh_token
      ? await encrypt(tokens.refresh_token)
      : existing?.refresh_token_encrypted || null;
    if (!refreshTokenEncrypted) throw new HttpError(400, "GOOGLE_REFRESH_TOKEN_MISSING");

    const { error: saveError } = await admin.rpc("upsert_drive_credentials", {
      p_connection_id: connection.id,
      p_access_token_encrypted: accessTokenEncrypted,
      p_refresh_token_encrypted: refreshTokenEncrypted,
      p_token_expires_at: expiresAt,
    });
    if (saveError) throw new HttpError(500, "DRIVE_CREDENTIAL_SAVE_FAILED");

    return Response.redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}drive=connected`, 302);
  } catch (error) {
    const response = handleError(error);
    return new Response(await response.text(), {
      status: response.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
});
