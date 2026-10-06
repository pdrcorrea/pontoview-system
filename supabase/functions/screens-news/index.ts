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

const CENTRAL_CACHE_MS = 2 * 60 * 60_000;
const MAX_CENTRAL_ROWS = 40;
const MAX_PLAYER_ITEMS = 16;

type CentralNews = {
  id: string;
  content_id: string;
  source: string;
  category: string;
  title: string;
  summary: string | null;
  url: string | null;
  image_url: string | null;
  published_at: string;
  public_url: string;
};

let centralCache: { at: number; items: CentralNews[] } = { at: 0, items: [] };

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

function categoryAlias(value: string) {
  const normalized = String(value || "general").toLowerCase();
  if (normalized === "entertainment") return "celebrities";
  if (normalized === "tech") return "technology";
  return normalized;
}

function requestedCategories(manifest: Record<string, any>) {
  const raw = Array.isArray(manifest.settings?.news_categories)
    ? manifest.settings.news_categories.slice(0, 8).map(String)
    : ["general"];
  return Array.from(new Set(raw.map(categoryAlias)));
}

function filterCategories(items: CentralNews[], categories: string[]) {
  if (!categories.length || categories.includes("general")) return items;
  const selected = items.filter((item) => categories.includes(categoryAlias(item.category)));
  return selected.length ? selected : items;
}

async function loadCentralNews(now: string) {
  if (centralCache.items.length && Date.now() - centralCache.at < CENTRAL_CACHE_MS) return centralCache.items;

  const { data, error } = await admin
    .from("content_items")
    .select("id,slug,category,title,summary,source_name,source_url,image_url,source_published_at,published_at,expires_at")
    .eq("content_type", "news")
    .eq("status", "published")
    .lte("published_at", now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("source_published_at", { ascending: false, nullsFirst: false })
    .limit(MAX_CENTRAL_ROWS);
  if (error) throw error;

  centralCache = {
    at: Date.now(),
    items: (data || []).map((item) => ({
      id: item.id,
      content_id: item.id,
      source: item.source_name,
      category: categoryAlias(item.category || "general"),
      title: item.title,
      summary: item.summary,
      url: item.source_url,
      image_url: item.image_url,
      published_at: item.source_published_at || item.published_at,
      public_url: `https://conteudo.pontoview.com.br/${encodeURIComponent(item.slug)}`,
    })),
  };

  return centralCache.items;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const manifest = await requirePlayer(req);
    const categories = requestedCategories(manifest);
    const now = new Date().toISOString();
    const centralItems = await loadCentralNews(now);
    const items = filterCategories(centralItems, categories).slice(0, MAX_PLAYER_ITEMS);

    return reply({
      items,
      cached: Date.now() - centralCache.at < CENTRAL_CACHE_MS,
      source: "PontoView Content Hub",
      centralOnly: true,
      migrationFallback: false,
      categories,
    });
  } catch (error) {
    console.error(error);
    return reply({ error: "INTERNAL_ERROR" }, 500);
  }
});
