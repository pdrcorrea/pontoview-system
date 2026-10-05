import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, CalendarDays, Loader2, Newspaper, Search } from "lucide-react";
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

type PortalCategory = {
  id: string;
  label: string;
};

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

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

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
    const response = await fetch(`${base}/content-feed?type=news&limit=50`, {
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
      return `${item.title} ${item.summary || ""} ${item.source_name}`.toLocaleLowerCase("pt-BR").includes(term);
    });
  }, [items, search, category]);

  const activeCategoryLabel = portalCategories.find((item) => item.id === category)?.label || "Geral";

  function selectCategory(nextCategory: string) {
    setCategory(nextCategory);
    if (nextCategory === "all") setSearchParams({}, { replace: true });
    else setSearchParams({ tema: nextCategory }, { replace: true });
  }

  if (slug && !loading && selected) {
    return (
      <div className="content-portal">
        <header className="content-portal-header compact">
          <div className="content-portal-header-inner">
            <Link className="content-portal-brand" to={publicBasePath() || "/"}>
              <img src="/assets/icon.png" alt="" />
              <strong>Conteúdo</strong>
            </Link>
            <Link className="content-portal-header-back" to={publicBasePath() || "/"}><ArrowLeft size={16}/>Voltar ao portal</Link>
          </div>
        </header>
        <main className="content-portal-article-wrap">
          <Link className="content-portal-back" to={publicBasePath() || "/"}><ArrowLeft size={17}/>Voltar</Link>
          <article className="content-portal-article">
            <span className="content-portal-category">{categoryLabel(selected.category)}</span>
            <h1>{selected.title}</h1>
            {selected.summary && <p className="content-portal-lead">{selected.summary}</p>}
            <div className="content-portal-meta">
              <span><Newspaper size={16}/>{selected.source_name}</span>
              <span><CalendarDays size={16}/>{formatDate(selected.source_published_at || selected.published_at)}</span>
            </div>
            {selected.image_url && <img className="content-portal-hero-image" src={selected.image_url} alt="" />}
            <section className="content-portal-source-box">
              <div>
                <small>Origem da informação</small>
                <strong>{selected.source_name}</strong>
                {selected.source_author && <span>{selected.source_author}</span>}
              </div>
              {selected.source_url && <a href={selected.source_url} target="_blank" rel="noreferrer">Ver fonte original <ArrowUpRight size={16}/></a>}
            </section>
            <p className="content-portal-disclaimer">A PontoView organiza e distribui conteúdos informativos com identificação da fonte original. O conteúdo editorial exibido nas telas passa por curadoria antes da publicação.</p>
          </article>
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

          <nav className="content-portal-nav" aria-label="Temas do conteúdo">
            {portalCategories.map((item) => (
              <button
                key={item.id}
                type="button"
                className={category === item.id ? "active" : ""}
                onClick={() => selectCategory(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <label className="content-portal-search content-portal-search-header">
            <Search size={17}/>
            <input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Buscar" aria-label="Buscar no conteúdo" />
          </label>
        </div>
      </header>

      <main className="content-portal-main">
        <section className="content-portal-intro content-portal-intro-compact">
          <div className="content-portal-intro-copy">
            <span>INFORMAÇÃO COM ORIGEM</span>
            <h1>Conteúdo para entender o que importa.</h1>
            <p>Notícias e informações selecionadas pela PontoView, com leitura objetiva e identificação clara da fonte.</p>
          </div>
          <div className="content-portal-intro-note">
            <span>CURADORIA PONTOVIEW</span>
            <strong>Informação clara.<br/>Fonte identificada.</strong>
            <small>O que chega às telas também pode ser consultado por aqui.</small>
          </div>
        </section>

        <section className="content-portal-content-head">
          <div>
            <span>{category === "all" ? "ÚLTIMAS PUBLICAÇÕES" : "TEMA"}</span>
            <h2>{category === "all" ? "Agora no Conteúdo" : activeCategoryLabel}</h2>
          </div>
          {!loading && !error && <small>{visible.length} {visible.length === 1 ? "publicação" : "publicações"}</small>}
        </section>

        {loading ? <div className="content-portal-state"><Loader2 className="spin"/><span>Carregando conteúdo…</span></div> : error ? <div className="content-portal-state"><Newspaper/><strong>Não foi possível carregar o conteúdo agora.</strong><span>Tente novamente em alguns instantes.</span></div> : visible.length === 0 ? <div className="content-portal-state"><Newspaper/><strong>{items.length ? "Nenhum resultado encontrado." : "Ainda não há conteúdos publicados."}</strong><span>{items.length ? "Tente outro tema ou ajuste a busca." : "Assim que um item for aprovado e publicado na Central, ele aparecerá aqui."}</span></div> : <section className="content-portal-grid content-portal-grid-editorial">
          {visible.map((item, index) => (
            <Link className={`content-portal-card ${index === 0 ? "featured" : ""}`} key={item.id} to={`${publicBasePath()}/${item.slug}`}>
              <div className="content-portal-card-image">{item.image_url ? <img src={item.image_url} alt="" /> : <span><Newspaper size={28}/></span>}</div>
              <div className="content-portal-card-body">
                <div className="content-portal-card-top"><span>{categoryLabel(item.category)}</span><small>{item.source_name}</small></div>
                <h2>{item.title}</h2>
                {item.summary && <p>{item.summary}</p>}
                <footer><span>{formatDate(item.source_published_at || item.published_at)}</span><ArrowUpRight size={17}/></footer>
              </div>
            </Link>
          ))}
        </section>}
      </main>

      <footer className="content-portal-footer"><span>Conteúdo · PontoView</span><span>Informação certa, na tela certa, no momento certo.</span></footer>
    </div>
  );
}
