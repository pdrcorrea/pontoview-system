import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { admin, cors, handleError, reply, requirePlayer } from "../_shared/common.ts";
import { classifyNews, editorialCheck } from "../_shared/news-editorial.ts";

type PlayerNews = {
  id: string;
  source: string;
  category: string;
  title: string;
  summary: string | null;
  url: string | null;
  image_url: string | null;
  published_at: string;
  content_id?: string;
};

function filterCategories(items: PlayerNews[], categories: string[]) {
  if (!items.length) return items;
  if (!categories.length || categories.includes("general")) return items;
  return items.filter((item) => categories.includes(item.category || "general"));
}

function applyLocalCategory(item: PlayerNews, localQuery: string): PlayerNews {
  if (!localQuery) return item;
  return classifyNews(item.title, item.summary || "", localQuery) === "local" ? { ...item, category: "local" } : item;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const manifest = await requirePlayer(req);
    const categories = Array.isArray(manifest.settings?.news_categories)
      ? manifest.settings.news_categories.slice(0, 6).map(String)
      : ["general"];
    const localQuery = String(
      manifest.organization?.settings?.localNewsQuery || manifest.settings?.weather_location?.name || "",
    ).split(/[·,]/)[0].trim();
    const now = new Date().toISOString();

    const { data: centralRows, error: centralError } = await admin
      .from("content_items")
      .select("id,category,title,summary,source_name,source_url,image_url,source_published_at,published_at,expires_at")
      .eq("content_type", "news")
      .eq("status", "published")
      .lte("published_at", now)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("published_at", { ascending: false })
      .limit(80);
    if (centralError) throw centralError;

    const centralItems = filterCategories(
      (centralRows || []).map((item): PlayerNews => applyLocalCategory({
        id: item.id,
        content_id: item.id,
        source: item.source_name,
        category: item.category || "general",
        title: item.title,
        summary: item.summary,
        url: item.source_url,
        image_url: item.image_url,
        published_at: item.source_published_at || item.published_at,
      }, localQuery)),
      categories,
    ).slice(0, 16);

    if (centralItems.length >= 6) {
      return reply({
        items: centralItems,
        cached: true,
        source: "PontoView Content Hub",
        editorialFilter: "reviewed",
        migrationFallback: false,
      });
    }

    const { data: legacyRows } = await admin
      .from("news_cache")
      .select("id,source,category,title,summary,url,image_url,published_at")
      .order("published_at", { ascending: false })
      .limit(80);

    const centralUrls = new Set(centralItems.map((item) => item.url).filter(Boolean));
    const legacyItems = filterCategories(
      ((legacyRows || []) as Record<string, unknown>[])
        .filter((item) => editorialCheck(item).allowed)
        .map((item): PlayerNews => applyLocalCategory({
          id: String(item.id),
          source: String(item.source || "PontoView Notícias"),
          category: String(item.category || "general"),
          title: String(item.title || ""),
          summary: item.summary ? String(item.summary) : null,
          url: item.url ? String(item.url) : null,
          image_url: item.image_url ? String(item.image_url) : null,
          published_at: String(item.published_at || now),
        }, localQuery))
        .filter((item) => item.title && (!item.url || !centralUrls.has(item.url))),
      categories,
    );

    const items = [...centralItems, ...legacyItems].slice(0, 16);
    return reply({
      items,
      cached: true,
      stale: centralItems.length === 0,
      source: centralItems.length ? "PontoView Content Hub + legado" : "PontoView legado",
      editorialFilter: centralItems.length ? "reviewed" : "public-safe-legacy",
      migrationFallback: true,
    });
  } catch (error) {
    return handleError(error);
  }
});
