import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Archive,
  Check,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  Loader2,
  Newspaper,
  PencilLine,
  Plus,
  Power,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { FormMessage, formatDate, timeAgo } from "../components/ui";
import { invokeFunction } from "../lib/supabase";
import "../content-hub.css";

type HubTab = "overview" | "queue" | "sources";
type Status = "review" | "approved" | "published" | "rejected" | "expired" | "archived";

type Item = {
  id: string;
  category: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  source_name: string;
  source_url: string | null;
  source_author: string | null;
  source_published_at: string | null;
  status: Status | "imported";
  editorial_flags: Array<{ code?: string; stage?: string }>;
  review_notes: string | null;
  imported_at: string | null;
  published_at: string | null;
  expires_at: string | null;
  updated_at: string;
};

type Source = {
  id: string;
  name: string;
  slug: string;
  source_type: "rss" | "api" | "manual" | "partner";
  site_url: string | null;
  feed_url: string | null;
  default_category: string;
  is_active: boolean;
  requires_review: boolean;
  trust_level: number;
  attribution_label: string | null;
  license_notes: string | null;
  last_ingested_at: string | null;
  last_ingest_status: "ok" | "partial" | "error" | null;
  last_ingest_count: number;
  last_ingest_error: string | null;
};

type Dashboard = {
  counts: Record<"review" | "approved" | "published" | "scheduled" | "rejected" | "expired" | "archived", number>;
  sources: Array<Pick<Source, "id" | "name" | "slug" | "source_type" | "is_active" | "last_ingested_at" | "last_ingest_status" | "last_ingest_count" | "last_ingest_error">>;
  recent: Array<Pick<Item, "id" | "title" | "source_name" | "status" | "category" | "imported_at" | "published_at" | "image_url">>;
};

type SourceDraft = {
  id?: string;
  name: string;
  slug: string;
  source_type: Source["source_type"];
  site_url: string;
  feed_url: string;
  default_category: string;
  requires_review: boolean;
  trust_level: number;
  attribution_label: string;
  license_notes: string;
};

const statuses: Array<[Status, string]> = [
  ["review", "Revisão"], ["approved", "Aprovadas"], ["published", "Publicadas"],
  ["rejected", "Rejeitadas"], ["expired", "Expiradas"], ["archived", "Arquivadas"],
];
const categories = [
  ["general", "Geral"], ["local", "Local"], ["economy", "Economia"],
  ["sports", "Esportes"], ["technology", "Tecnologia"], ["health", "Saúde"],
] as const;
const emptySource: SourceDraft = {
  name: "", slug: "", source_type: "api", site_url: "", feed_url: "",
  default_category: "general", requires_review: true, trust_level: 1,
  attribution_label: "", license_notes: "",
};

function scheduled(item: Pick<Item, "status" | "published_at">) {
  return item.status === "published" && Boolean(item.published_at) && new Date(item.published_at!).getTime() > Date.now();
}
function statusText(item: Pick<Item, "status" | "published_at">) {
  if (scheduled(item)) return "Agendada";
  return ({ imported: "Importada", review: "Em revisão", approved: "Aprovada", published: "Publicada", rejected: "Rejeitada", expired: "Expirada", archived: "Arquivada" } as Record<string,string>)[item.status] || item.status;
}
function categoryText(value: string) { return categories.find(([id]) => id === value)?.[1] || value; }
function localDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return Number.isNaN(date.getTime()) ? "" : local.toISOString().slice(0, 16);
}
function toDraft(source: Source): SourceDraft {
  return {
    id: source.id, name: source.name, slug: source.slug, source_type: source.source_type,
    site_url: source.site_url || "", feed_url: source.feed_url || "",
    default_category: source.default_category || "general", requires_review: source.requires_review,
    trust_level: source.trust_level, attribution_label: source.attribution_label || "",
    license_notes: source.license_notes || "",
  };
}

