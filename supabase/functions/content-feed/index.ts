import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { admin, cors, handleError, reply } from "../_shared/common.ts";

const allowedTypes = new Set(["news", "curiosity", "culture", "health", "institutional"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const url = new URL(req.url);
    const requestedType = String(url.searchParams.get("type") || "news");
    const contentType = allowedTypes.has(requestedType) ? requestedType : "news";
    const categories = (url.searchParams.get("categories") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 8);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 24), 1), 50);
    const now = new Date().toISOString();

    let query = admin
      .from("content_items")
      .select("id,content_type,category,slug,title,summary,image_url,source_name,source_url,source_author,source_published_at,published_at,expires_at")
      .eq("content_type", contentType)
      .eq("status", "published")
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("published_at", { ascending: false })
      .limit(limit);

    if (categories.length && !categories.includes("general")) query = query.in("category", categories);

    const { data, error } = await query;
    if (error) throw error;

    const items = (data || []).map((item) => ({
      id: item.id,
      type: item.content_type,
      category: item.category,
      slug: item.slug,
      title: item.title,
      summary: item.summary,
      image_url: item.image_url,
      source_name: item.source_name,
      source_url: item.source_url,
      source_author: item.source_author,
      source_published_at: item.source_published_at,
      published_at: item.published_at,
      expires_at: item.expires_at,
    }));

    return reply(
      { items, type: contentType, source: "PontoView Content Hub" },
      200,
      { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" },
    );
  } catch (error) {
    return handleError(error);
  }
});
