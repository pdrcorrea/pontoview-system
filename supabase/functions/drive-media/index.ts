import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  admin,
  cors,
  getDriveAccessToken,
  handleError,
  HttpError,
  requirePlayer,
  SUPABASE_URL,
} from "../_shared/common.ts";

const streamCors = {
  ...cors,
  "Access-Control-Allow-Headers": `${cors["Access-Control-Allow-Headers"]}, range`,
  "Access-Control-Expose-Headers": "Content-Type, Content-Length, Content-Range, Accept-Ranges, ETag, Last-Modified",
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const CHUNK_BYTES = 16 * 1024 * 1024;
const tokenCache = new Map<string, { token: string; expiresAt: number }>();
const metadataRepairs = new Map<string, Promise<void>>();

function bytesToBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));
}

async function ticketKey() {
  const secret =
    Deno.env.get("OAUTH_STATE_SECRET") ||
    Deno.env.get("DRIVE_TOKEN_ENCRYPTION_KEY");
  if (!secret) throw new HttpError(503, "STREAM_SIGNING_SECRET_MISSING");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function createTicket(payload: {
  mediaId: string;
  organizationId: string;
  exp: number;
}) {
  const encoded = bytesToBase64Url(
    encoder.encode(JSON.stringify(payload)),
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      await ticketKey(),
      encoder.encode(encoded),
    ),
  );
  return `${encoded}.${bytesToBase64Url(signature)}`;
}

async function readTicket(ticket: string) {
  const [encoded, signature] = ticket.split(".");
  if (!encoded || !signature)
    throw new HttpError(401, "INVALID_STREAM_TICKET");
  const valid = await crypto.subtle.verify(
    "HMAC",
    await ticketKey(),
    base64UrlToBytes(signature),
    encoder.encode(encoded),
  );
  if (!valid) throw new HttpError(401, "INVALID_STREAM_TICKET");
  const payload = JSON.parse(decoder.decode(base64UrlToBytes(encoded)));
  if (
    !payload?.mediaId ||
    !payload?.organizationId ||
    Number(payload.exp || 0) < Date.now()
  ) {
    throw new HttpError(401, "EXPIRED_STREAM_TICKET");
  }
  return payload as {
    mediaId: string;
    organizationId: string;
    exp: number;
  };
}

async function loadMedia(mediaId: string, organizationId: string) {
  const { data: media } = await admin
    .from("media")
    .select(
      "id,organization_id,drive_file_id,drive_mime_type,drive_connection_id,drive_modified_time,drive_checksum,status",
    )
    .eq("id", mediaId)
    .eq("organization_id", organizationId)
    .single();

  if (
    !media ||
    !media.drive_file_id ||
    !media.drive_connection_id ||
    media.status !== "ready"
  ) {
    throw new HttpError(404, "MEDIA_NOT_FOUND");
  }
  return media;
}

async function accessToken(connectionId: string) {
  const cached = tokenCache.get(connectionId);
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  const token = await getDriveAccessToken(connectionId);
  tokenCache.set(connectionId, {
    token,
    expiresAt: Date.now() + 4 * 60_000,
  });
  return token;
}

