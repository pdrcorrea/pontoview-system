import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  FileImage,
  FileVideo,
  Globe2,
  ListVideo,
  MessageSquareText,
  Play,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
  Youtube,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { DriveThumbnail } from "../components/DriveThumbnail";
import { AsyncButton, EmptyState, FormMessage, Modal, PageHead, formData } from "../components/ui";
import { supabase } from "../lib/supabase";
import { seasonalCampaignByKey, seasonalCampaignRoute } from "../seasonalCampaigns";
import { formatDuration } from "../lib/youtube";
import type { Media, Playlist } from "../types";

type EditorItem = {
  id?: string;
  mediaId: string;
  name: string;
  type: string;
  durationSeconds: number | null;
  settings: Record<string, unknown>;
};

const PANEL_EMOJIS: Array<[string[], string]> = [
  [["previsao do tempo", "previsao", "tempo", "clima", "weather"], "🌤️"],
  [["hora exata", "relogio", "clock", "hora"], "🕒"],
  [["hoje", "calendario", "calendar"], "📅"],
  [["noticias", "news"], "📰"],
  [["economia", "mercado"], "📈"],
  [["cultura"], "🎭"],
  [["curiosidades"], "💡"],
  [["dicas de saude", "saude"], "❤️‍🩹"],
  [["saudacoes", "saudacao"], "👋"],
  [["orientacoes", "orientacao"], "📌"],
  [["sustentabilidade"], "🌱"],
  [["menu board", "menu_board", "cardapio"], "🍽️"],
  [["mensagens", "messages", "comunicado"], "💬"],
  [["busboard", "onibus", "rodoviaria"], "🚌"],
  [["setembro amarelo", "setembro_amarelo"], "🎗️"],
  [["outubro rosa", "outubro_rosa"], "🎀"],
  [["novembro azul", "novembro_azul"], "🔵"],
  [["natal"], "🎄"],
  [["ano novo", "ano_novo"], "✨"],
];

function normalizeText(value?: string | null) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function panelEmoji(item?: Media) {
  if (!item) return null;
  const isPanel = item.type === "app" || normalizeText(item.page_url).includes("/paineis/") || normalizeText(item.page_url).includes("pontoview");
  if (!isPanel) return null;
  const haystack = normalizeText(`${item.name} ${item.app_key || ""} ${item.page_url || ""}`);
  for (const [terms, emoji] of PANEL_EMOJIS) {
    if (terms.some((term) => haystack.includes(normalizeText(term)))) return emoji;
  }
  return item.type === "app" ? "✨" : null;
}

function mediaEmoji(item: Media) {
  const panel = panelEmoji(item);
  if (panel) return panel;
  if (item.type === "youtube") return "▶️";
  if (item.type === "drive_image") return "🖼️";
  if (item.type === "drive_video") return "🎞️";
  if (item.type === "message") return "💬";
  if (item.type === "webpage") return "🌐";
  return "✨";
}

function mediaTypeLabel(item: Media) {
  if (item.type === "app" && item.metadata?.seasonal) {
    const group = item.metadata?.seasonal_group || seasonalCampaignByKey(item.app_key)?.group;
    if (group === "holiday") return "Feriado";
    if (group === "commemorative") return "Data comemorativa";
    return "Campanha sazonal";
  }
  if (panelEmoji(item)) return "Painel PontoView";
  return ({ drive_image: "Imagem", drive_video: "Vídeo", youtube: "YouTube", webpage: "Página web", app: "Painel PontoView", message: "Comunicado" } as Record<string, string>)[item.type] || "Conteúdo";
}

function defaultDuration(item: Media) {
  if (item.duration_seconds != null) return item.duration_seconds;
  if (item.type === "drive_image") return 15;
  if (["webpage", "app", "message"].includes(item.type)) return 30;
  return null;
}

function toEditorItem(item: Media): EditorItem {
  return { mediaId: item.id, name: item.name, type: item.type, durationSeconds: defaultDuration(item), settings: {} };
}

