export type EditorialReason =
  | "advertising"
  | "clickbait"
  | "sensationalism"
  | "sensitive"
  | "controversial"
  | "blocked_source"
  | "broken_encoding";

export type EditorialResult = { allowed: true } | { allowed: false; reason: EditorialReason };

export function clean(value: unknown, max = 1000) {
  const text = String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function plain(value: unknown) {
  return clean(value, 3000).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function hasBrokenEncoding(value: unknown) {
  const text = clean(value, 3000);
  if (!text) return false;
  if (text.includes("\uFFFD")) return true;
  return /(Ã[\x80-\xBF]|Â[\x80-\xBF]|â(?:€|€™|€œ|€�|€“|€”|€¦|„|†)|ðŸ|ï¿½)/.test(text);
}

export function classifyNews(title: string, summary: string, localQuery = "") {
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

export function editorialCheck(item: Record<string, unknown>): EditorialResult {
  const title = clean(item.title, 500);
  const summary = clean(item.summary || item.description, 1200);
  const source = clean(item.source || item.sourceDomain || item.source_name, 200);
  const url = clean(item.url || item.link || item.sourceUrl || item.source_url, 1500);

  if (hasBrokenEncoding(title) || hasBrokenEncoding(summary) || hasBrokenEncoding(source)) {
    return { allowed: false, reason: "broken_encoding" };
  }

  const text = plain(`${title} ${summary} ${source} ${url}`);
  const normalizedSource = plain(source);
  const normalizedUrl = plain(url);

  const blockedSources = [
    "folha de s.paulo", "folha de s. paulo", "folha de sao paulo", "folha s.paulo", "folha s. paulo",
    "folha.uol.com.br", "www1.folha.uol.com.br",
  ];
  if (blockedSources.some((term) => normalizedSource.includes(term) || normalizedUrl.includes(term))) {
    return { allowed: false, reason: "blocked_source" };
  }

  const advertisingTerms = [
    "publieditorial", "publipost", "conteudo patrocinado", "conteudo publicitario", "informe publicitario",
    "oferta", "ofertas", "promocao", "promocoes", "cupom", "cupons", "desconto", "descontos",
    "compre agora", "aproveite", "black friday", "liquidacao", "imperdivel", "melhor preco",
    "a partir de r$", "por apenas r$", "assine agora", "clique e compre", "link de compra",
    "patrocinado por", "parceria paga", "shopping", "vitrine", "guia de compras",
  ];
  if (advertisingTerms.some((term) => text.includes(term))) return { allowed: false, reason: "advertising" };

  try {
    const path = plain(new URL(url).pathname);
    if (["/ofertas", "/promocoes", "/shopping", "/cupom", "/cupons", "/publieditorial"].some((segment) => path.includes(segment))) {
      return { allowed: false, reason: "advertising" };
    }
  } catch {}

  let clickbaitScore = 0;
  const titlePlain = plain(title).trim();
  const engagementLeads = ["veja", "saiba", "descubra", "confira", "entenda", "assista", "clique", "leia", "conheca", "aprenda", "relembre"];
  if (engagementLeads.some((term) => titlePlain === term || titlePlain.startsWith(term + " "))) clickbaitScore += 2;

  const strongClickbaitPhrases = [
    "voce nao vai acreditar", "nao vai acreditar", "ninguem esperava", "ninguem te conta", "chocou a internet",
    "surpreendeu a todos", "veja o que aconteceu", "descubra agora", "motivo vai te surpreender", "revelacao bombastica",
    "bombou na web", "internet vai a loucura", "de cair o queixo", "nao perca", "segredo revelado", "voce precisa saber",
    "tudo o que voce precisa saber", "fotos mostram", "antes e depois", "viraliza nas redes", "o final surpreende",
  ];
  if (strongClickbaitPhrases.some((term) => text.includes(term))) clickbaitScore += 3;

  const clickInducingPhrases = [
    "saiba mais", "veja mais", "confira agora", "confira detalhes", "veja detalhes", "veja como", "saiba como",
    "entenda o motivo", "saiba o motivo", "clique aqui", "assista ao video", "veja o video", "leia mais",
    "continue lendo", "veja a lista", "confira a lista", "descubra quem", "o que se sabe", "o que sabemos",
  ];
  if (clickInducingPhrases.some((term) => titlePlain.includes(term))) clickbaitScore += 1;
  if (/\?\s*$/.test(title)) clickbaitScore += 1;
  if ((title.match(/!/g) || []).length >= 1) clickbaitScore += 1;
  if (/\.{3,}\s*$/.test(title)) clickbaitScore += 1;

  const letters = title.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const uppercase = title.replace(/[^A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ]/g, "");
  if (letters.length >= 12 && uppercase.length / letters.length > 0.72) clickbaitScore += 2;
  if (clickbaitScore >= 2) return { allowed: false, reason: "clickbait" };

  const sensationalTerms = [
    "chocante", "bombastico", "bombastica", "estarrecedor", "estarrecedora", "impressionante", "absurdo",
    "escandalo", "caos", "panico", "terror", "apocaliptico", "gera revolta", "causa indignacao",
    "revolta internautas", "web em choque", "viraliza", "viralizou", "polemica explode", "sem precedentes",
  ];
  if (sensationalTerms.some((term) => titlePlain.includes(term)) && (/!/.test(title) || strongClickbaitPhrases.some((term) => text.includes(term)))) {
    return { allowed: false, reason: "sensationalism" };
  }

  const sensitiveTerms = [
    "estupro", "estuprada", "abuso sexual", "violencia sexual", "pornografia", "nudez", "esquartejado", "decapitado",
    "decapitada", "corpo carbonizado", "corpo mutilado", "cadaver", "suicidio", "se matou", "automutilacao",
    "massacre", "chacina", "tortura", "tiroteio deixa", "morre apos ser baleado", "morta a tiros", "morto a tiros",
  ];
  if (sensitiveTerms.some((term) => text.includes(term))) return { allowed: false, reason: "sensitive" };

  const controversialTerms = [
    "barraco", "treta", "detona", "humilha", "esculacha", "lacrou", "cancelado", "cancelada", "guerra nas redes",
    "troca de farpas", "climao", "polemica nas redes", "revolta internautas", "gera revolta", "causa indignacao",
    "ataque pessoal", "xinga", "xingou", "fofoca", "amante", "traicao", "separacao bombastica",
  ];
  if (controversialTerms.some((term) => text.includes(term))) return { allowed: false, reason: "controversial" };

  return { allowed: true };
}

export function normalizeNewsItem(item: Record<string, unknown>, localQuery = "") {
  const title = clean(item.title, 300);
  const sourceUrl = clean(item.link || item.url || item.sourceUrl, 1200);
  if (!title || !sourceUrl || !/^https?:\/\//i.test(sourceUrl)) return null;

  const summary = clean(item.description || item.summary, 1000) || null;
  const sourceName = clean(item.source || item.sourceDomain || "PontoView Notícias", 120) || "PontoView Notícias";
  const imageUrl = clean(item.image || item.image_url || item.imageUrl, 1200) || null;
  const author = clean(item.author || item.sourceAuthor, 160) || null;
  const publishedRaw = clean(item.published_at || item.publishedAt || item.pubDate, 100);
  const sourcePublishedAt = publishedRaw && !Number.isNaN(Date.parse(publishedRaw)) ? new Date(publishedRaw).toISOString() : new Date().toISOString();

  return {
    title,
    summary,
    source_name: sourceName,
    source_url: sourceUrl,
    source_author: author,
    image_url: imageUrl,
    source_published_at: sourcePublishedAt,
    category: classifyNews(title, summary || "", localQuery),
  };
}

export async function stableNewsSlug(title: string, url: string) {
  const base = plain(title)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "noticia";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url));
  const hash = Array.from(new Uint8Array(digest).slice(0, 5)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${base}-${hash}`;
}