async function repairDriveMetadata(media: any) {
  if (media.drive_modified_time || media.drive_checksum) return;

  const repairKey = `${media.organization_id}:${media.id}`;
  const existing = metadataRepairs.get(repairKey);
  if (existing) return existing;

  const repair = (async () => {
    try {
      const token = await accessToken(String(media.drive_connection_id));
      const url = new URL(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(media.drive_file_id)}`,
      );
      url.searchParams.set("fields", "modifiedTime,md5Checksum,mimeType");
      url.searchParams.set("supportsAllDrives", "true");

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;

      const metadata = await response.json();
      const modifiedTime = metadata?.modifiedTime
        ? String(metadata.modifiedTime)
        : null;
      const checksum = metadata?.md5Checksum
        ? String(metadata.md5Checksum)
        : null;
      const mimeType = metadata?.mimeType
        ? String(metadata.mimeType)
        : media.drive_mime_type;

      const { error } = await admin
        .from("media")
        .update({
          drive_modified_time: modifiedTime,
          drive_checksum: checksum,
          drive_mime_type: mimeType,
        })
        .eq("id", media.id)
        .eq("organization_id", media.organization_id)
        .eq("drive_connection_id", media.drive_connection_id);

      if (error) {
        console.warn("DRIVE_METADATA_REPAIR_SAVE_FAILED", {
          mediaId: media.id,
          code: error.code,
        });
      }
    } catch (error) {
      console.warn("DRIVE_METADATA_REPAIR_FAILED", {
        mediaId: media.id,
        detail: error instanceof Error ? error.message : "unknown",
      });
    }
  })().finally(() => metadataRepairs.delete(repairKey));

  metadataRepairs.set(repairKey, repair);
  return repair;
}

function normalizedRange(value: string | null) {
  if (!value) return null;
  const match = /^bytes=(\d+)-(\d*)$/i.exec(value.trim());
  if (!match) return value;
  const start = Number(match[1]);
  if (!Number.isFinite(start)) return value;
  if (match[2]) return value;
  return `bytes=${start}-${start + CHUNK_BYTES - 1}`;
}

async function proxyDrive(req: Request, media: any) {
  const token = await accessToken(String(media.drive_connection_id));
  const headers = new Headers({ Authorization: `Bearer ${token}` });
  const range = normalizedRange(req.headers.get("range"));
  if (range) headers.set("Range", range);

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(media.drive_file_id)}?alt=media`,
    { headers },
  );

  if (
    (!response.ok && response.status !== 416) ||
    (response.status !== 416 && !response.body)
  ) {
    throw new HttpError(
      response.status === 404 ? 404 : 502,
      "DRIVE_DOWNLOAD_FAILED",
    );
  }

  const out = new Headers(streamCors);
  out.set(
    "Content-Type",
    response.headers.get("content-type") ||
      media.drive_mime_type ||
      "application/octet-stream",
  );
  out.set("Accept-Ranges", "bytes");
  out.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  out.set("Pragma", "no-cache");
  out.set("Vary", "Range");
  for (const name of ["content-length", "content-range", "etag", "last-modified"]) {
    const value = response.headers.get(name);
    if (value) out.set(name, value);
  }

  return new Response(
    req.method === "HEAD" || response.status === 416 ? null : response.body,
    {
      status: response.status,
      statusText: response.statusText,
      headers: out,
    },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: streamCors });

  try {
    if (req.method === "GET" || req.method === "HEAD") {
      const ticket = new URL(req.url).searchParams.get("ticket") || "";
      const payload = await readTicket(ticket);
      const media = await loadMedia(payload.mediaId, payload.organizationId);
      return await proxyDrive(req, media);
    }

    if (req.method !== "POST")
      return new Response("Method Not Allowed", {
        status: 405,
        headers: streamCors,
      });

    const manifest = await requirePlayer(req);
    const body = await req.json().catch(() => ({}));
    const mediaId = String(body.mediaId || "");
    const organizationId = String(manifest.organization.id);
    const media = await loadMedia(mediaId, organizationId);

    if (body.action === "ticket") {
      if (!media.drive_modified_time && !media.drive_checksum) {
        await repairDriveMetadata(media);
      }
      const freshMedia =
        !media.drive_modified_time && !media.drive_checksum
          ? await loadMedia(mediaId, organizationId)
          : media;

      const exp = Date.now() + 15 * 60_000;
      const ticket = await createTicket({ mediaId, organizationId, exp });
      return new Response(
        JSON.stringify({
          streamUrl: `${SUPABASE_URL}/functions/v1/drive-media?ticket=${encodeURIComponent(ticket)}`,
          mimeType: freshMedia.drive_mime_type || "application/octet-stream",
          driveModifiedTime: freshMedia.drive_modified_time || null,
          driveChecksum: freshMedia.drive_checksum || null,
          expiresAt: new Date(exp).toISOString(),
        }),
        {
          status: 200,
          headers: {
            ...streamCors,
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          },
        },
      );
    }

    return await proxyDrive(req, media);
  } catch (error) {
    return handleError(error);
  }
});