export function PlaylistsPage() {
  const { organization, user } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Playlist | null>(null);
  const [editorItems, setEditorItems] = useState<EditorItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [librarySearch, setLibrarySearch] = useState("");
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);
  const [selectedPlaylistIndex, setSelectedPlaylistIndex] = useState<number | null>(null);
  const [compactEditor, setCompactEditor] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches);

  const mediaById = useMemo(() => new Map(media.map((item) => [item.id, item])), [media]);
  const filteredMedia = useMemo(() => {
    const query = normalizeText(librarySearch.trim());
    if (!query) return media;
    return media.filter((item) => normalizeText(`${item.name} ${mediaTypeLabel(item)}`).includes(query));
  }, [librarySearch, media]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 720px)");
    const update = () => setCompactEditor(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  const load = useCallback(async () => {
    if (!organization) return;
    const [p, m] = await Promise.all([
      supabase.from("playlists").select("*").eq("organization_id", organization.id).order("updated_at", { ascending: false }),
      supabase.from("media").select("*").eq("organization_id", organization.id).eq("status", "ready").order("name"),
    ]);
    if (p.error) setError(p.error.message); else setPlaylists((p.data || []) as Playlist[]);
    if (m.error) setError(m.error.message); else setMedia((m.data || []) as Media[]);
  }, [organization]);

  useEffect(() => { void load(); }, [load]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organization || !user) return;
    setBusy(true); setError(null);
    const data = formData(event);
    const result = await supabase.from("playlists").insert({ organization_id: organization.id, name: data.name, description: data.description || null, created_by: user.id, is_default: playlists.length === 0 }).select().single();
    setBusy(false);
    if (result.error) setError(result.error.message);
    else { setCreating(false); await load(); await openEditor(result.data as Playlist); }
  };

  const openEditor = async (playlist: Playlist) => {
    if (!organization) return;
    setEditing(playlist); setBusy(true); setError(null); setLibrarySearch(""); setSelectedLibraryId(null); setSelectedPlaylistIndex(null);
    const [itemsResult, mediaResult] = await Promise.all([
      supabase.from("playlist_items").select("id,media_id,position,duration_seconds,settings,media(name,type,duration_seconds)").eq("playlist_id", playlist.id).order("position"),
      supabase.from("media").select("*").eq("organization_id", organization.id).eq("status", "ready").order("name"),
    ]);
    setBusy(false);
    if (mediaResult.error) setError(mediaResult.error.message); else setMedia((mediaResult.data || []) as Media[]);
    if (itemsResult.error) setError(itemsResult.error.message);
    else setEditorItems((itemsResult.data || []).map((row: any) => ({ id: row.id, mediaId: row.media_id, name: row.media?.name || "Conteúdo", type: row.media?.type || "", durationSeconds: row.duration_seconds ?? row.media?.duration_seconds, settings: row.settings || {} })));
  };

  const addMedia = (id: string) => {
    const item = mediaById.get(id);
    if (!item) return;
    setEditorItems((rows) => [...rows, toEditorItem(item)]);
  };

  const addSelected = () => {
    if (!selectedLibraryId) return;
    addMedia(selectedLibraryId);
    setSelectedLibraryId(null);
  };

  const removeSelected = () => {
    if (selectedPlaylistIndex == null) return;
    setEditorItems((rows) => rows.filter((_, index) => index !== selectedPlaylistIndex));
    setSelectedPlaylistIndex(null);
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    setEditorItems((rows) => {
      const target = index + direction;
      if (target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSelectedPlaylistIndex((current) => current === index ? index + direction : current);
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true); setError(null);
    const result = await supabase.rpc("replace_playlist_items", { p_playlist_id: editing.id, p_items: editorItems.map((item) => ({ mediaId: item.mediaId, durationSeconds: item.durationSeconds, settings: item.settings })) });
    setBusy(false);
    if (result.error) setError(result.error.message); else { setEditing(null); await load(); }
  };

  const duplicate = async (playlist: Playlist) => {
    if (!organization || !user) return;
    setBusy(true); setError(null);
    const created = await supabase.from("playlists").insert({ organization_id: organization.id, name: `${playlist.name} — cópia`, description: playlist.description, created_by: user.id }).select().single();
    if (!created.error) {
      const rows = await supabase.from("playlist_items").select("media_id,duration_seconds,settings").eq("playlist_id", playlist.id).order("position");
      if (rows.data) await supabase.rpc("replace_playlist_items", { p_playlist_id: created.data.id, p_items: rows.data.map((row) => ({ mediaId: row.media_id, durationSeconds: row.duration_seconds, settings: row.settings })) });
    }
    setBusy(false);
    if (created.error) setError(created.error.message); else await load();
  };

  const remove = async (playlist: Playlist) => {
    if (playlist.is_default) { setError("A playlist principal não pode ser removida."); return; }
    if (!confirm(`Excluir “${playlist.name}”?`)) return;
    const result = await supabase.from("playlists").delete().eq("id", playlist.id);
    if (result.error) setError("Esta playlist ainda está vinculada a uma tela ou programação."); else await load();
  };

  return (
    <>
      <PageHead eyebrow="Programação" title="O que vai passar na TV?" text="Organize os conteúdos na ordem em que deseja exibir. Você pode ajustar a duração de cada item." action="Criar programação" onAction={() => setCreating(true)} />
      <FormMessage error={error} />

      {playlists.length ? (
        <div className="list-panel">
          {playlists.map((playlist) => (
            <article className="playlist-row" key={playlist.id}>
              <span className="playlist-icon"><Play size={17} /></span>
              <span className="grow"><b>{playlist.name}</b><small>Revisão {playlist.revision}{playlist.is_default ? " · Playlist principal" : ""}</small></span>
              {playlist.is_default && <span className="pill">Padrão</span>}
              <button className="btn tertiary" onClick={() => void openEditor(playlist)}>Editar</button>
              <button className="icon-button" title="Duplicar" onClick={() => void duplicate(playlist)}><Copy size={17} /></button>
              <button className="icon-button danger-hover" title="Excluir" onClick={() => void remove(playlist)}><Trash2 size={17} /></button>
            </article>
          ))}
        </div>
      ) : <EmptyState icon={<ListVideo />} title="Crie sua primeira playlist" text="Combine conteúdos da biblioteca e escolha a ordem de reprodução." action="Nova playlist" onAction={() => setCreating(true)} />}

      {creating && (
        <Modal eyebrow="NOVA PLAYLIST" title="Dê um nome à playlist" onClose={() => setCreating(false)}>
          <form className="youtube-form" onSubmit={create}>
            <label>Nome<input name="name" required autoFocus /></label>
            <label>Descrição <span>(opcional)</span><textarea name="description" rows={3} /></label>
            <div className="modal-actions"><button type="button" className="btn secondary" onClick={() => setCreating(false)}>Cancelar</button><AsyncButton busy={busy} className="btn primary">Criar e editar</AsyncButton></div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal eyebrow="EDITOR DE PLAYLIST" title={editing.name} onClose={() => setEditing(null)}>
          <div className="playlist-editor playlist-builder button-editor">
            {compactEditor ? (
              <>
                <label className="media-add playlist-mobile-add">Adicionar conteúdo
                  <select defaultValue="" onChange={(event) => { addMedia(event.target.value); event.target.value = ""; }}>
                    <option value="" disabled>Escolha na biblioteca…</option>
                    {media.map((item) => <option value={item.id} key={item.id}>{mediaEmoji(item)} {item.name}</option>)}
                  </select>
                </label>
                <PlaylistItems items={editorItems} mediaById={mediaById} selectedIndex={selectedPlaylistIndex} onSelect={setSelectedPlaylistIndex} onMove={moveItem} onDuration={(index, value) => setEditorItems((rows) => rows.map((row, i) => i === index ? { ...row, durationSeconds: value } : row))} onRemove={(index) => setEditorItems((rows) => rows.filter((_, i) => i !== index))} />
              </>
            ) : (
              <div className="playlist-builder-grid playlist-button-grid">
                <section className="playlist-builder-column library-column">
                  <div className="playlist-column-head"><div><small>BIBLIOTECA</small><h3>Conteúdos disponíveis</h3></div></div>
                  <label className="playlist-library-search"><Search size={15} /><input value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Buscar conteúdo" aria-label="Buscar conteúdo na biblioteca" /></label>
                  <div className="playlist-library-list">
                    {filteredMedia.length ? filteredMedia.map((item) => {
                      const count = editorItems.filter((row) => row.mediaId === item.id).length;
                      const selected = selectedLibraryId === item.id;
                      return (
                        <button type="button" className={`playlist-library-card playlist-select-card ${selected ? "selected" : ""}`} key={item.id} onClick={() => setSelectedLibraryId(selected ? null : item.id)}>
                          <MediaVisual item={item} />
                          <span className="grow playlist-library-info"><b>{item.name}</b><small>{mediaTypeLabel(item)}</small>{count > 0 && <em>{count}× na playlist</em>}</span>
                          <span className="playlist-select-indicator">{selected ? "Selecionado" : ""}</span>
                        </button>
                      );
                    }) : <div className="playlist-library-empty">Nenhum conteúdo encontrado.</div>}
                  </div>
                </section>

                <div className="playlist-transfer-controls" aria-label="Mover conteúdo entre biblioteca e playlist">
                  <button type="button" className="playlist-transfer-button primary" disabled={!selectedLibraryId} onClick={addSelected} title="Adicionar à playlist" aria-label="Adicionar conteúdo selecionado à playlist"><ChevronRight /></button>
                  <button type="button" className="playlist-transfer-button" disabled={selectedPlaylistIndex == null} onClick={removeSelected} title="Remover da playlist" aria-label="Remover conteúdo selecionado da playlist"><ChevronLeft /></button>
                </div>

                <section className="playlist-builder-column playlist-column">
                  <div className="playlist-column-head"><div><small>PLAYLIST</small><h3>Ordem de exibição</h3></div><span>{editorItems.length} {editorItems.length === 1 ? "item" : "itens"}</span></div>
                  <PlaylistItems items={editorItems} mediaById={mediaById} selectedIndex={selectedPlaylistIndex} onSelect={setSelectedPlaylistIndex} onMove={moveItem} onDuration={(index, value) => setEditorItems((rows) => rows.map((row, i) => i === index ? { ...row, durationSeconds: value } : row))} onRemove={(index) => { setEditorItems((rows) => rows.filter((_, i) => i !== index)); setSelectedPlaylistIndex(null); }} />
                </section>
              </div>
            )}

            <div className="editor-summary playlist-builder-summary"><span>{editorItems.length} itens</span><span>Duração estimada: {formatDuration(editorItems.reduce((sum, item) => sum + (item.durationSeconds || 0), 0))}</span></div>
            <div className="modal-actions playlist-builder-actions">
              <button className="btn secondary" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn secondary" disabled={!editorItems.length} onClick={() => setPreviewIndex(0)}><Play /> Pré-visualizar</button>
              <AsyncButton busy={busy} className="btn primary" onClick={() => void save()}><Save /> Salvar playlist</AsyncButton>
            </div>
          </div>
        </Modal>
      )}

      {previewIndex !== null && editorItems[previewIndex] && (
        <Modal eyebrow="PRÉ-VISUALIZAÇÃO" title={editing?.name || "Playlist"} onClose={() => setPreviewIndex(null)}>
          <div className="playlist-preview-stage"><MediaPreview item={mediaById.get(editorItems[previewIndex].mediaId)} name={editorItems[previewIndex].name} /></div>
          <div className="preview-controls">
            <button className="btn secondary" disabled={previewIndex === 0} onClick={() => setPreviewIndex((value) => Math.max(0, (value || 0) - 1))}><ChevronLeft /> Anterior</button>
            <span>{previewIndex + 1} de {editorItems.length}</span>
            <button className="btn secondary" disabled={previewIndex === editorItems.length - 1} onClick={() => setPreviewIndex((value) => Math.min(editorItems.length - 1, (value || 0) + 1))}>Próximo <ChevronRight /></button>
          </div>
        </Modal>
      )}
    </>
  );
}

function PlaylistItems({ items, mediaById, selectedIndex, onSelect, onMove, onDuration, onRemove }: { items: EditorItem[]; mediaById: Map<string, Media>; selectedIndex: number | null; onSelect: (index: number | null) => void; onMove: (index: number, direction: -1 | 1) => void; onDuration: (index: number, value: number | null) => void; onRemove: (index: number) => void; }) {
  if (!items.length) return <div className="playlist-drop-empty playlist-empty-static"><b>Playlist vazia</b><small>Selecione um conteúdo na Biblioteca e use o botão › para adicionar.</small></div>;
  return (
    <div className="editor-items playlist-editor-items playlist-static-items">
      {items.map((item, index) => {
        const mediaItem = mediaById.get(item.mediaId);
        const selected = selectedIndex === index;
        return (
          <article key={`${item.mediaId}-${index}`} className={`playlist-static-card ${selected ? "selected" : ""}`} onClick={() => onSelect(selected ? null : index)}>
            <MediaVisual item={mediaItem} fallbackName={item.name} compact />
            <span className="grow playlist-selected-info"><b>{item.name}</b><small>{mediaItem ? mediaTypeLabel(mediaItem) : item.type.replace(/_/g, " ")}</small></span>
            <label className="playlist-duration-control" onClick={(event) => event.stopPropagation()}>Duração<span><input type="number" min="1" value={item.durationSeconds ?? ""} placeholder="Auto" onChange={(event) => onDuration(index, event.target.value ? Number(event.target.value) : null)} /><small>seg</small></span></label>
            <div className="playlist-order-buttons" aria-label="Alterar ordem" onClick={(event) => event.stopPropagation()}>
              <button type="button" className="icon-button" disabled={index === 0} title="Mover para cima" onClick={() => onMove(index, -1)}><ChevronUp size={16} /></button>
              <button type="button" className="icon-button" disabled={index === items.length - 1} title="Mover para baixo" onClick={() => onMove(index, 1)}><ChevronDown size={16} /></button>
            </div>
            <button type="button" className="icon-button playlist-remove-button" title="Remover da playlist" onClick={(event) => { event.stopPropagation(); onRemove(index); }}><X /></button>
          </article>
        );
      })}
    </div>
  );
}

function MediaVisual({ item, fallbackName, compact = false }: { item?: Media; fallbackName?: string; compact?: boolean }) {
  const className = `playlist-media-thumb${compact ? " compact" : ""}`;
  if (!item) return <span className={`${className} emoji`} aria-hidden="true">✨</span>;
  const emoji = panelEmoji(item);
  if (emoji) return <span className={`${className} emoji`} aria-hidden="true">{emoji}</span>;
  if (item.type === "youtube") {
    const src = item.thumbnail_url || (item.youtube_video_id ? `https://i.ytimg.com/vi/${item.youtube_video_id}/hqdefault.jpg` : null);
    return <span className={className}><Youtube className="playlist-thumb-fallback" />{src && <img src={src} alt="" loading="lazy" />}</span>;
  }
  if (item.type === "drive_image" || item.type === "drive_video") return <span className={className}>{item.type === "drive_video" ? <FileVideo className="playlist-thumb-fallback" /> : <FileImage className="playlist-thumb-fallback" />}<DriveThumbnail mediaId={item.id} /></span>;
  if (item.thumbnail_url) return <span className={className}><img src={item.thumbnail_url} alt="" loading="lazy" /></span>;
  if (item.type === "message") return <span className={className}><MessageSquareText /></span>;
  if (item.type === "webpage") return <span className={className}><Globe2 /></span>;
  if (item.type === "app") return <span className={className}><Sparkles /></span>;
  return <span className={`${className} emoji`} aria-hidden="true">{fallbackName ? "✨" : "▶️"}</span>;
}

function MediaPreview({ item, name }: { item?: Media; name: string }) {
  if (!item) return <div className="preview-fallback"><Play /><b>{name}</b></div>;
  if (item.type === "youtube" && item.youtube_video_id) return <iframe title={name} src={`https://www.youtube.com/embed/${item.youtube_video_id}?autoplay=0&controls=1`} allow="encrypted-media; picture-in-picture" />;
  if (item.type === "webpage" && item.page_url) return <iframe title={name} src={item.page_url} sandbox="allow-scripts allow-same-origin allow-forms" />;
  if (item.type === "app" && item.app_key) {
    const route = seasonalCampaignRoute(item.app_key);
    if (route) return <iframe title={name} src={route} sandbox="allow-scripts allow-same-origin" />;
  }
  if (item.thumbnail_url) return <img src={item.thumbnail_url} alt={`Prévia de ${name}`} />;
  if (item.type === "message") return <div className="preview-message"><b>{String(item.message_content?.title || name)}</b><p>{String(item.message_content?.body || "")}</p></div>;
  return <div className="preview-fallback"><span className="playlist-preview-emoji">{mediaEmoji(item)}</span><b>{name}</b><small>{mediaTypeLabel(item)}</small></div>;
}
