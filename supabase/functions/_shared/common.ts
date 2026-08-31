import { createClient } from "npm:@supabase/supabase-js@2.105.4";

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
export const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-screen-id, x-screen-token, x-signature, x-request-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
export const reply = (body: unknown, status = 200, headers: HeadersInit = {}) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });

export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function handleError(error: unknown) { console.error(error); return error instanceof HttpError ? reply({ error: error.message }, error.status) : reply({ error: "INTERNAL_ERROR" }, 500); }

export async function requireUser(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "AUTH_REQUIRED");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "INVALID_SESSION");
  return data.user;
}

export async function requireOrgRole(userId: string, organizationId: string, roles = ["owner", "admin", "editor", "viewer"]) {
  const { data } = await admin.from("organization_users").select("role").eq("organization_id", organizationId).eq("user_id", userId).maybeSingle();
  if (!data || !roles.includes(data.role)) throw new HttpError(403, "ACCESS_DENIED");
  return data.role as string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const bytesToBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const base64ToBytes = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
const base64Url = (bytes: Uint8Array) => bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function encryptionKey() {
  const secret = Deno.env.get("DRIVE_TOKEN_ENCRYPTION_KEY");
  if (!secret) throw new HttpError(503, "DRIVE_ENCRYPTION_KEY_MISSING");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encrypt(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), encoder.encode(value));
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

export async function decrypt(value: string) {
  const [iv, payload] = value.split(".");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(iv) }, await encryptionKey(), base64ToBytes(payload));
  return decoder.decode(plain);
}

async function hmac(value: string) {
  const secret = Deno.env.get("OAUTH_STATE_SECRET");
  if (!secret) throw new HttpError(503, "OAUTH_STATE_SECRET_MISSING");
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

export async function signState(payload: Record<string, unknown>) {
  const encoded = base64Url(encoder.encode(JSON.stringify(payload)));
  return `${encoded}.${await hmac(encoded)}`;
}

export async function verifyState(value: string) {
  const [payload, signature] = value.split(".");
  if (!payload || !signature || signature !== await hmac(payload)) throw new HttpError(400, "INVALID_OAUTH_STATE");
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const json = decoder.decode(base64ToBytes(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
  const parsed = JSON.parse(json);
  if (!parsed.exp || parsed.exp < Date.now()) throw new HttpError(400, "EXPIRED_OAUTH_STATE");
  return parsed as Record<string, unknown>;
}

export async function getDriveAccessToken(connectionId: string) {
  const [connectionResult, credentialResult] = await Promise.all([
    admin.from("drive_connections").select("id,status,token_expires_at").eq("id", connectionId).single(),
    admin.rpc("get_drive_credentials", { p_connection_id: connectionId }).maybeSingle(),
  ]);
  const connection = connectionResult.data;
  const credentials = credentialResult.data;
  if (connectionResult.error || credentialResult.error || !connection || !credentials || connection.status !== "active") {
    throw new HttpError(401, "DRIVE_CONNECTION_UNAVAILABLE");
  }
  if (credentials.token_expires_at && new Date(credentials.token_expires_at).getTime() > Date.now() + 60_000) {
    return decrypt(credentials.access_token_encrypted);
  }
  if (!credentials.refresh_token_encrypted) throw new HttpError(401, "DRIVE_RECONNECT_REQUIRED");

  const refreshToken = await decrypt(credentials.refresh_token_encrypted);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID") || "",
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const token = await response.json();
  if (!response.ok || !token.access_token) {
    await admin.from("drive_connections").update({ status: "expired" }).eq("id", connectionId);
    throw new HttpError(401, "DRIVE_RECONNECT_REQUIRED");
  }

  const expiresAt = new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString();
  const encryptedAccess = await encrypt(token.access_token);
  const [{ error: credentialSaveError }, { error: connectionSaveError }] = await Promise.all([
    admin.rpc("upsert_drive_credentials", {
      p_connection_id: connectionId,
      p_access_token_encrypted: encryptedAccess,
      p_refresh_token_encrypted: credentials.refresh_token_encrypted,
      p_token_expires_at: expiresAt,
    }),
    admin.from("drive_connections").update({ token_expires_at: expiresAt }).eq("id", connectionId),
  ]);
  if (credentialSaveError || connectionSaveError) throw new HttpError(500, "DRIVE_TOKEN_REFRESH_SAVE_FAILED");
  return String(token.access_token);
}

export async function requirePlayer(req: Request) {
  const screenId = req.headers.get("x-screen-id") || "";
  const token = req.headers.get("x-screen-token") || "";
  if (!screenId || !token) throw new HttpError(401, "PLAYER_AUTH_REQUIRED");
  const { data, error } = await admin.rpc("get_player_manifest", { p_screen_id: screenId, p_token: token });
  if (error || !data) throw new HttpError(401, "INVALID_PLAYER_TOKEN");
  return data as Record<string, any>;
}
