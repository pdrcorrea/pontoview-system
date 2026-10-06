import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-screen-id, x-screen-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function requirePlayer(req: Request) {
  const screenId = req.headers.get("x-screen-id") || "";
  const token = req.headers.get("x-screen-token") || "";
  if (!screenId || !token) throw new Error("PLAYER_AUTH_REQUIRED");
  const { data, error } = await admin.rpc("get_player_context", { p_screen_id: screenId, p_token: token });
  if (error || !data) throw new Error("INVALID_PLAYER_TOKEN");
  return data as Record<string, any>;
}

function normalize(value: unknown) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function safeLegacy(item: Record<string, unknown>) {
  const title = normalize(item.title);
  const url = normalize(item.url);
  const blocked = ["veja", "entenda", "saiba", "confira", "descubra", "assista", "clique", "leia", "conheca", "aprenda", "relembre"];
  if (blocked.some((term) => new RegExp(`(^|[^a-z0-9])${term}([^a-z0-9]|$)`).test(title))) return false;
  if (title.includes("o que se sabe") || title.includes("o que sabemos") || title.includes("passo a passo") || title.includes("onde assistir") || title.includes("melhores momentos")) return false;
  if (/\?$/.test(title.trim())) return false;
  if (url.includes("/opiniao/") || url.includes("/coluna/") || url.includes("/colunas/") || url.includes("/blog/") || url.includes("/blogs/")) return false;
  return true;
}

function filterCategories<T extends { category?: string }>(items: T[], categories: string[]) {
  if (!categories.length || categories.includes("general")) return items;
  return items.filter((item) => categories.includes(String(item.category || "general")));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const manifest = await requirePlayer(req);
    const categories = Array.isArray(manifest.settings?.news_categories)
      ? manifest.settings.news_categories.slice(0, 6).map(String)
      : ["general"];
    const now = new Date().toISOString();

    const { data: centralRows, error: centralError } = await admin
      .from("content_items")
      .select("id,category,title,summary,source_name,source_url,image_url,source_published_at,published_at,expires_at")
      .eq("content_type", "news")
      .eq("status", "published")
      .lte("published_at", now)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("source_published_at", { ascending: false, nullsFirst: false })
      .limit(50);
    if (centralError) throw centralError;

    const centralItems = filterCategories((centralRows || []).map((item) => ({
      id: item.id,
      content_id: item.id,
      source: item.source_name,
      category: item.category || "general",
      title: item.title,
      summary: item.summary,
      url: item.source_url,
      image_url: item.image_url,
      published_at: item.source_published_at || item.published_at,
    })), categories).slice(0, 16);

    if (centralItems.length >= 5) {
      return reply({
        items: centralItems,
        cached: true,
        source: "PontoView Content Hub",
        migrationFallback: false,
      });
    }

    const { data: legacyRows } = await admin
      .from("news_cache")
      .select("id,source,category,title,summary,url,image_url,published_at")
      .order("published_at", { ascending: false })
      .limit(80);

    const centralUrls = new Set(centralItems.map((item) => item.url).filter(Boolean));
    const legacyItems = filterCategories(((legacyRows || []) as Record<string, unknown>[])
      .filter(safeLegacy)
      .map((item) => ({
        id: String(item.id),
        source: String(item.source || "PontoView Notícias"),
        category: String(item.category || "general"),
        title: String(item.title || ""),
        summary: item.summary ? String(item.summary) : null,
        url: item.url ? String(item.url) : null,
        image_url: item.image_url ? String(item.image_url) : null,
        published_at: String(item.published_at || now),
      }))
      .filter((item) => item.title && (!item.url || !centralUrls.has(item.url))), categories);

    return reply({
      items: [...centralItems, ...legacyItems].slice(0, 16),
      cached: true,
      source: centralItems.length ? "PontoView Content Hub + legado" : "PontoView legado",
      migrationFallback: true,
    });
  } catch (error) {
    console.error(error);
    return reply({ error: "INTERNAL_ERROR" }, 500);
  }
});