export function ContentHubPage() {
  const { user } = useAuth();
  const hubRole = String(user?.app_metadata?.content_hub_role || "");
  const isAdmin = hubRole === "admin";
  const [tab, setTab] = useState<HubTab>("overview");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [status, setStatus] = useState<Status>("review");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<Item | null>(null);
  const [sourceDraft, setSourceDraft] = useState<SourceDraft | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const message = (nextError: string | null = null, nextSuccess: string | null = null) => { setError(nextError); setSuccess(nextSuccess); };
  const loadDashboard = useCallback(async () => setDashboard(await invokeFunction<Dashboard>("content-editorial", { action: "dashboard" })), []);
  const loadSources = useCallback(async () => {
    const result = await invokeFunction<{ sources: Source[] }>("content-editorial", { action: "list_sources" });
    setSources(result.sources || []);
  }, []);
  const loadItems = useCallback(async (nextStatus = status, nextSearch = search, nextCategory = category) => {
    const result = await invokeFunction<{ items: Item[] }>("content-editorial", { action: "list_items", status: nextStatus, search: nextSearch, category: nextCategory, limit: 80 });
    setItems(result.items || []);
    setSelected((current) => current ? (result.items || []).find((item) => item.id === current.id) || null : null);
  }, [status, search, category]);
  const refresh = useCallback(async () => {
    setLoading(true); message();
    try { await Promise.all([loadDashboard(), loadSources(), loadItems()]); }
    catch (reason) { message(reason instanceof Error ? reason.message : "Não foi possível abrir a Central de Conteúdo."); }
    finally { setLoading(false); }
  }, [loadDashboard, loadSources, loadItems]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (tab !== "queue") return;
    const timer = window.setTimeout(() => { void loadItems(status, search, category).catch((reason) => message(reason instanceof Error ? reason.message : "Falha ao atualizar a fila.")); }, 250);
    return () => window.clearTimeout(timer);
  }, [tab, status, search, category, loadItems]);
  useEffect(() => setScheduleAt(selected && scheduled(selected) ? localDateTime(selected.published_at) : ""), [selected?.id, selected?.published_at]);

  const counts = useMemo(() => dashboard?.counts || { review:0, approved:0, published:0, scheduled:0, rejected:0, expired:0, archived:0 }, [dashboard]);
  const health = useMemo(() => {
    const rows = dashboard?.sources || [];
    return { total: rows.length, active: rows.filter((x) => x.is_active).length, warning: rows.filter((x) => x.last_ingest_status === "error").length };
  }, [dashboard]);

  async function itemAction(action: string, extra: Record<string, unknown> = {}) {
    if (!selected) return;
    message(); setBusy(`${action}:${selected.id}`);
    try {
      const result = await invokeFunction<{ item: Item }>("content-editorial", { action, id: selected.id, ...extra });
      setSelected(result.item); message(null, "Alteração editorial salva.");
      await Promise.all([loadDashboard(), loadItems()]);
    } catch (reason) { message(reason instanceof Error ? reason.message : "Não foi possível concluir a ação."); }
    finally { setBusy(null); }
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    const form = new FormData(event.currentTarget); message(); setBusy(`save:${selected.id}`);
    try {
      const result = await invokeFunction<{ item: Item }>("content-editorial", {
        action: "update_item", id: selected.id, title: form.get("title"), summary: form.get("summary"),
        image_url: form.get("image_url"), category: form.get("category"), source_author: form.get("source_author"),
        review_notes: form.get("review_notes"), expires_at: form.get("expires_at") || null,
      });
      setSelected(result.item); message(null, "Edição salva."); await Promise.all([loadDashboard(), loadItems()]);
    } catch (reason) { message(reason instanceof Error ? reason.message : "Não foi possível salvar a edição."); }
    finally { setBusy(null); }
  }

  async function importSource(source: Source) {
    message(); setBusy(`ingest:${source.id}`);
    try {
      const result = await invokeFunction<{ inserted:number; received:number }>("content-news-ingest", { source_slug: source.slug });
      message(null, `${result.inserted} nova(s) notícia(s) adicionada(s) de ${result.received} recebidas.`);
      await Promise.all([loadDashboard(), loadItems(), loadSources()]);
    } catch (reason) { message(reason instanceof Error ? reason.message : "Não foi possível buscar novos conteúdos."); }
    finally { setBusy(null); }
  }

  async function saveSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!sourceDraft || !isAdmin) return;
    message(); setBusy(`source:${sourceDraft.id || "new"}`);
    try {
      await invokeFunction("content-editorial", { action: sourceDraft.id ? "update_source" : "create_source", source_id: sourceDraft.id, ...sourceDraft });
      setSourceDraft(null); message(null, "Fonte salva."); await Promise.all([loadDashboard(), loadSources()]);
    } catch (reason) { message(reason instanceof Error ? reason.message : "Não foi possível salvar a fonte."); }
    finally { setBusy(null); }
  }
  async function toggleSource(source: Source) {
    if (!isAdmin) return; message(); setBusy(`toggle:${source.id}`);
    try { await invokeFunction("content-editorial", { action:"toggle_source", source_id:source.id, is_active:!source.is_active }); await Promise.all([loadDashboard(),loadSources()]); }
    catch (reason) { message(reason instanceof Error ? reason.message : "Não foi possível alterar a fonte."); }
    finally { setBusy(null); }
  }
  function openQueue(next: Status) { setStatus(next); setTab("queue"); setSelected(null); }

  return <div className="content-hub-page">
    <section className="content-hub-hero">
      <div><span className="content-hub-kicker"><Newspaper size={15}/> Editorial PontoView</span><h1>Central de Conteúdo</h1><p>Revise, organize e publique o que chega às telas PontoView.</p></div>
      <div className="content-hub-hero-actions"><span className="content-hub-role"><ShieldCheck size={15}/>{isAdmin ? "Administrador" : "Editor"}</span><button className="btn" onClick={()=>void refresh()} disabled={loading||Boolean(busy)}><RefreshCw size={16} className={loading?"spin":""}/>Atualizar</button></div>
    </section>
    <nav className="content-hub-tabs">
      <button className={tab==="overview"?"active":""} onClick={()=>setTab("overview")}><LayoutDashboard size={17}/>Visão geral</button>
      <button className={tab==="queue"?"active":""} onClick={()=>setTab("queue")}><Inbox size={17}/>Fila editorial {counts.review>0&&<b>{counts.review}</b>}</button>
      <button className={tab==="sources"?"active":""} onClick={()=>setTab("sources")}><Database size={17}/>Fontes</button>
    </nav>
    <FormMessage error={error} success={success}/>

    {loading&&!dashboard ? <div className="content-hub-loading"><Loader2 className="spin"/><span>Organizando a redação digital…</span></div> : tab==="overview" ? <>
      <section className="content-hub-stats">
        <button className="content-hub-stat attention" onClick={()=>openQueue("review")}><span><Inbox size={18}/>Para revisar</span><strong>{counts.review}</strong><small>aguardando decisão editorial</small></button>
        <button className="content-hub-stat" onClick={()=>openQueue("approved")}><span><CheckCircle2 size={18}/>Aprovadas</span><strong>{counts.approved}</strong><small>prontas para publicar</small></button>
        <button className="content-hub-stat positive" onClick={()=>openQueue("published")}><span><Send size={18}/>Publicadas</span><strong>{counts.published}</strong><small>disponíveis para distribuição</small></button>
        <button className="content-hub-stat" onClick={()=>openQueue("published")}><span><Clock3 size={18}/>Agendadas</span><strong>{counts.scheduled}</strong><small>entram no ar automaticamente</small></button>
      </section>
      <div className="content-hub-overview-grid">
        <section className="content-hub-card"><div className="content-hub-card-head"><div><small>Fluxo editorial</small><h2>Atividade recente</h2></div><button className="content-hub-text-action" onClick={()=>setTab("queue")}>Abrir fila</button></div><div className="content-hub-recent-list">
          {(dashboard?.recent||[]).length ? dashboard!.recent.map((item)=><button key={item.id} onClick={()=>openQueue(item.status==="imported"?"review":item.status as Status)}><span className="content-hub-recent-thumb">{item.image_url?<img src={item.image_url} alt=""/>:<ImageIcon size={18}/>}</span><span className="content-hub-recent-copy"><strong>{item.title}</strong><small>{item.source_name} · {categoryText(item.category)}</small></span><span className={`content-hub-status ${scheduled(item)?"scheduled":item.status}`}>{statusText(item)}</span></button>) : <div className="content-hub-soft-empty">A atividade editorial aparecerá aqui quando a Central começar a receber conteúdo.</div>}
        </div></section>
        <section className="content-hub-card"><div className="content-hub-card-head"><div><small>Ingestão</small><h2>Saúde das fontes</h2></div><button className="content-hub-text-action" onClick={()=>setTab("sources")}>Gerenciar</button></div><div className="content-hub-health-numbers"><div><strong>{health.active}</strong><span>ativas</span></div><div><strong>{health.total}</strong><span>cadastradas</span></div><div className={health.warning?"warning":""}><strong>{health.warning}</strong><span>com falha</span></div></div><div className="content-hub-source-mini-list">{(dashboard?.sources||[]).slice(0,4).map((source)=><div key={source.id}><span className={`content-hub-source-dot ${source.last_ingest_status||"idle"}`}/><span><strong>{source.name}</strong><small>{source.last_ingested_at?`Última coleta ${timeAgo(source.last_ingested_at)}`:"Ainda não coletada"}</small></span><b>{source.last_ingest_count||0}</b></div>)}</div></section>
      </div>
    </> : tab==="queue" ? <div className={`content-hub-workspace ${selected?"editor-open":""}`}>
      <section className="content-hub-queue"><div className="content-hub-queue-toolbar"><div className="content-hub-status-tabs">{statuses.map(([value,label])=><button key={value} className={status===value?"active":""} onClick={()=>{setStatus(value);setSelected(null)}}>{label}</button>)}</div><div className="content-hub-filters"><label className="content-hub-search"><Search size={16}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar manchete ou fonte"/></label><select value={category} onChange={(e)=>setCategory(e.target.value)}><option value="all">Todas as categorias</option>{categories.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div></div>
        <div className="content-hub-list">{items.length?items.map((item)=><button key={item.id} className={`content-hub-item ${selected?.id===item.id?"active":""}`} onClick={()=>setSelected(item)}><span className="content-hub-item-image">{item.image_url?<img src={item.image_url} alt="" loading="lazy"/>:<ImageIcon size={20}/>}</span><span className="content-hub-item-copy"><span className="content-hub-item-meta"><b>{item.source_name}</b><i>{categoryText(item.category)}</i></span><strong>{item.title}</strong><small>{item.summary||"Sem resumo disponível."}</small><span className="content-hub-item-foot"><em>{item.imported_at?timeAgo(item.imported_at):""}</em>{item.editorial_flags?.length>0&&<i>{item.editorial_flags.length} alerta(s)</i>}</span></span><span className={`content-hub-status ${scheduled(item)?"scheduled":item.status}`}>{statusText(item)}</span></button>):<div className="content-hub-empty-list"><Inbox size={24}/><strong>Nada por aqui</strong><span>Não há conteúdos neste estado com os filtros atuais.</span></div>}</div>
      </section>
      {selected&&<aside className="content-hub-editor"><div className="content-hub-editor-head"><div><small>{selected.source_name}</small><span className={`content-hub-status ${scheduled(selected)?"scheduled":selected.status}`}>{statusText(selected)}</span></div><button className="icon-button" onClick={()=>setSelected(null)}><X size={18}/></button></div>
        <form onSubmit={saveItem} className="content-hub-editor-form"><div className="content-hub-preview-image">{selected.image_url?<img src={selected.image_url} alt="Prévia"/>:<span><ImageIcon size={24}/>Sem imagem</span>}</div><label><span>Manchete</span><textarea name="title" defaultValue={selected.title} rows={3}/></label><label><span>Resumo</span><textarea name="summary" defaultValue={selected.summary||""} rows={5}/></label><div className="content-hub-form-grid"><label><span>Categoria</span><select name="category" defaultValue={selected.category}>{categories.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label><span>Autor original</span><input name="source_author" defaultValue={selected.source_author||""}/></label></div><label><span>URL da imagem</span><input name="image_url" defaultValue={selected.image_url||""}/></label><label><span>Expira em</span><input name="expires_at" type="datetime-local" defaultValue={localDateTime(selected.expires_at)}/></label><label><span>Notas editoriais</span><textarea name="review_notes" defaultValue={selected.review_notes||""} rows={3}/></label><div className="content-hub-source-reference"><span><strong>Origem</strong><small>{selected.source_published_at?`Publicado na fonte em ${formatDate(selected.source_published_at)}`:"Data original não informada"}</small></span>{selected.source_url&&<a href={selected.source_url} target="_blank" rel="noreferrer">Abrir original <ExternalLink size={14}/></a>}</div>{selected.editorial_flags?.length>0&&<div className="content-hub-flags"><strong>Alertas da ingestão</strong>{selected.editorial_flags.map((flag,i)=><span key={`${flag.code}-${i}`}>{flag.code||"revisão necessária"}</span>)}</div>}<button className="btn content-hub-save" type="submit" disabled={Boolean(busy)||selected.status==="archived"}>{busy===`save:${selected.id}`?<Loader2 className="spin" size={16}/>:<Save size={16}/>}Salvar edição</button></form>
        <div className="content-hub-editor-actions">{["review","imported"].includes(selected.status)&&<><button className="btn" onClick={()=>void itemAction("approve")} disabled={Boolean(busy)}><Check size={16}/>Aprovar</button><button className="btn primary" onClick={()=>void itemAction("approve_and_publish")} disabled={Boolean(busy)}><Send size={16}/>Aprovar e publicar</button><button className="btn danger-soft" onClick={()=>void itemAction("reject")} disabled={Boolean(busy)}><X size={16}/>Rejeitar</button></>}{selected.status==="approved"&&<><button className="btn primary" onClick={()=>void itemAction("publish")} disabled={Boolean(busy)}><Send size={16}/>Publicar agora</button><div className="content-hub-schedule"><input type="datetime-local" value={scheduleAt} onChange={(e)=>setScheduleAt(e.target.value)}/><button className="btn" onClick={()=>scheduleAt?void itemAction("schedule",{publish_at:new Date(scheduleAt).toISOString()}):message("Escolha uma data e horário.")}><Clock3 size={16}/>Agendar</button></div><button className="btn danger-soft" onClick={()=>void itemAction("reject")}><X size={16}/>Rejeitar</button></>}{selected.status==="published"&&<button className="btn danger-soft" onClick={()=>void itemAction("expire")}><Clock3 size={16}/>Encerrar publicação</button>}{["rejected","expired","archived"].includes(selected.status)&&<button className="btn" onClick={()=>void itemAction("restore_to_review")}><RotateCcw size={16}/>Voltar para revisão</button>}{selected.status!=="archived"&&<button className="btn ghost" onClick={()=>void itemAction("archive")}><Archive size={16}/>Arquivar</button>}</div>
      </aside>}
    </div> : <div className={`content-hub-sources-layout ${sourceDraft?"editor-open":""}`}><section className="content-hub-sources"><div className="content-hub-section-head"><div><small>Origem e rastreabilidade</small><h2>Fontes de conteúdo</h2><p>Controle os provedores que alimentam a Central e acompanhe a saúde das coletas.</p></div>{isAdmin&&<button className="btn primary" onClick={()=>setSourceDraft({...emptySource})}><Plus size={16}/>Nova fonte</button>}</div><div className="content-hub-source-grid">{sources.map((source)=><article key={source.id} className={`content-hub-source-card ${!source.is_active?"inactive":""}`}><div className="content-hub-source-card-head"><span className={`content-hub-source-mark ${source.last_ingest_status||"idle"}`}><Radio size={18}/></span><span><strong>{source.name}</strong><small>{source.source_type.toUpperCase()} · confiança {source.trust_level}/5</small></span><span className={`content-hub-status ${source.is_active?"published":"archived"}`}>{source.is_active?"Ativa":"Pausada"}</span></div><div className="content-hub-source-details"><span><small>Última coleta</small><strong>{source.last_ingested_at?timeAgo(source.last_ingested_at):"Nunca"}</strong></span><span><small>Novos itens</small><strong>{source.last_ingest_count||0}</strong></span><span><small>Revisão</small><strong>{source.requires_review?"Obrigatória":"Automática"}</strong></span></div>{source.last_ingest_error&&<p className="content-hub-source-error">{source.last_ingest_error}</p>}<div className="content-hub-source-actions">{source.is_active&&["api","partner"].includes(source.source_type)&&<button className="btn" onClick={()=>void importSource(source)} disabled={Boolean(busy)}>{busy===`ingest:${source.id}`?<Loader2 className="spin" size={15}/>:<RefreshCw size={15}/>}Buscar agora</button>}<button className="btn" onClick={()=>setSourceDraft(toDraft(source))}><PencilLine size={15}/>{isAdmin?"Editar":"Detalhes"}</button>{isAdmin&&<button className="icon-button" onClick={()=>void toggleSource(source)}><Power size={16}/></button>}</div></article>)}</div></section>
      {sourceDraft&&<aside className="content-hub-editor content-hub-source-editor"><div className="content-hub-editor-head"><div><small>Catálogo editorial</small><strong>{sourceDraft.id?"Configurar fonte":"Nova fonte"}</strong></div><button className="icon-button" onClick={()=>setSourceDraft(null)}><X size={18}/></button></div><form className="content-hub-editor-form" onSubmit={saveSource}><label><span>Nome</span><input value={sourceDraft.name} onChange={(e)=>setSourceDraft({...sourceDraft,name:e.target.value})} disabled={!isAdmin} required/></label><div className="content-hub-form-grid"><label><span>Identificador</span><input value={sourceDraft.slug} onChange={(e)=>setSourceDraft({...sourceDraft,slug:e.target.value})} disabled={!isAdmin}/></label><label><span>Tipo</span><select value={sourceDraft.source_type} onChange={(e)=>setSourceDraft({...sourceDraft,source_type:e.target.value as Source["source_type"]})} disabled={!isAdmin}><option value="api">API</option><option value="rss">RSS</option><option value="partner">Parceiro</option><option value="manual">Manual</option></select></label></div><label><span>Site público</span><input value={sourceDraft.site_url} onChange={(e)=>setSourceDraft({...sourceDraft,site_url:e.target.value})} disabled={!isAdmin}/></label><label><span>Feed / endpoint</span><input value={sourceDraft.feed_url} onChange={(e)=>setSourceDraft({...sourceDraft,feed_url:e.target.value})} disabled={!isAdmin}/></label><div className="content-hub-form-grid"><label><span>Categoria padrão</span><select value={sourceDraft.default_category} onChange={(e)=>setSourceDraft({...sourceDraft,default_category:e.target.value})} disabled={!isAdmin}>{categories.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label><span>Confiança</span><select value={sourceDraft.trust_level} onChange={(e)=>setSourceDraft({...sourceDraft,trust_level:Number(e.target.value)})} disabled={!isAdmin}>{[0,1,2,3,4,5].map((v)=><option key={v} value={v}>{v}/5</option>)}</select></label></div><label className="content-hub-check"><input type="checkbox" checked={sourceDraft.requires_review} onChange={(e)=>setSourceDraft({...sourceDraft,requires_review:e.target.checked})} disabled={!isAdmin}/><span><strong>Exigir revisão humana</strong><small>Novo conteúdo entra na fila antes da publicação.</small></span></label><label><span>Crédito / atribuição</span><input value={sourceDraft.attribution_label} onChange={(e)=>setSourceDraft({...sourceDraft,attribution_label:e.target.value})} disabled={!isAdmin}/></label><label><span>Notas de licença</span><textarea rows={4} value={sourceDraft.license_notes} onChange={(e)=>setSourceDraft({...sourceDraft,license_notes:e.target.value})} disabled={!isAdmin}/></label>{isAdmin&&<button className="btn primary content-hub-save" type="submit" disabled={Boolean(busy)}><Save size={16}/>Salvar fonte</button>}</form></aside>}
    </div>}
  </div>;
}
