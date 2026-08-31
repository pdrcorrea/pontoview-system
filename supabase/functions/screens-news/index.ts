import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { admin, cors, handleError, reply, requirePlayer } from "../_shared/common.ts";

const SOURCE_URL = "https://pontoview-api.pedrhc258.workers.dev/api/news";
const CACHE_MS = 15 * 60_000;

type NormalizedNews = {
  source: string; category: string; title: string; summary: string | null; url: string;
  image_url: string | null; published_at: string; fetched_at: string; expires_at: string;
};

type EditorialResult = {
  allowed: boolean;
  reason?: "advertising" | "clickbait" | "sensitive" | "controversial";
};

function clean(value: unknown, max = 1000) {
  const text = String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function plain(value: unknown) {
  return clean(value, 2400)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function classify(title: string, summary: string, localQuery = "") {
  const text = plain(`${title} ${summary}`);
  const local = plain(localQuery).trim();
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

function editorialCheck(item: Record<string, unknown>): EditorialResult {
  const title = clean(item.title, 500);
  const summary = clean(item.summary || item.description, 1200);
  const source = clean(item.source, 200);
  const url = clean(item.url || item.link, 1500);
  const text = plain(`${title} ${summary} ${source} ${url}`);

  // Advertising and sponsored/native-ad language. Intentionally conservative for public displays.
  const advertisingTerms = [
    "publieditorial", "publipost", "conteudo patrocinado", "conteudo publicitario", "informe publicitario",
    "oferta", "ofertas", "promocao", "promocoes", "cupom", "cupons", "desconto", "descontos",
    "compre agora", "aproveite", "black friday", "liquidacao", "imperdivel", "melhor preco",
    "a partir de r$", "por apenas r$", "assine agora", "clique e compre", "link de compra",
    "patrocinado por", "parceria paga", "shopping", "vitrine", "guia de compras",
  ];
  if (advertisingTerms.some((term) => text.includes(term))) return { allowed: false, reason: "advertising" };

  try {
    const parsed = new URL(url);
    const path = plain(parsed.pathname);
    if (["/ofertas", "/promocoes", "/shopping", "/cupom", "/cupons", "/publieditorial"].some((segment) => path.includes(segment))) {
      return { allowed: false, reason: "advertising" };
    }
  } catch {}

  // Clickbait score: one signal is usually harmless; repeated signals indicate an intentionally incomplete or sensational headline.
  let clickbaitScore = 0;
  const clickbaitPhrases = [
    "voce nao vai acreditar", "ninguem esperava", "chocou a internet", "surpreendeu a todos",
    "veja o que aconteceu", "veja quem", "descubra agora", "entenda o motivo", "saiba o motivo",
    "motivo vai te surpreender", "revelacao bombastica", "bombou na web", "internet vai a loucura",
    "de cair o queixo", "de arrepiar", "esta dando o que falar", "nao perca", "urgente!",
  ];
  if (clickbaitPhrases.some((term) => text.includes(term))) clickbaitScore += 2;
  if (/\?\s*$/.test(title)) clickbaitScore += 1;
  if ((title.match(/!/g) || []).length >= 1) clickbaitScore += 1;
  if (/\.{3,}\s*$/.test(title)) clickbaitScore += 1;
  if (/^(veja|saiba|descubra|entenda|confira)\b/i.test(plain(title))) clickbaitScore += 1;
  const letters = title.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const uppercase = title.replace(/[^A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ]/g, "");
  if (letters.length >= 12 && uppercase.length / letters.length > 0.72) clickbaitScore += 2;
  if (clickbaitScore >= 2) return { allowed: false, reason: "clickbait" };

  // Material inappropriate for TVs in receptions, clinics, offices and other shared spaces.
  const sensitiveTerms = [
    "estupro", "estuprada", "abuso sexual", "violencia sexual", "pornografia", "nudez",
    "esquartejado", "decapitado", "decapitada", "corpo carbonizado", "corpo mutilado", "cadaver",
    "suicidio", "se matou", "automutilacao", "massacre", "chacina", "tortura",
    "tiroteio deixa", "morre apos ser baleado", "morta a tiros", "morto a tiros",
  ];
  if (sensitiveTerms.some((term) => text.includes(term))) return { allowed: false, reason: "sensitive" };

  // Avoid gossip, personal attacks and outrage-bait while preserving ordinary factual politics/economy coverage.
  const controversialTerms = [
    "barraco", "treta", "detona", "humilha", "esculacha", "lacrou", "cancelado", "cancelada",
    "guerra nas redes", "troca de farpas", "climao", "polêmica nas redes", "polemica nas redes",
    "revolta internautas", "gera revolta", "causa indignacao", "ataque pessoal", "xinga", "xingou",
    "fofoca", "amante", "traicao", "separacao bombastica",
  ];
  if (controversialTerms.some((term) => text.includes(term))) return { allowed: false, reason: "controversial" };

  return { allowed: true };
}

function applyEditorialFilter<T extends Record<string, unknown>>(items: T[]) {
  return items.filter((item) => editorialCheck(item).allowed);
}

function filterCategories(items: any[], categories: string[]) {
  if (!items.length) return items;
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
    const localQuery = String(manifest.organization?.settings?.localNewsQuery || manifest.settings?.weather_location?.name || "").split(/[·,]/)[0].trim();

    const { data: fresh } = await admin.from("news_cache")
      .select("id,source,category,title,summary,url,image_url,published_at")
      .gt("expires_at", new Date().toISOString()).order("published_at", { ascending: false }).limit(80);
    const safeFresh = applyEditorialFilter((fresh || []) as Record<string, unknown>[]);
    const usableFresh = filterCategories(safeFresh, categories).slice(0, 16);
    if (usableFresh.length >= 6) return reply({ items: usableFresh, cached: true, source: "PontoView", editorialFilter: "public-safe" });

    let providerItems: Record<string, unknown>[] = [];
    try {
      const response = await fetch(SOURCE_URL, { headers: { Accept: "application/json", "User-Agent": "PontoView-Telas/1.2" } });
      if (response.ok) {
        const json = await response.json();
        providerItems = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : [];
      }
    } catch {}

    const normalized = providerItems.map((item) => normalizeItem(item, localQuery)).filter(Boolean) as NormalizedNews[];
    const safeNormalized = applyEditorialFilter(normalized as unknown as Record<string, unknown>[]) as unknown as NormalizedNews[];
    if (safeNormalized.length) {
      // Only approved headlines enter the shared cache, preventing rejected content from resurfacing later.
      await admin.from("news_cache").upsert(safeNormalized, { onConflict: "source,url" });
      return reply({ items: filterCategories(safeNormalized, categories).slice(0, 16), cached: false, source: "PontoView", editorialFilter: "public-safe" });
    }

    const { data: stale } = await admin.from("news_cache")
      .select("id,source,category,title,summary,url,image_url,published_at")
      .order("published_at", { ascending: false }).limit(80);
    const safeStale = applyEditorialFilter((stale || []) as Record<string, unknown>[]);
    return reply({ items: filterCategories(safeStale, categories).slice(0, 16), cached: true, stale: true, source: "PontoView", editorialFilter: "public-safe" });
  } catch (error) {
    return handleError(error);
  }
});
