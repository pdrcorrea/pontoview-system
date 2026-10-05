import "jsr:@supabase/functions-js@2.4.4/edge-runtime.d.ts";
import { admin, cors, handleError, HttpError, reply, requireUser } from "../_shared/common.ts";

const editorialRoles = new Set(["admin", "editor"]);
const itemStatuses = ["imported", "review", "approved", "published", "rejected", "expired", "archived"] as const;
const sourceTypes = new Set(["rss", "api", "manual", "partner"]);

async function requireEditorialUser(req: Request) {
  const user = await requireUser(req);
  const role = String(user.app_metadata?.content_hub_role || "");
  if (!editorialRoles.has(role)) throw new HttpError(403, "CONTENT_HUB_ACCESS_DENIED");
  return { user, role };
}

function requireAdmin(role: string) {
  if (role !== "admin") throw new HttpError(403, "CONTENT_HUB_ADMIN_REQUIRED");
}

function text(value: unknown, max = 1000) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, max) : null;
}

function optionalMultiline(value: unknown, max = 4000) {
  const normalized = String(value ?? "").replace(/\r\n/g, "\n").trim();
  return normalized ? normalized.slice(0, max) : null;
}

function slugify(value: unknown) {
  return String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

function safeStatus(value: unknown) {
  const status = String(value || "review");
  return itemStatuses.includes(status as typeof itemStatuses[number]) ? status : "review";
}

function isoOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new HttpError(400, "INVALID_DATE");
  return parsed.toISOString();
}

const itemSelect = "id,source_id,content_type,category,slug,title,summary,body,image_url,source_name,source_url,source_author,source_published_at,status,editorial_flags,review_notes,imported_at,reviewed_at,published_at,expires_at,created_at,updated_at";

