import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  AppWindow,
  Cloud,
  FileImage,
  FileVideo,
  Globe2,
  Link2,
  MessageSquareText,
  MoreHorizontal,
  Search,
  Sparkles,
  Trash2,
  Wifi,
  Youtube,
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
import { invokeFunction, supabase } from "../lib/supabase";
import { extractYouTubeId, formatDuration } from "../lib/youtube";
import type { Media, MediaType } from "../types";

type Source = "youtube" | "drive" | "webpage" | "app" | "message";
const typeLabel: Record<MediaType, string> = {
  drive_image: "Imagem do Drive",
  drive_video: "Vídeo do Drive",
  youtube: "YouTube",
  webpage: "Página web",
  app: "App PontoView",
  message: "Comunicado",
};

export function ContentPage() {
  const { organization, user } = useAuth();
  const [items, setItems] = useState<Media[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [source, setSource] = useState<Source>("youtube");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<Array<Record<string, unknown>>>(
    [],
  );
  const load = useCallback(async () => {
    if (!organization) return;
    const result = await supabase
      .from("media")
      .select("*")
      .eq("organization_id", organization.id)
      .neq("status", "archived")
      .order("updated_at", { ascending: false });
    if (result.error) setError(result.error.message);
    else setItems((result.data || []) as Media[]);
  }, [organization]);
  useEffect(() => {
    void load();
  }, [load]);
  const shown = useMemo(
    () =>
      items.filter(
        (item) =>
          (filter === "all" || item.type === filter) &&
          item.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [items, filter, search],
  );
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!organization || !user) return;
    setBusy(true);
    setError(null);
    const data = formData(e);
    let payload: Record<string, unknown> = {
      organization_id: organization.id,
      name: data.name,
      created_by: user.id,
      status: "ready",
    };
    try {
      if (source === "youtube") {
        const id = extractYouTubeId(data.url);
        if (!id) throw new Error("Cole um link válido do YouTube.");
        let meta: {
          title?: string;
          thumbnail?: string;
          durationSeconds?: number;
        } = {};
        try {
          meta = await invokeFunction("content-resolver", { url: data.url });
        } catch {
          meta = {};
        }
        payload = {
          ...payload,
          type: "youtube",
          name: data.name || meta.title || "Vídeo do YouTube",
          youtube_video_id: id,
          thumbnail_url:
            meta.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          duration_seconds: meta.durationSeconds || null,
          online_required: true,
          youtube_options: {
            autoplay: true,
            mute: data.mute === "on",
            volume: Number(data.volume || 100),
            controls: data.controls === "on",
            start: Number(data.start || 0),
            end: data.end ? Number(data.end) : null,
          },
        };
      }
      if (source === "webpage")
        payload = {
          ...payload,
          type: "webpage",
          page_url: new URL(data.url).toString(),
          duration_seconds: Number(data.duration || 30),
          online_required: true,
        };
      if (source === "app")
        payload = {
          ...payload,
          type: "app",
          app_key: data.app_key,
          duration_seconds: Number(data.duration || 30),
          online_required: ["news", "busboard"].includes(data.app_key),
          name: data.name || appName(data.app_key),
        };
      if (source === "message")
        payload = {
          ...payload,
          type: "message",
          message_content: { title: data.title, body: data.body },
          duration_seconds: Number(data.duration || 15),
          online_required: false,
          name: data.name || data.title || "Comunicado",
        };
      const result = await supabase
        .from("media")
        .insert(payload)
        .select()
        .single();
      if (result.error) throw result.error;
      setModal(false);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível adicionar o conteúdo.",
      );
    } finally {
      setBusy(false);
    }
  };
  const archive = async (item: Media) => {
    if (!confirm(`Remover “${item.name}” da biblioteca?`)) return;
    const result = await supabase
      .from("media")
      .update({ status: "archived" })
      .eq("id", item.id);
    if (result.error) setError(result.error.message);
    else await load();
  };
  const connectDrive = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await invokeFunction<{ url: string }>(
        "drive-oauth-start",
        { returnTo: `${window.location.origin}/conteudo` },
      );
      window.location.assign(result.url);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível conectar o Google Drive.",
      );
      setBusy(false);
    }
  };
  const listDrive = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await invokeFunction<{
        files: Array<Record<string, unknown>>;
      }>("drive-files", { mode: "list" });
      setDriveFiles(result.files || []);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Conecte o Google Drive antes de selecionar arquivos.",
      );
    } finally {
      setBusy(false);
    }
  };
  const addDriveFile = async (file: Record<string, unknown>) => {
    if (!organization || !user) return;
    setBusy(true);
    const mime = String(file.mimeType || "");
    const result = await supabase
      .from("media")
      .insert({
        organization_id: organization.id,
        type: mime.startsWith("video/") ? "drive_video" : "drive_image",
        name: String(file.name || "Arquivo do Drive"),
        drive_connection_id: file.connectionId,
        drive_file_id: file.id,
        drive_mime_type: mime,
        drive_modified_time: file.modifiedTime || null,
        drive_checksum: file.md5Checksum || null,
        thumbnail_url: file.thumbnailLink || null,
        duration_seconds: mime.startsWith("image/") ? 15 : null,
        online_required: false,
        created_by: user.id,
      })
      .select()
      .single();
    setBusy(false);
    if (result.error) setError(result.error.message);
    else {
      setModal(false);
      setDriveFiles([]);
      await load();
    }
  };
  return (
    <>
      <PageHead
        eyebrow="Biblioteca"
        title="Conteúdo"
        text="Google Drive, YouTube, páginas web e conteúdos dinâmicos em uma única biblioteca."
        action="Adicionar conteúdo"
        onAction={() => {
          setError(null);
          setModal(true);
        }}
      />
      <div className="toolbar content-toolbar">
        <div className="tabs">
          {[
            ["all", "Todos"],
            ["drive_video", "Vídeos"],
            ["drive_image", "Imagens"],
            ["youtube", "YouTube"],
            ["app", "Apps"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={filter === id ? "selected" : ""}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="inline-search">
          <Search />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conteúdo"
          />
        </label>
      </div>
      <FormMessage error={!modal ? error : null} />
      {shown.length ? (
        <div className="media-grid">
          {shown.map((item) => (
            <article className="media-card" key={item.id}>
              <div
                className={`media-thumb ${item.type === "youtube" ? "youtube-thumb" : "thumb-" + (item.id.charCodeAt(0) % 4)}`}
              >
                {thumbIcon(item)}
                {item.thumbnail_url && <img src={item.thumbnail_url} alt="" />}
                <span>{formatDuration(item.duration_seconds)}</span>
              </div>
              <div className="media-info">
                <b>{item.name}</b>
                <span>{typeLabel[item.type]}</span>
                <small
                  className={
                    item.online_required ? "requires-net" : "offline-ready"
                  }
                >
                  {item.online_required ? (
                    <>
                      <Wifi size={11} /> Requer internet
                    </>
                  ) : (
                    <>Disponível no cache</>
                  )}
                </small>
              </div>
              <button
                className="icon-button danger-hover"
                title="Remover"
                onClick={() => void archive(item)}
              >
                <Trash2 size={17} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<AppWindow />}
          title="Sua biblioteca está vazia"
          text="Adicione um vídeo do YouTube, arquivo do Drive, página ou App PontoView."
          action="Adicionar primeiro conteúdo"
          onAction={() => setModal(true)}
        />
      )}
      {modal && (
        <Modal
          eyebrow="ADICIONAR CONTEÚDO"
          title="Escolha a origem"
          onClose={() => setModal(false)}
        >
          <div className="source-grid">
            {(
              [
                ["youtube", "YouTube", Youtube],
                ["drive", "Google Drive", Cloud],
                ["webpage", "Página web", Link2],
                ["app", "App PontoView", Sparkles],
                ["message", "Comunicado", MessageSquareText],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                className={
                  source === id ? "source-card selected-source" : "source-card"
                }
                key={id}
                onClick={() => {
                  setSource(id);
                  setDriveFiles([]);
                  setError(null);
                }}
              >
                <Icon size={21} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <FormMessage error={error} />
          {source === "drive" ? (
            <div className="drive-picker">
              <Cloud size={30} />
              <h3>Arquivos continuam no seu Drive</h3>
              <p>
                A PontoView armazena apenas a referência e mantém uma cópia
                temporária no Player para operação offline.
              </p>
              <div className="modal-actions">
                <AsyncButton
                  busy={busy}
                  className="btn secondary"
                  onClick={connectDrive}
                >
                  Conectar outra conta
                </AsyncButton>
                <AsyncButton
                  busy={busy}
                  className="btn primary"
                  onClick={listDrive}
                >
                  Selecionar arquivos
                </AsyncButton>
              </div>
              {driveFiles.length > 0 && (
                <div className="drive-file-list">
                  {driveFiles.map((file) => (
                    <button
                      key={String(file.id)}
                      onClick={() => void addDriveFile(file)}
                    >
                      <span>
                        {String(file.mimeType).startsWith("video/") ? (
                          <FileVideo />
                        ) : (
                          <FileImage />
                        )}
                      </span>
                      <b>{String(file.name)}</b>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <ContentForm
              source={source}
              busy={busy}
              onSubmit={save}
              onCancel={() => setModal(false)}
            />
          )}
        </Modal>
      )}
    </>
  );
}

function ContentForm({
  source,
  busy,
  onSubmit,
  onCancel,
}: {
  source: Exclude<Source, "drive">;
  busy: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form className="youtube-form" onSubmit={onSubmit}>
      {source === "youtube" && (
        <>
          <label>
            Link do YouTube
            <input
              name="url"
              required
              placeholder="youtube.com/watch, youtu.be, Shorts ou live"
            />
          </label>
          <label>
            Nome na biblioteca <span>(opcional)</span>
            <input name="name" />
          </label>
          <div className="form-row">
            <label>
              Volume
              <input
                name="volume"
                type="number"
                min="0"
                max="100"
                defaultValue="100"
              />
            </label>
            <label>
              Início (seg)
              <input name="start" type="number" min="0" defaultValue="0" />
            </label>
            <label>
              Fim (seg)
              <input name="end" type="number" min="1" />
            </label>
          </div>
          <div className="yt-options">
            <label>
              <input name="controls" type="checkbox" /> Mostrar controles
            </label>
            <label>
              <input name="mute" type="checkbox" /> Iniciar silenciado
            </label>
          </div>
        </>
      )}
      {source === "webpage" && (
        <>
          <label>
            Nome
            <input name="name" required />
          </label>
          <label>
            Endereço da página
            <input name="url" type="url" required placeholder="https://" />
          </label>
          <label>
            Duração (segundos)
            <input
              name="duration"
              type="number"
              min="5"
              defaultValue="30"
              required
            />
          </label>
        </>
      )}
      {source === "app" && (
        <>
          <label>
            App
            <select name="app_key" defaultValue="clock">
              <option value="clock">Relógio</option>
              <option value="weather">Clima</option>
              <option value="news">Notícias</option>
              <option value="menu_board">Menu Board</option>
              <option value="messages">Mensagens</option>
              <option value="busboard">BusBoard</option>
            </select>
          </label>
          <label>
            Nome <span>(opcional)</span>
            <input name="name" />
          </label>
          <label>
            Duração (segundos)
            <input
              name="duration"
              type="number"
              min="5"
              defaultValue="30"
              required
            />
          </label>
        </>
      )}
      {source === "message" && (
        <>
          <label>
            Nome na biblioteca <span>(opcional)</span>
            <input name="name" />
          </label>
          <label>
            Título
            <input name="title" required />
          </label>
          <label>
            Mensagem
            <textarea name="body" required rows={4} />
          </label>
          <label>
            Duração (segundos)
            <input name="duration" type="number" min="5" defaultValue="15" />
          </label>
        </>
      )}
      <div className="modal-actions">
        <button type="button" className="btn secondary" onClick={onCancel}>
          Cancelar
        </button>
        <AsyncButton busy={busy} className="btn primary">
          Adicionar à biblioteca
        </AsyncButton>
      </div>
    </form>
  );
}
function thumbIcon(item: Media) {
  if (item.type === "youtube") return <Youtube size={34} />;
  if (item.type === "drive_video") return <FileVideo size={28} />;
  if (item.type === "drive_image") return <FileImage size={28} />;
  if (item.type === "webpage") return <Globe2 size={28} />;
  if (item.type === "message") return <MessageSquareText size={28} />;
  return <Sparkles size={28} />;
}
function appName(key: string) {
  return (
    (
      {
        clock: "Relógio",
        weather: "Previsão do tempo",
        news: "Notícias",
        menu_board: "Menu Board",
        messages: "Mensagens",
        busboard: "BusBoard",
      } as Record<string, string>
    )[key] || "App PontoView"
  );
}
