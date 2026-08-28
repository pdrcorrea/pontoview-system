import {
  useCallback,
  useEffect,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  Copy,
  GripVertical,
  ListVideo,
  Play,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import {
  AsyncButton,
  EmptyState,
  FormMessage,
  Modal,
  PageHead,
  formData,
} from "../components/ui";
import { supabase } from "../lib/supabase";
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

export function PlaylistsPage() {
  const { organization, user } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Playlist | null>(null);
  const [editorItems, setEditorItems] = useState<EditorItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const load = useCallback(async () => {
    if (!organization) return;
    const [p, m] = await Promise.all([
      supabase
        .from("playlists")
        .select("*")
        .eq("organization_id", organization.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("media")
        .select("*")
        .eq("organization_id", organization.id)
        .eq("status", "ready")
        .order("name"),
    ]);
    if (p.error) setError(p.error.message);
    else setPlaylists((p.data || []) as Playlist[]);
    if (m.data) setMedia(m.data as Media[]);
  }, [organization]);
  useEffect(() => {
    void load();
  }, [load]);
  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!organization || !user) return;
    setBusy(true);
    const data = formData(e);
    const result = await supabase
      .from("playlists")
      .insert({
        organization_id: organization.id,
        name: data.name,
        description: data.description || null,
        created_by: user.id,
        is_default: playlists.length === 0,
      })
      .select()
      .single();
    setBusy(false);
    if (result.error) setError(result.error.message);
    else {
      setCreating(false);
      await load();
      await openEditor(result.data as Playlist);
    }
  };
  const openEditor = async (p: Playlist) => {
    setEditing(p);
    setBusy(true);
    setError(null);
    const result = await supabase
      .from("playlist_items")
      .select(
        "id,media_id,position,duration_seconds,settings,media(name,type,duration_seconds)",
      )
      .eq("playlist_id", p.id)
      .order("position");
    setBusy(false);
    if (result.error) setError(result.error.message);
    else
      setEditorItems(
        (result.data || []).map((row: any) => ({
          id: row.id,
          mediaId: row.media_id,
          name: row.media?.name || "Conteúdo",
          type: row.media?.type || "",
          durationSeconds: row.duration_seconds ?? row.media?.duration_seconds,
          settings: row.settings || {},
        })),
      );
  };
  const addMedia = (id: string) => {
    const item = media.find((x) => x.id === id);
    if (!item) return;
    setEditorItems((v) => [
      ...v,
      {
        mediaId: item.id,
        name: item.name,
        type: item.type,
        durationSeconds:
          item.duration_seconds ??
          (item.type === "drive_image"
            ? 15
            : item.type === "webpage" ||
                item.type === "app" ||
                item.type === "message"
              ? 30
              : null),
        settings: {},
      },
    ]);
  };
  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    const result = await supabase.rpc("replace_playlist_items", {
      p_playlist_id: editing.id,
      p_items: editorItems.map((item) => ({
        mediaId: item.mediaId,
        durationSeconds: item.durationSeconds,
        settings: item.settings,
      })),
    });
    setBusy(false);
    if (result.error) setError(result.error.message);
    else {
      setEditing(null);
      await load();
    }
  };
  const duplicate = async (p: Playlist) => {
    if (!organization || !user) return;
    setBusy(true);
    const created = await supabase
      .from("playlists")
      .insert({
        organization_id: organization.id,
        name: `${p.name} — cópia`,
        description: p.description,
        created_by: user.id,
      })
      .select()
      .single();
    if (!created.error) {
      const rows = await supabase
        .from("playlist_items")
        .select("media_id,duration_seconds,settings")
        .eq("playlist_id", p.id)
        .order("position");
      if (rows.data)
        await supabase.rpc("replace_playlist_items", {
          p_playlist_id: created.data.id,
          p_items: rows.data.map((r) => ({
            mediaId: r.media_id,
            durationSeconds: r.duration_seconds,
            settings: r.settings,
          })),
        });
    }
    setBusy(false);
    if (created.error) setError(created.error.message);
    else await load();
  };
  const remove = async (p: Playlist) => {
    if (p.is_default) {
      setError("A playlist principal não pode ser removida.");
      return;
    }
    if (!confirm(`Excluir “${p.name}”?`)) return;
    const result = await supabase.from("playlists").delete().eq("id", p.id);
    if (result.error)
      setError("Esta playlist ainda está vinculada a uma tela ou programação.");
    else await load();
  };
  const drop = (event: DragEvent, index: number) => {
    event.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setEditorItems((rows) => {
      const next = [...rows];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setDragIndex(null);
  };
  return (
    <>
      <PageHead
        eyebrow="Organização"
        title="Playlists"
        text="Defina a ordem, duração e opções de cada conteúdo exibido."
        action="Nova playlist"
        onAction={() => setCreating(true)}
      />
      <FormMessage error={error} />
      {playlists.length ? (
        <div className="list-panel">
          {playlists.map((p) => (
            <article className="playlist-row" key={p.id}>
              <span className="playlist-icon">
                <Play size={17} />
              </span>
              <span className="grow">
                <b>{p.name}</b>
                <small>
                  Revisão {p.revision}
                  {p.is_default ? " · Playlist principal" : ""}
                </small>
              </span>
              {p.is_default && <span className="pill">Padrão</span>}
              <button
                className="btn tertiary"
                onClick={() => void openEditor(p)}
              >
                Editar
              </button>
              <button
                className="icon-button"
                title="Duplicar"
                onClick={() => void duplicate(p)}
              >
                <Copy size={17} />
              </button>
              <button
                className="icon-button danger-hover"
                title="Excluir"
                onClick={() => void remove(p)}
              >
                <Trash2 size={17} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<ListVideo />}
          title="Crie sua primeira playlist"
          text="Combine conteúdos da biblioteca e escolha a ordem de reprodução."
          action="Nova playlist"
          onAction={() => setCreating(true)}
        />
      )}
      {creating && (
        <Modal
          eyebrow="NOVA PLAYLIST"
          title="Dê um nome à playlist"
          onClose={() => setCreating(false)}
        >
          <form className="youtube-form" onSubmit={create}>
            <label>
              Nome
              <input name="name" required autoFocus />
            </label>
            <label>
              Descrição <span>(opcional)</span>
              <textarea name="description" rows={3} />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setCreating(false)}
              >
                Cancelar
              </button>
              <AsyncButton busy={busy} className="btn primary">
                Criar e editar
              </AsyncButton>
            </div>
          </form>
        </Modal>
      )}
      {editing && (
        <Modal
          eyebrow="EDITOR DE PLAYLIST"
          title={editing.name}
          onClose={() => setEditing(null)}
        >
          <div className="playlist-editor">
            <label className="media-add">
              Adicionar conteúdo
              <select
                defaultValue=""
                onChange={(e) => {
                  addMedia(e.target.value);
                  e.target.value = "";
                }}
              >
                <option value="" disabled>
                  Escolha na biblioteca…
                </option>
                {media.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            {editorItems.length ? (
              <div className="editor-items">
                {editorItems.map((item, index) => (
                  <article
                    key={`${item.mediaId}-${index}`}
                    draggable
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => drop(e, index)}
                  >
                    <GripVertical />
                    <span className="playlist-icon">
                      <Play />
                    </span>
                    <span className="grow">
                      <b>{item.name}</b>
                      <small>{item.type.replace(/_/g, " ")}</small>
                    </span>
                    <label>
                      Duração
                      <input
                        type="number"
                        min="1"
                        value={item.durationSeconds ?? ""}
                        placeholder="Auto"
                        onChange={(e) =>
                          setEditorItems((rows) =>
                            rows.map((row, i) =>
                              i === index
                                ? {
                                    ...row,
                                    durationSeconds: e.target.value
                                      ? Number(e.target.value)
                                      : null,
                                  }
                                : row,
                            ),
                          )
                        }
                      />
                      <small>seg</small>
                    </label>
                    <button
                      className="icon-button"
                      onClick={() =>
                        setEditorItems((rows) =>
                          rows.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <X />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="compact-empty">
                <Plus />
                <span>
                  <b>Playlist vazia</b>
                  <small>Escolha conteúdos acima.</small>
                </span>
              </div>
            )}
            <div className="editor-summary">
              <span>{editorItems.length} itens</span>
              <span>
                Duração estimada:{" "}
                {formatDuration(
                  editorItems.reduce(
                    (sum, item) => sum + (item.durationSeconds || 0),
                    0,
                  ),
                )}
              </span>
            </div>
            <div className="modal-actions">
              <button
                className="btn secondary"
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
              <AsyncButton
                busy={busy}
                className="btn primary"
                onClick={() => void save()}
              >
                <Save />
                Salvar playlist
              </AsyncButton>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
