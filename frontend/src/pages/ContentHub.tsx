import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { FormMessage, formatDate, invokeFunction as _unused, timeAgo } from "../components/ui";
import { invokeFunction } from "../lib/supabase";
import "../content-hub.css";

type HubTab = "overview" | "queue" | "sources";
type ContentStatus = "review" | "approved" | "published" | "rejected" | "expired" | "archived";

type ContentItem = {
  id: string;
  source_id: string | null;
  content_type: string;
  category: string;
  slug: string;
  title: string;
  summary: string | null;
  body: string | null;
  image_url: string | null;
  source_name: string;
  source_url: string | null;
  source_author: string | null;
  source_published_at: string | null;
  status: ContentStatus | "imported";
  editorial_flags: Array<{ code?: string; stage?: string }>;
  review_notes: string | null;
  imported_at: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

type ContentSource = {
  id: string;
  name: string;
  slug: string;
  source_type: "rss" | "api" | "manual" | "partner";
  site_url: string | null;
  feed_url: string | null;
  default_content_type: string;
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
  created_at: string;
  updated_at: string;
};

type DashboardData = {
  counts: Record<"review" | "approved" | "published" | "scheduled" | "rejected" | "expired" | "archived", number>;
  sources: Pick<ContentSource, "id" | "name" | "slug" | "source_type" | "is_active" | "last_ingested_at" | "last_ingest_status" | "last_ingest_count" | "last_ingest_error">[];
  recent: Pick<ContentItem, "id" | "title" | "source_name" | "status" | "category" | "imported_at" | "published_at" | "image_url">[];
};

type SourceDraft = {
  id?: string;
  name: string;
  slug: string;
  source_type: ContentSource["source_type"];
  site_url: string;
  feed_url: string;
  default_category: string;
  requires_review: boolean;
  trust_level: number;
  attribution_label: string;
  license_notes: string;
};

const statusTabs: Array<[ContentStatus, string]> = [
  ["review", "Revisão"],
  ["approved", "Aprovadas"],
  ["published", "Publicadas"],
  ["rejected", "Rejeitadas"],
  ["expired", "Expiradas"],
  ["archived", "Arquivadas"],
];

const categories = [
  ["general", "Geral"],
  ["local", "Local"],
  ["economy", "Economia"],
  ["sports", "Esportes"],
  ["technology", "Tecnologia"],
  ["health", "Saúde"],
] as const;

const blankSource: SourceDraft = {
  name: "",
  slug: "",
  source_type: "api",
  site_url: "",
  feed_url: "",
  default_category: "general",
  requires_review: true,
  trust_level: 1,
  attribution_label: "",
  license_notes: "",
};

function isScheduled(item: Pick<ContentItem, "status" | "published_at">) {
  return item.status === "published" && Boolean(item.published_at) && new Date(item.published_at as string).getTime() > Date.now();
}

function statusLabel(item: Pick<ContentItem, "status" | "published_at">) {
  if (isScheduled(item)) return "Agendada";
  const labels: Record<string, string> = {
    imported: "Importada",
    review: "Em revisão",
    approved: "Aprovada",
    published: "Publicada",
    rejected: "Rejeitada",
    expired: "Expirada",
    archived: "Arquivada",
  };
  return labels[item.status] || item.status;
}

function categoryLabel(value: string) {
  return categories.find(([key]) => key === value)?.[1] || value;
}

function sourceDraft(source: ContentSource): SourceDraft {
  return {
    id: source.id,
    name: source.name,
    slug: source.slug,
    source_type: source.source_type,
    site_url: source.site_url || "",
    feed_url: source.feed_url || "",
    default_category: source.default_category || "general",
    requires_review: source.requires_review,
    trust_level: source.trust_level,
    attribution_label: source.attribution_label || "",
    license_notes: source.license_notes || "",
  };
}

function localDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

export function ContentHubPage() {
  const { user } = useAuth();
  const hubRole = String(user?.app_metadata?.content_hub_role || "");
  const canManageSources = hubRole === "admin";
  const [tab, setTab] = useState<HubTab>("overview");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [queueStatus, setQueueStatus] = useState<ContentStatus>("review");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<ContentItem | null>(null);
  const [sourceEditor, setSourceEditor] = useState<SourceDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");

  const clearMessage = () => {
    setError(null);
    setSuccess(null);
  };

  const loadDashboard = useCallback(async () => {
    const result = await invokeFunction<DashboardData>("content-editorial", { action: "dashboard" });
    setDashboard(result);
  }, []);

  const loadItems = useCallback(async (status = queueStatus, query = search, selectedCategory = category) => {
    const result = await invokeFunction<{ items: ContentItem[] }>("content-editorial", {
      action: "list_items",
      status,
      search: query,
      category: selectedCategory,
      limit: 80,
    });
    setItems(result.items || []);
    setSelected((current) => current ? (result.items || []).find((item) => item.id === current.id) || null : null);
  }, [queueStatus, search, category]);

  const loadSources = useCallback(async () => {
    const result = await invokeFunction<{ sources: ContentSource[] }>("content-editorial", { action: "list_sources" });
    setSources(result.sources || []);
  }, []);

  const refreshAll = useCallback(async () => {
    clearMessage();
    setLoading(true);
    try {
      await Promise.all([loadDashboard(), loadItems(), loadSources()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar a Central de Conteúdo.");
    } finally {
      setLoading(false);
    }
  }, [loadDashboard, loadItems, loadSources]);

  useEffect(() => { void refreshAll(); }, [refreshAll]);

  useEffect(() => {
    if (tab !== "queue") return;
    const timer = window.setTimeout(() => {
      void loadItems(queueStatus, search, category).catch((reason) => setError(reason instanceof Error ? reason.message : "Falha ao atualizar a fila."));
    }, 260);
    return () => window.clearTimeout(timer);
  }, [tab, queueStatus, search, category, loadItems]);

  useEffect(() => {
    setScheduleAt(selected && isScheduled(selected) ? localDateTime(selected.published_at) : "");
  }, [selected?.id, selected?.published_at]);

  const stats = useMemo(() => dashboard?.counts || {
    review: 0, approved: 0, published: 0, scheduled: 0, rejected: 0, expired: 0, archived: 0,
  }, [dashboard]);

  const sourceHealth = useMemo(() => {
    const rows = dashboard?.sources || [];
    return {
      total: rows.length,
      active: rows.filter((source) => source.is_active).length,
      warning: rows.filter((source) => source.last_ingest_status === "error").length,
    };
  }, [dashboard]);

  async function runItemAction(action: string, extra: Record<string, unknown> = {}) {
    if (!selected) return;
    clearMessage();
    setBusy(`${action}:${selected.id}`);
    try {
      const result = await invokeFunction<{ item: ContentItem }>("content-editorial", { action, id: selected.id, ...extra });
      setSelected(result.item);
      setSuccess(action === "reject" ? "Conteúdo rejeitado." : action === "archive" ? "Conteúdo arquivado." : "Alteração editorial salva.");
      await Promise.all([loadDashboard(), loadItems()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível concluir a ação editorial.");
    } finally {
      setBusy(null);
    }
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    clearMessage();
    setBusy(`save:${selected.id}`);
    const form = new FormData(event.currentTarget);
    try {
      const result = await invokeFunction<{ item: ContentItem }>("content-editorial", {
        action: "update_item",
        id: selected.id,
        title: form.get("title"),
        summary: form.get("summary"),
        image_url: form.get("image_url"),
        category: form.get("category"),
        source_author: form.get("source_author"),
        review_notes: form.get("review_notes"),
        expires_at: form.get("expires_at") || null,
      });
      setSelected(result.item);
      setSuccess("Edição salva.");
      await Promise.all([loadDashboard(), loadItems()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar a edição.");
    } finally {
      setBusy(null);
    }
  }

  async function scheduleSelected() {
    if (!scheduleAt) {
      setError("Escolha uma data e horário para a publicação.");
      return;
    }
    await runItemAction("schedule", { publish_at: new Date(scheduleAt).toISOString() });
  }

  async function importSource(source: ContentSource) {
    clearMessage();
    setBusy(`ingest:${source.id}`);
    try {
      const result = await invokeFunction<{ inserted: number; received: number; duplicate_or_existing: number }>("content-news-ingest", { source_slug: source.slug });
      setSuccess(`${result.inserted} nova(s) notícia(s) adicionada(s) à Central de ${result.received} recebidas.`);
      await Promise.all([loadDashboard(), loadItems(), loadSources()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível buscar novos conteúdos.");
    } finally {
      setBusy(null);
    }
  }

  async function saveSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sourceEditor || !canManageSources) return;
    clearMessage();
    setBusy(`source:${sourceEditor.id || "new"}`);
    try {
      const action = sourceEditor.id ? "update_source" : "create_source";
      await invokeFunction("content-editorial", { action, source_id: sourceEditor.id, ...sourceEditor });
      setSuccess(sourceEditor.id ? "Fonte atualizada." : "Fonte adicionada.");
      setSourceEditor(null);
      await Promise.all([loadDashboard(), loadSources()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar a fonte.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleSource(source: ContentSource) {
    if (!canManageSources) return;
    clearMessage();
    setBusy(`toggle:${source.id}`);
    try {
      await invokeFunction("content-editorial", { action: "toggle_source", source_id: source.id, is_active: !source.is_active });
      await Promise.all([loadDashboard(), loadSources()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível alterar a fonte.");
    } finally {
      setBusy(null);
    }
  }

  function openQueue(status: ContentStatus) {
    setQueueStatus(status);
    setTab("queue");
  }

  return (
    <div className="content-hub-page">
      <section className="content-hub-hero">
        <div>
          <span className="content-hub-kicker"><Newspaper size={15} /> Editorial PontoView</span>
          <h1>Central de Conteúdo</h1>
          <p>Revise, organize e publique o que chega às telas PontoView.</p>
        </div>
        <div className="content-hub-hero-actions">
          <span className="content-hub-role"><ShieldCheck size={15} /> {hubRole === "admin" ? "Administrador" : "Editor"}</span>
          <button className="btn" onClick={() => void refreshAll()} disabled={loading || Boolean(busy)}>
            <RefreshCw size={16} className={loading ? "spin" : ""} /> Atualizar
          </button>
        </div>
      </section>

      <nav className="content-hub-tabs" aria-label="Áreas da Central de Conteúdo">
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}><LayoutDashboard size={17} /> Visão geral</button>
        <button className={tab === "queue" ? "active" : ""} onClick={() => setTab("queue")}><Inbox size={17} /> Fila editorial {stats.review > 0 && <b>{stats.review}</b>}</button>
        <button className={tab === "sources" ? "active" : ""} onClick={() => setTab("sources")}><Database size={17} /> Fontes</button>
      </nav>

      <FormMessage error={error} success={success} />

      {loading && !dashboard ? (
        <div className="content-hub-loading"><Loader2 className="spin" /><span>Organizando a redação digital…</span></div>
      ) : tab === "overview" ? (
        <div className="content-hub-overview">
          <section className="content-hub-stats">
            <button className="content-hub-stat attention" onClick={() => openQueue("review")}>
              <span><Inbox size={18} /> Para revisar</span><strong>{stats.review}</strong><small>aguardando decisão editorial</small>
            </button>
            <button className="content-hub-stat" onClick={() => openQueue("approved")}>
              <span><CheckCircle2 size={18} /> Aprovadas</span><strong>{stats.approved}</strong><small>prontas para publicar</small>
            </button>
            <button className="content-hub-stat positive" onClick={() => openQueue("published")}>
              <span><Send size={18} /> Publicadas</span><strong>{stats.published}</strong><small>disponíveis para distribuição</small>
            </button>
            <button className="content-hub-stat" onClick={() => openQueue("published")}>
              <span><Clock3 size={18} /> Agendadas</span><strong>{stats.scheduled}</strong><small>entram no ar automaticamente</small>
            </button>
          </section>

          <div className="content-hub-overview-grid">
            <section className="content-hub-card">
              <div className="content-hub-card-head">
                <div><small>Fluxo editorial</small><h2>Atividade recente</h2></div>
                <button className="content-hub-text-action" onClick={() => setTab("queue")}>Abrir fila</button>
              </div>
              <div className="content-hub-recent-list">
                {(dashboard?.recent || []).length ? dashboard?.recent.map((item) => (
                  <button key={item.id} onClick={() => { setQueueStatus((item.status === "imported" ? "review" : item.status) as ContentStatus); setTab("queue"); }}>
                    <span className="content-hub-recent-thumb">{item.image_url ? <img src={item.image_url} alt="" /> : <ImageIcon size={18} />}</span>
                    <span className="content-hub-recent-copy"><strong>{item.title}</strong><small>{item.source_name} · {categoryLabel(item.category)}</small></span>
                    <span className={`content-hub-status ${isScheduled(item) ? "scheduled" : item.status}`}>{statusLabel(item)}</span>
                  </button>
                )) : <div className="content-hub-soft-empty">A atividade editorial aparecerá aqui quando a Central começar a receber conteúdo.</div>}
              </div>
            </section>

            <section className="content-hub-card content-hub-source-health">
              <div className="content-hub-card-head">
                <div><small>Ingestão</small><h2>Saúde das fontes</h2></div>
                <button className="content-hub-text-action" onClick={() => setTab("sources")}>Gerenciar</button>
              </div>
              <div className="content-hub-health-numbers">
                <div><strong>{sourceHealth.active}</strong><span>ativas</span></div>
                <div><strong>{sourceHealth.total}</strong><span>cadastradas</span></div>
                <div className={sourceHealth.warning ? "warning" : ""}><strong>{sourceHealth.warning}</strong><span>com falha</span></div>
              </div>
              <div className="content-hub-source-mini-list">
                {(dashboard?.sources || []).slice(0, 4).map((source) => (
                  <div key={source.id}>
                    <span className={`content-hub-source-dot ${source.last_ingest_status || "idle"}`} />
                    <span><strong>{source.name}</strong><small>{source.last_ingested_at ? `Última coleta ${timeAgo(source.last_ingested_at)}` : "Ainda não coletada"}</small></span>
                    <b>{source.last_ingest_count || 0}</b>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      ) : tab === "queue" ? (
        <div className={`content-hub-workspace ${selected ? "editor-open" : ""}`}>
          <section className="content-hub-queue">
            <div className="content-hub-queue-toolbar">
              <div className="content-hub-status-tabs">
                {statusTabs.map(([value, label]) => <button key={value} className={queueStatus === value ? "active" : ""} onClick={() => { setQueueStatus(value); setSelected(null); }}>{label}</button>)}
              </div>
              <div className="content-hub-filters">
                <label className="content-hub-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar manchete ou fonte" /></label>
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option value="all">Todas as categorias</option>
                  {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>

            <div className="content-hub-list">
              {items.length ? items.map((item) => (
                <button key={item.id} className={`content-hub-item ${selected?.id === item.id ? "active" : ""}`} onClick={() => setSelected(item)}>
                  <span className="content-hub-item-image">{item.image_url ? <img src={item.image_url} alt="" loading="lazy" /> : <ImageIcon size={20} />}</span>
                  <span className="content-hub-item-copy">
                    <span className="content-hub-item-meta"><b>{item.source_name}</b><i>{categoryLabel(item.category)}</i></span>
                    <strong>{item.title}</strong>
                    <small>{item.summary || "Sem resumo disponível."}</small>
                    <span className="content-hub-item-foot"><em>{item.imported_at ? timeAgo(item.imported_at) : ""}</em>{item.editorial_flags?.length > 0 && <i>{item.editorial_flags.length} alerta(s)</i>}</span>
                  </span>
                  <span className={`content-hub-status ${isScheduled(item) ? "scheduled" : item.status}`}>{statusLabel(item)}</span>
                </button>
              )) : <div className="content-hub-empty-list"><Inbox size={24} /><strong>Nada por aqui</strong><span>Não há conteúdos neste estado com os filtros atuais.</span></div>}
            </div>
          </section>

          {selected && (
            <aside className="content-hub-editor">
              <div className="content-hub-editor-head">
                <div><small>{selected.source_name}</small><span className={`content-hub-status ${isScheduled(selected) ? "scheduled" : selected.status}`}>{statusLabel(selected)}</span></div>
                <button className="icon-button" onClick={() => setSelected(null)} aria-label="Fechar editor"><X size={18} /></button>
              </div>

              <form onSubmit={saveItem} className="content-hub-editor-form">
                <div className="content-hub-preview-image">{selected.image_url ? <img src={selected.image_url} alt="Prévia" /> : <span><ImageIcon size={24} /> Sem imagem</span>}</div>
                <label><span>Manchete</span><textarea name="title" defaultValue={selected.title} rows={3} /></label>
                <label><span>Resumo</span><textarea name="summary" defaultValue={selected.summary || ""} rows={5} /></label>
                <div className="content-hub-form-grid">
                  <label><span>Categoria</span><select name="category" defaultValue={selected.category}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label><span>Autor original</span><input name="source_author" defaultValue={selected.source_author || ""} /></label>
                </div>
                <label><span>URL da imagem</span><input name="image_url" defaultValue={selected.image_url || ""} placeholder="https://…" /></label>
                <label><span>Expira em</span><input name="expires_at" type="datetime-local" defaultValue={localDateTime(selected.expires_at)} /></label>
                <label><span>Notas editoriais</span><textarea name="review_notes" defaultValue={selected.review_notes || ""} rows={3} placeholder="Observações internas. Não aparecem no player." /></label>

                <div className="content-hub-source-reference">
                  <span><strong>Origem</strong><small>{selected.source_published_at ? `Publicado na fonte em ${formatDate(selected.source_published_at)}` : "Data original não informada"}</small></span>
                  {selected.source_url && <a href={selected.source_url} target="_blank" rel="noreferrer">Abrir original <ExternalLink size={14} /></a>}
                </div>

                {selected.editorial_flags?.length > 0 && <div className="content-hub-flags"><strong>Alertas da ingestão</strong>{selected.editorial_flags.map((flag, index) => <span key={`${flag.code}-${index}`}>{flag.code || "revisão necessária"}</span>)}</div>}

                <button className="btn content-hub-save" type="submit" disabled={Boolean(busy) || selected.status === "archived"}>{busy === `save:${selected.id}` ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Salvar edição</button>
              </form>

              <div className="content-hub-editor-actions">
                {(selected.status === "review" || selected.status === "imported") && <>
                  <button className="btn" onClick={() => void runItemAction("approve")} disabled={Boolean(busy)}><Check size={16} /> Aprovar</button>
                  <button className="btn primary" onClick={() => void runItemAction("approve_and_publish")} disabled={Boolean(busy)}><Send size={16} /> Aprovar e publicar</button>
                  <button className="btn danger-soft" onClick={() => void runItemAction("reject")} disabled={Boolean(busy)}><X size={16} /> Rejeitar</button>
                </>}
                {selected.status === "approved" && <>
                  <button className="btn primary" onClick={() => void runItemAction("publish")} disabled={Boolean(busy)}><Send size={16} /> Publicar agora</button>
                  <div className="content-hub-schedule"><input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} /><button className="btn" type="button" onClick={() => void scheduleSelected()} disabled={Boolean(busy)}><Clock3 size={16} /> Agendar</button></div>
                  <button className="btn danger-soft" onClick={() => void runItemAction("reject")} disabled={Boolean(busy)}><X size={16} /> Rejeitar</button>
                </>}
                {selected.status === "published" && <button className="btn danger-soft" onClick={() => void runItemAction("expire")} disabled={Boolean(busy)}><Clock3 size={16} /> Encerrar publicação</button>}
                {["rejected", "expired", "archived"].includes(selected.status) && <button className="btn" onClick={() => void runItemAction("restore_to_review")} disabled={Boolean(busy)}><RotateCcw size={16} /> Voltar para revisão</button>}
                {selected.status !== "archived" && <button className="btn ghost" onClick={() => void runItemAction("archive")} disabled={Boolean(busy)}><Archive size={16} /> Arquivar</button>}
              </div>
            </aside>
          )}
        </div>
      ) : (
        <div className={`content-hub-sources-layout ${sourceEditor ? "editor-open" : ""}`}>
          <section className="content-hub-sources">
            <div className="content-hub-section-head">
              <div><small>Origem e rastreabilidade</small><h2>Fontes de conteúdo</h2><p>Controle quais provedores alimentam a Central e acompanhe a saúde de cada coleta.</p></div>
              {canManageSources && <button className="btn primary" onClick={() => setSourceEditor({ ...blankSource })}><Plus size={16} /> Nova fonte</button>}
            </div>

            <div className="content-hub-source-grid">
              {sources.map((source) => (
                <article key={source.id} className={`content-hub-source-card ${!source.is_active ? "inactive" : ""}`}>
                  <div className="content-hub-source-card-head">
                    <span className={`content-hub-source-mark ${source.last_ingest_status || "idle"}`}><Radio size={18} /></span>
                    <span><strong>{source.name}</strong><small>{source.source_type.toUpperCase()} · confiança {source.trust_level}/5</small></span>
                    <span className={`content-hub-status ${source.is_active ? "published" : "archived"}`}>{source.is_active ? "Ativa" : "Pausada"}</span>
                  </div>
                  <div className="content-hub-source-details">
                    <span><small>Última coleta</small><strong>{source.last_ingested_at ? timeAgo(source.last_ingested_at) : "Nunca"}</strong></span>
                    <span><small>Novos itens</small><strong>{source.last_ingest_count || 0}</strong></span>
                    <span><small>Revisão</small><strong>{source.requires_review ? "Obrigatória" : "Automática"}</strong></span>
                  </div>
                  {source.last_ingest_error && <p className="content-hub-source-error">{source.last_ingest_error}</p>}
                  <div className="content-hub-source-actions">
                    {source.is_active && ["api", "partner"].includes(source.source_type) && <button className="btn" onClick={() => void importSource(source)} disabled={Boolean(busy)}>{busy === `ingest:${source.id}` ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />} Buscar agora</button>}
                    <button className="btn" onClick={() => setSourceEditor(sourceDraft(source))}><PencilLine size={15} /> {canManageSources ? "Editar" : "Detalhes"}</button>
                    {canManageSources && <button className="icon-button" onClick={() => void toggleSource(source)} disabled={Boolean(busy)} title={source.is_active ? "Pausar fonte" : "Ativar fonte"}><Power size={16} /></button>}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {sourceEditor && (
            <aside className="content-hub-editor content-hub-source-editor">
              <div className="content-hub-editor-head"><div><small>Catálogo editorial</small><strong>{sourceEditor.id ? "Configurar fonte" : "Nova fonte"}</strong></div><button className="icon-button" onClick={() => setSourceEditor(null)}><X size={18} /></button></div>
              <form onSubmit={saveSource} className="content-hub-editor-form">
                <label><span>Nome</span><input value={sourceEditor.name} onChange={(event) => setSourceEditor({ ...sourceEditor, name: event.target.value })} disabled={!canManageSources} required /></label>
                <div className="content-hub-form-grid">
                  <label><span>Identificador</span><input value={sourceEditor.slug} onChange={(event) => setSourceEditor({ ...sourceEditor, slug: event.target.value })} disabled={!canManageSources} placeholder="gerado pelo nome" /></label>
                  <label><span>Tipo</span><select value={sourceEditor.source_type} onChange={(event) => setSourceEditor({ ...sourceEditor, source_type: event.target.value as ContentSource["source_type"] })} disabled={!canManageSources}><option value="api">API</option><option value="rss">RSS</option><option value="partner">Parceiro</option><option value="manual">Manual</option></select></label>
                </div>
                <label><span>Site público</span><input value={sourceEditor.site_url} onChange={(event) => setSourceEditor({ ...sourceEditor, site_url: event.target.value })} disabled={!canManageSources} placeholder="https://…" /></label>
                <label><span>Feed / endpoint</span><input value={sourceEditor.feed_url} onChange={(event) => setSourceEditor({ ...sourceEditor, feed_url: event.target.value })} disabled={!canManageSources} placeholder="https://…" /></label>
                <div className="content-hub-form-grid">
                  <label><span>Categoria padrão</span><select value={sourceEditor.default_category} onChange={(event) => setSourceEditor({ ...sourceEditor, default_category: event.target.value })} disabled={!canManageSources}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label><span>Confiança</span><select value={sourceEditor.trust_level} onChange={(event) => setSourceEditor({ ...sourceEditor, trust_level: Number(event.target.value) })} disabled={!canManageSources}>{[0,1,2,3,4,5].map((value) => <option key={value} value={value}>{value}/5</option>)}</select></label>
                </div>
                <label className="content-hub-check"><input type="checkbox" checked={sourceEditor.requires_review} onChange={(event) => setSourceEditor({ ...sourceEditor, requires_review: event.target.checked })} disabled={!canManageSources} /><span><strong>Exigir revisão humana</strong><small>Conteúdos novos entram na fila antes de qualquer publicação.</small></span></label>
                <label><span>Crédito / atribuição</span><input value={sourceEditor.attribution_label} onChange={(event) => setSourceEditor({ ...sourceEditor, attribution_label: event.target.value })} disabled={!canManageSources} /></label>
                <label><span>Notas de licença</span><textarea rows={4} value={sourceEditor.license_notes} onChange={(event) => setSourceEditor({ ...sourceEditor, license_notes: event.target.value })} disabled={!canManageSources} /></label>
                {canManageSources && <button className="btn primary content-hub-save" type="submit" disabled={Boolean(busy)}>{busy?.startsWith("source:") ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Salvar fonte</button>}
              </form>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
