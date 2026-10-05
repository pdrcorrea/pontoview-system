import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { admin, cors, handleError, HttpError, reply, requireUser } from "../_shared/common.ts";

const editorialRoles = new Set(["admin", "editor"]);

async function requireEditorialUser(req: Request) {
  const user = await requireUser(req);
  const role = String(user.app_metadata?.content_hub_role || "");
  if (!editorialRoles.has(role)) throw new HttpError(403, "CONTENT_HUB_ACCESS_DENIED");
  return { user, role };
}

function safeStatus(value: string) {
  return ["imported", "review", "approved", "published", "rejected", "expired", "archived"].includes(value) ? value : "review";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { user } = await requireEditorialUser(req);

    if (req.method === "GET") {
      const url = new URL(req.url);
      const status = safeStatus(url.searchParams.get("status") || "review");
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 40), 1), 100);

      const { data, error } = await admin
        .from("content_items")
        .select("id,content_type,category,slug,title,summary,image_url,source_name,source_url,source_author,source_published_at,status,editorial_flags,review_notes,imported_at,reviewed_at,published_at,expires_at,created_at,updated_at")
        .eq("content_type", "news")
        .eq("status", status)
        .order(status === "published" ? "published_at" : "imported_at", { ascending: false })
        .limit(limit);
      if (error) throw error;

      return reply({ items: data || [], status });
    }

    if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);

    const body = await req.json();
    const id = String(body.id || "");
    const action = String(body.action || "");
    const reviewNotes = typeof body.review_notes === "string" ? body.review_notes.trim().slice(0, 2000) || null : null;
    if (!id) throw new HttpError(400, "CONTENT_ID_REQUIRED");

    const { data: current, error: currentError } = await admin
      .from("content_items")
      .select("id,status,title,source_name")
      .eq("id", id)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) throw new HttpError(404, "CONTENT_NOT_FOUND");

    const now = new Date().toISOString();
    let patch: Record<string, unknown>;

    switch (action) {
      case "approve":
        if (!["imported", "review"].includes(current.status)) throw new HttpError(409, "CONTENT_NOT_REVIEWABLE");
        patch = { status: "approved", reviewed_at: now, review_notes: reviewNotes };
        break;
      case "reject":
        if (!["imported", "review", "approved"].includes(current.status)) throw new HttpError(409, "CONTENT_NOT_REJECTABLE");
        patch = { status: "rejected", reviewed_at: now, review_notes: reviewNotes };
        break;
      case "publish":
        if (current.status !== "approved") throw new HttpError(409, "CONTENT_MUST_BE_APPROVED_FIRST");
        patch = { status: "published", published_at: now, review_notes: reviewNotes };
        break;
      case "approve_and_publish":
        if (!["imported", "review"].includes(current.status)) throw new HttpError(409, "CONTENT_NOT_REVIEWABLE");
        patch = { status: "published", reviewed_at: now, published_at: now, review_notes: reviewNotes };
        break;
      default:
        throw new HttpError(400, "INVALID_EDITORIAL_ACTION");
    }

    const { data, error } = await admin
      .from("content_items")
      .update(patch)
      .eq("id", id)
      .select("id,status,reviewed_at,published_at,updated_at")
      .single();
    if (error) throw error;

    await admin.from("content_revisions").insert({
      content_item_id: id,
      changed_by: user.id,
      change_type: `editorial:${action}`,
      snapshot: { action, from_status: current.status, to_status: data.status, review_notes: reviewNotes },
    });

    return reply({ item: data, action });
  } catch (error) {
    return handleError(error);
  }
});
