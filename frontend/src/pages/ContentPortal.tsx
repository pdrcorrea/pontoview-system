import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Loader2, Newspaper, Search } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { functionsUrl, supabasePublishableKey } from "../lib/supabase";
import "../content-portal.css";

type PublicContent = {
  id: string;
  type: string;
  category: string;
  slug: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  source_name: string;
  source_url: string | null;
  source_author: string | null;
  source_published_at: string | null;
  published_at: string;
  expires_at: string | null;
};

type FeedResponse = { items: PublicContent[] };
type PortalCategory = { id: string; label: string };

const PUBLIC_FUNCTIONS_URL = "https://fpdojntvnhiszagczfqr.supabase.co/functions/v1";
const portalCategories: PortalCategory[] = [
  { id: "all", label: "Geral" },
  { id: "national", label: "Nacional" },
  { id: "international", label: "Internacional" },
  { id: "economy", label: "Economia" },
  { id: "sports", label: "Esportes" },
  { id: "technology", label: "Tecnologia" },
  { id: "health", label: "Saúde" },
  { id: "celebrities", label: "Famosos" },
];

const categoryLabels: Record<string, string> = {
  general: "Geral",
  local: "Nacional",
  national: "Nacional",
  international: "Internacional",
  economy: "Economia",
  sports: "Esportes",
  technology: "Tecnologia",
  health: "Saúde",
  celebrities: "Famosos",
  entertainment: "Famosos",
};

function publicBasePath() {
  return window.location.hostname.toLowerCase() === "conteudo.pontoview.com.br" ? "" : "/conteudo-publico";
}

function categoryLabel(value: string) {
  return categoryLabels[value] || "Geral";
}

function matchesCategory(itemCategory: string, selectedCategory: string) {
  if (selectedCategory === "all") return true;
  if (selectedCategory === "national") return itemCategory === "national" || itemCategory === "local";
  if (selectedCategory === "celebrities") return itemCategory === "celebrities" || itemCategory === "entertainment";
  return itemCategory === selectedCategory;
}

async function loadFeed() {
  const base = functionsUrl || PUBLIC_FUNCTIONS_URL;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${base}/content-feed?type=news&limit=60`, {
      signal: controller.signal,
      headers: supabasePublishableKey ? { apikey: supabasePublishableKey } : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || "CONTENT_FEED_UNAVAILABLE");
    return (data as FeedResponse).items || [];
  } finally {
    window.clearTimeout(timeout);
  }
}

function NewsCard({ item }: { item: PublicContent }) {
  const body = (
    <>
      <div className="content-portal-card-image">
        {item.image_url ? <img src={item.image_url} alt="" loading="lazy" /> : <span><Newspaper size={24}/></span>}
      </div>
      <div className="content-portal-card-body">
        <div className="content-portal-card-top">
          <span>{categoryLabel(item.category)}</span>
          <small>{item.source_name}</small>
        </div>
        <h2>{item.title}</h2>
        <footer><span>Ler na fonte</span><ArrowUpRight size={16}/></footer>
      </div>
    </>
  );

  if (item.source_url) {
    return <a className="content-portal-card" href={item.source_url} target="_blank" rel="noreferrer">{body}</a>;
  }

  return <Link className="content-portal-card" to={`${publicBasePath()}/${item.slug}`}>{body}</Link>;
}

export function ContentPortalPage() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCategory = searchParams.get("tema") || "all";
  const initialCategory = portalCategories.some((item) => item.id === requestedCategory) ? requestedCategory : "all";

  const [items, setItems] = useState<PublicContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(initialCategory);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    loadFeed()
      .then((rows) => { if (alive) setItems(rows); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const next = searchParams.get("tema") || "all";
    setCategory(portalCategories.some((item) => item.id === next) ? next : "all");
  }, [searchParams]);

  const selected = slug ? items.find((item) => item.slug === slug) : null;
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return items.filter((item) => {
      if (!matchesCategory(item.category, category)) return false;
      if (!term) return true;
      return `${item.title} ${item.source_name}`.toLocaleLowerCase("pt-BR").includes(term);
    });
  }, [items, search, category]);

  function selectCategory(nextCategory: string) {
    setCategory(nextCategory);
    if (nextCategory === "all") setSearchParams({}, { replace: true });
    else setSearchParams({ tema: nextCategory }, { replace: true });
  }

  if (slug && !loading && selected) {
    return (
      <div className="content-portal content-portal-operational">
        <header className="content-portal-header compact">
          <div className="content-portal-header-inner">
            <Link className="content-portal-brand" to={publicBasePath() || "/"}>
              <img src="/assets/icon.png" alt="" />
              <strong>Conteúdo</strong>
            </Link>
            <Link className="content-portal-header-back" to={publicBasePath() || "/"}><ArrowLeft size={16}/>Voltar</Link>
          </div>
        </header>
        <main className="content-portal-quick-article">
          {selected.image_url && <img src={selected.image_url} alt="" />}
          <div>
            <span>{categoryLabel(selected.category)} · {selected.source_name}</span>
            <h1>{selected.title}</h1>
            {selected.source_url && <a href={selected.source_url} target="_blank" rel="noreferrer">Ler na fonte <ArrowUpRight size={17}/></a>}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="content-portal content-portal-operational">
      <header className="content-portal-header content-portal-nav-shell">
        <div className="content-portal-header-inner">
          <Link className="content-portal-brand" to={publicBasePath() || "/"} onClick={()=>selectCategory("all")}>
            <img src="/assets/icon.png" alt="" />
            <strong>Conteúdo</strong>
          </Link>

          <nav className="content-portal-nav" aria-label="Temas">
            {portalCategories.map((item) => (
              <button key={item.id} type="button" className={category === item.id ? "active" : ""} onClick={() => selectCategory(item.id)}>
                {item.label}
              </button>
            ))}
          </nav>

          <label className="content-portal-search content-portal-search-header">
            <Search size={16}/>
            <input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Buscar" aria-label="Buscar notícias" />
          </label>
        </div>
      </header>

      <main className="content-portal-main content-portal-feed">
        {loading ? (
          <div className="content-portal-state compact"><Loader2 className="spin"/></div>
        ) : error ? (
          <div className="content-portal-state compact"><strong>Não foi possível carregar.</strong></div>
        ) : visible.length === 0 ? (
          <div className="content-portal-state compact"><strong>Nenhuma notícia encontrada.</strong></div>
        ) : (
          <section className="content-portal-grid content-portal-grid-fast">
            {visible.map((item) => <NewsCard key={item.id} item={item} />)}
          </section>
        )}
      </main>

      <footer className="content-portal-footer"><span>Conteúdo</span><span>PontoView</span></footer>
    </div>
  );
}