async function listItems(body: Record<string, unknown>) {
  const status = safeStatus(body.status);
  const limit = Math.min(Math.max(Number(body.limit || 60), 1), 100);
  const search = text(body.search, 160);
  const category = text(body.category, 80);

  let query = admin.from("content_items").select(itemSelect).eq("content_type", "news").eq("status", status);
  if (search) query = query.or(`title.ilike.%${search.replace(/[%_,()]/g, "") }%,source_name.ilike.%${search.replace(/[%_,()]/g, "") }%`);
  if (category && category !== "all") query = query.eq("category", category);

  const { data, error } = await query
    .order(status === "published" ? "published_at" : "imported_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return { items: data || [], status };
}

async function dashboard() {
  const now = new Date().toISOString();
  const count = (status: string) => admin.from("content_items").select("id", { count: "exact", head: true }).eq("content_type", "news").eq("status", status);
  const [review, approved, published, rejected, expired, archived, scheduled, sources, latest] = await Promise.all([
    count("review"), count("approved"), count("published"), count("rejected"), count("expired"), count("archived"),
    admin.from("content_items").select("id", { count: "exact", head: true }).eq("content_type", "news").eq("status", "published").gt("published_at", now),
    admin.from("content_sources").select("id,name,slug,source_type,is_active,last_ingested_at,last_ingest_status,last_ingest_count,last_ingest_error").order("name"),
    admin.from("content_items").select("id,title,source_name,status,category,imported_at,published_at,image_url").eq("content_type", "news").order("updated_at", { ascending: false }).limit(6),
  ]);
  for (const result of [review, approved, published, rejected, expired, archived, scheduled, sources, latest]) if (result.error) throw result.error;
  return {
    counts: {
      review: review.count || 0,
      approved: approved.count || 0,
      published: Math.max(0, (published.count || 0) - (scheduled.count || 0)),
      scheduled: scheduled.count || 0,
      rejected: rejected.count || 0,
      expired: expired.count || 0,
      archived: archived.count || 0,
    },
    sources: sources.data || [],
    recent: latest.data || [],
  };
}

async function listSources() {
  const { data, error } = await admin.from("content_sources")
    .select("id,name,slug,source_type,site_url,feed_url,default_content_type,default_category,is_active,requires_review,trust_level,attribution_label,license_notes,last_ingested_at,last_ingest_status,last_ingest_count,last_ingest_error,created_at,updated_at")
    .order("name");
  if (error) throw error;
  return { sources: data || [] };
}

async function saveRevision(itemId: string, userId: string, changeType: string, snapshot: Record<string, unknown>) {
  const { error } = await admin.from("content_revisions").insert({ content_item_id: itemId, changed_by: userId, change_type: changeType, snapshot });
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { user, role } = await requireEditorialUser(req);

    if (req.method === "GET") {
      const url = new URL(req.url);
      const view = url.searchParams.get("view") || "items";
      if (view === "dashboard") return reply(await dashboard());
      if (view === "sources") return reply(await listSources());
      return reply(await listItems({
        status: url.searchParams.get("status") || "review",
        limit: url.searchParams.get("limit") || "60",
        search: url.searchParams.get("search") || "",
        category: url.searchParams.get("category") || "all",
      }));
    }

    if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action || "");

    if (action === "dashboard") return reply(await dashboard());
    if (action === "list_items") return reply(await listItems(body));
    if (action === "list_sources") return reply(await listSources());

    if (["create_source", "update_source", "toggle_source"].includes(action)) {
      requireAdmin(role);
      if (action === "create_source") {
        const name = text(body.name, 160);
        const slug = slugify(body.slug || name);
        const sourceType = sourceTypes.has(String(body.source_type || "api")) ? String(body.source_type || "api") : "api";
        if (!name || !slug) throw new HttpError(400, "SOURCE_NAME_REQUIRED");
        const { data, error } = await admin.from("content_sources").insert({
          name,
          slug,
          source_type: sourceType,
          site_url: text(body.site_url, 1200),
          feed_url: text(body.feed_url, 1200),
          default_content_type: "news",
          default_category: text(body.default_category, 80) || "general",
          is_active: body.is_active !== false,
          requires_review: body.requires_review !== false,
          trust_level: Math.min(Math.max(Number(body.trust_level ?? 1), 0), 5),
          attribution_label: text(body.attribution_label, 300),
          license_notes: optionalMultiline(body.license_notes, 3000),
        }).select().single();
        if (error) throw error;
        return reply({ source: data, action });
      }

      const sourceId = String(body.source_id || "");
      if (!sourceId) throw new HttpError(400, "SOURCE_ID_REQUIRED");
      if (action === "toggle_source") {
        const { data, error } = await admin.from("content_sources").update({ is_active: Boolean(body.is_active) }).eq("id", sourceId).select().single();
        if (error) throw error;
        return reply({ source: data, action });
      }

      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) patch.name = text(body.name, 160);
      if (body.slug !== undefined) patch.slug = slugify(body.slug);
      if (body.source_type !== undefined && sourceTypes.has(String(body.source_type))) patch.source_type = String(body.source_type);
      if (body.site_url !== undefined) patch.site_url = text(body.site_url, 1200);
      if (body.feed_url !== undefined) patch.feed_url = text(body.feed_url, 1200);
      if (body.default_category !== undefined) patch.default_category = text(body.default_category, 80) || "general";
      if (body.requires_review !== undefined) patch.requires_review = Boolean(body.requires_review);
      if (body.trust_level !== undefined) patch.trust_level = Math.min(Math.max(Number(body.trust_level), 0), 5);
      if (body.attribution_label !== undefined) patch.attribution_label = text(body.attribution_label, 300);
      if (body.license_notes !== undefined) patch.license_notes = optionalMultiline(body.license_notes, 3000);
      const { data, error } = await admin.from("content_sources").update(patch).eq("id", sourceId).select().single();
      if (error) throw error;
      return reply({ source: data, action });
    }

    const id = String(body.id || "");
    if (!id) throw new HttpError(400, "CONTENT_ID_REQUIRED");
    const { data: current, error: currentError } = await admin.from("content_items").select(itemSelect).eq("id", id).maybeSingle();
    if (currentError) throw currentError;
    if (!current) throw new HttpError(404, "CONTENT_NOT_FOUND");

    const now = new Date().toISOString();
    const reviewNotes = body.review_notes !== undefined ? optionalMultiline(body.review_notes, 2000) : current.review_notes;
    let patch: Record<string, unknown> = {};

    switch (action) {
      case "update_item": {
        if (current.status === "archived") throw new HttpError(409, "ARCHIVED_CONTENT_IS_READ_ONLY");
        if (body.title !== undefined) {
          const title = text(body.title, 300);
          if (!title) throw new HttpError(400, "TITLE_REQUIRED");
          patch.title = title;
        }
        if (body.summary !== undefined) patch.summary = optionalMultiline(body.summary, 1200);
        if (body.body !== undefined) patch.body = optionalMultiline(body.body, 12000);
        if (body.image_url !== undefined) patch.image_url = text(body.image_url, 1500);
        if (body.category !== undefined) patch.category = text(body.category, 80) || "general";
        if (body.source_author !== undefined) patch.source_author = text(body.source_author, 180);
        if (body.expires_at !== undefined) patch.expires_at = isoOrNull(body.expires_at);
        if (body.review_notes !== undefined) patch.review_notes = reviewNotes;
        break;
      }
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
      case "schedule": {
        if (current.status !== "approved") throw new HttpError(409, "CONTENT_MUST_BE_APPROVED_FIRST");
        const publishAt = isoOrNull(body.publish_at);
        if (!publishAt || new Date(publishAt).getTime() <= Date.now()) throw new HttpError(400, "SCHEDULE_MUST_BE_FUTURE");
        patch = { status: "published", published_at: publishAt, review_notes: reviewNotes };
        break;
      }
      case "expire":
        if (current.status !== "published") throw new HttpError(409, "CONTENT_NOT_PUBLISHED");
        patch = { status: "expired", expires_at: now, review_notes: reviewNotes };
        break;
      case "archive":
        if (current.status === "archived") throw new HttpError(409, "CONTENT_ALREADY_ARCHIVED");
        patch = { status: "archived", review_notes: reviewNotes };
        break;
      case "restore_to_review":
        if (!["rejected", "expired", "archived"].includes(current.status)) throw new HttpError(409, "CONTENT_NOT_RESTORABLE");
        patch = { status: "review", reviewed_at: null, published_at: null, expires_at: null, review_notes: reviewNotes };
        break;
      default:
        throw new HttpError(400, "INVALID_EDITORIAL_ACTION");
    }

    const { data, error } = await admin.from("content_items").update(patch).eq("id", id).select(itemSelect).single();
    if (error) throw error;
    await saveRevision(id, user.id, `editorial:${action}`, { action, from_status: current.status, to_status: data.status, patch });
    return reply({ item: data, action });
  } catch (error) {
    return handleError(error);
  }
});
