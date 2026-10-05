import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, CalendarDays, Loader2, Newspaper, Search } from "lucide-react";
import { Link, useParams } from "react-router-dom";
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

const categories: Record<string, string> = {
  general: "Geral",
  local: "Local",
  economy: "Economia",
  sports: "Esportes",
  technology: "Tecnologia",
  health: "Saúde",
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

async function loadFeed() {
  if (!functionsUrl) throw new Error("CONTENT_PORTAL_NOT_CONFIGURED");
  const response = await fetch(`${functionsUrl}/content-feed?type=news&limit=50`, {
    headers: supabasePublishableKey ? { apikey: supabasePublishableKey } : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "CONTENT_FEED_UNAVAILABLE");
  return (data as FeedResponse).items || [];
}

export function ContentPortalPage() {
  const { slug } = useParams();
  const [items, setItems] = useState<PublicContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadFeed()
      .then((rows) => { if (alive) setItems(rows); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const selected = slug ? items.find((item) => item.slug === slug) : null;
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (!term) return true;
      return `${item.title} ${item.summary || ""} ${item.source_name}`.toLocaleLowerCase("pt-BR").includes(term);
    });
  }, [items, search, category]);

  if (slug && !loading && selected) {
    return (
      <div className="content-portal">
        <header className="content-portal-header compact">
          <Link className="content-portal-brand" to={publicBasePath() || "/"}>
            <img src="/assets/icon.png" alt="" />
            <span><strong>PontoView</strong><small>Conteúdo</small></span>
          </Link>
        </header>
        <main className="content-portal-article-wrap">
          <Link className="content-portal-back" to={publicBasePath() || "/"}><ArrowLeft size={17}/>Voltar</Link>
          <article className="content-portal-article">
            <span className="content-portal-category">{categories[selected.category] || selected.category}</span>
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
    <div className="content-portal">
      <header className="content-portal-header">
        <div className="content-portal-header-inner">
          <Link className="content-portal-brand" to={publicBasePath() || "/"}>
            <img src="/assets/icon.png" alt="" />
            <span><strong>PontoView</strong><small>Conteúdo</small></span>
          </Link>
          <span className="content-portal-badge">Portal informativo</span>
        </div>
      </header>

      <main className="content-portal-main">
        <section className="content-portal-intro">
          <span>INFORMAÇÃO COM ORIGEM</span>
          <h1>Conteúdo para entender o que importa.</h1>
          <p>Notícias e informações selecionadas pela PontoView, sempre com identificação da fonte.</p>
        </section>

        <section className="content-portal-toolbar">
          <label className="content-portal-search"><Search size={18}/><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Buscar no conteúdo" /></label>
          <div className="content-portal-filters">
            <button className={category === "all" ? "active" : ""} onClick={()=>setCategory("all")}>Todos</button>
            {Object.entries(categories).map(([id,label]) => <button key={id} className={category === id ? "active" : ""} onClick={()=>setCategory(id)}>{label}</button>)}
          </div>
        </section>

        {loading ? <div className="content-portal-state"><Loader2 className="spin"/><span>Carregando conteúdo…</span></div> : error ? <div className="content-portal-state"><Newspaper/><strong>Não foi possível carregar o conteúdo agora.</strong><span>Tente novamente em alguns instantes.</span></div> : visible.length === 0 ? <div className="content-portal-state"><Newspaper/><strong>{items.length ? "Nenhum resultado encontrado." : "Ainda não há conteúdos publicados."}</strong><span>{items.length ? "Tente outra busca ou categoria." : "Assim que um item for aprovado e publicado na Central, ele aparecerá aqui."}</span></div> : <section className="content-portal-grid">
          {visible.map((item) => (
            <Link className="content-portal-card" key={item.id} to={`${publicBasePath()}/${item.slug}`}>
              <div className="content-portal-card-image">{item.image_url ? <img src={item.image_url} alt="" /> : <span><Newspaper size={28}/></span>}</div>
              <div className="content-portal-card-body">
                <div className="content-portal-card-top"><span>{categories[item.category] || item.category}</span><small>{item.source_name}</small></div>
                <h2>{item.title}</h2>
                {item.summary && <p>{item.summary}</p>}
                <footer><span>{formatDate(item.source_published_at || item.published_at)}</span><ArrowUpRight size={17}/></footer>
              </div>
            </Link>
          ))}
        </section>}
      </main>

      <footer className="content-portal-footer"><span>PontoView Conteúdo</span><span>Informação certa, na tela certa, no momento certo.</span></footer>
    </div>
  );
}
