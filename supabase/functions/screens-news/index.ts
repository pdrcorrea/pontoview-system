import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { admin, cors, handleError, reply, requirePlayer } from "../_shared/common.ts";

const SOURCE_URL = "https://pontoview-api.pedrhc258.workers.dev/api/news";
const CACHE_MS = 15 * 60_000;

type NormalizedNews = {
  source: string; category: string; title: string; summary: string | null; url: string;
  image_url: string | null; published_at: string; fetched_at: string; expires_at: string;
};

function clean(value: unknown, max = 1000) {
  const text = String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function classify(title: string, summary: string, localQuery = "") {
  const text = `${title} ${summary}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const local = localQuery.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (local && text.includes(local)) return "local";
  const groups: Array<[string, string[]]> = [
    ["economy", ["economia", "dolar", "mercado", "inflacao", "selic", "bolsa", "juros", "pib", "banco", "empresas"]],
    ["sports", ["futebol", "esporte", "copa", "campeonato", "gol", "jogador", "time", "selecao", "brasileirao"]],
    ["technology", ["tecnologia", "inteligencia artificial", " ia ", "software", "internet", "celular", "chip", "google", "apple", "microsoft"]],
    ["health", ["saude", "vacina", "hospital", "doenca", "medicina", " sus ", "dengue", "virus", "medico"]],
  ];
  for (const [category, terms] of groups) if (terms.some((term) => text.includes(term))) return category;
  return "general";
}

function normalizeItem(item: Record<string, unknown>, localQuery: string): NormalizedNews | null {
  const title = clean(item.title, 300);
  const url = clean(item.link || item.url || item.sourceUrl, 1200);
  if (!title || !url || !/^https?:\/\//i.test(url)) return null;
  const summary = clean(item.description || item.summary, 1000) || null;
  const source = clean(item.source || item.sourceDomain || "PontoView Notícias", 120) || "PontoView Notícias";
  const image = clean(item.image || item.image_url || item.imageUrl, 1200) || null;
  const publishedRaw = clean(item.published_at || item.publishedAt || item.pubDate, 100);
  const publishedAt = publishedRaw && !Number.isNaN(Date.parse(publishedRaw)) ? new Date(publishedRaw).toISOString() : new Date().toISOString();
  const now = new Date();
  return {
    source, category: classify(title, summary || "", localQuery), title, summary, url, image_url: image,
    published_at: publishedAt, fetched_at: now.toISOString(), expires_at: new Date(now.getTime() + CACHE_MS).toISOString(),
  };
}

function filterCategories(items: any[], categories: string[]) {
  if (!items.length) return items;
  if (!categories.length || categories.includes("general")) return items;
  const filtered = items.filter((item) => categories.includes(String(item.category || "general")));
  return filtered.length ? filtered : items;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const manifest = await requirePlayer(req);
    const categories = Array.isArray(manifest.settings?.news_categories)
      ? manifest.settings.news_categories.slice(0, 6).map(String)
      : ["general"];
    const localQuery = String(manifest.organization?.settings?.localNewsQuery || manifest.settings?.weather_location?.name || "").split(/[·,]/)[0].trim();

    const { data: fresh } = await admin.from("news_cache")
      .select("id,source,category,title,summary,url,image_url,published_at")
      .gt("expires_at", new Date().toISOString()).order("published_at", { ascending: false }).limit(40);
    const usableFresh = filterCategories(fresh || [], categories).slice(0, 16);
    if (usableFresh.length >= 6) return reply({ items: usableFresh, cached: true, source: "PontoView" });

    let providerItems: Record<string, unknown>[] = [];
    try {
      const response = await fetch(SOURCE_URL, { headers: { Accept: "application/json", "User-Agent": "PontoView-Telas/1.1" } });
      if (response.ok) {
        const json = await response.json();
        providerItems = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : [];
      }
    } catch {}

    const normalized = providerItems.map((item) => normalizeItem(item, localQuery)).filter(Boolean) as NormalizedNews[];
    if (normalized.length) {
      await admin.from("news_cache").upsert(normalized, { onConflict: "source,url" });
      return reply({ items: filterCategories(normalized, categories).slice(0, 16), cached: false, source: "PontoView" });
    }

    const { data: stale } = await admin.from("news_cache")
      .select("id,source,category,title,summary,url,image_url,published_at")
      .order("published_at", { ascending: false }).limit(40);
    return reply({ items: filterCategories(stale || [], categories).slice(0, 16), cached: true, stale: true, source: "PontoView" });
  } catch (error) {
    return handleError(error);
  }
});
