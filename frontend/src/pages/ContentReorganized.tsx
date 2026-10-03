import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  AppWindow,
  Ban,
  Check,
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
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { DriveThumbnail } from "../components/DriveThumbnail";
import {
  AsyncButton,
  EmptyState,
  FormMessage,
  Modal,
  PageHead,
  formData,
} from "../components/ui";
import {
  openGoogleDrivePicker,
  preloadGoogleDrivePicker,
} from "../lib/googlePicker";
import { invokeFunction, supabase } from "../lib/supabase";
import { extractYouTubeId, formatDuration } from "../lib/youtube";
import { PANEL_CATALOG, panelUrl, type PanelCatalogItem } from "../panelCatalog";
import {
  SEASONAL_CAMPAIGNS,
  isSeasonalCampaignActive,
  seasonalCampaignByKey,
  type SeasonalCampaign,
} from "../seasonalCampaigns";
import type { Media, MediaType } from "../types";
import "../webpage-security.css";

type Source = "youtube" | "drive" | "webpage" | "app" | "message";
type Filter = "all" | MediaType | "panel";

type ExistingMessage = {
  id: string;
  title: string | null;
  body: string;
  is_active: boolean;
  priority: string | null;
  duration_mode: string | null;
  duration_seconds: number | null;
  style_variant: string | null;
  content_type: string | null;
};

type LegacyApp = {
  key: string;
  title: string;
  description: string;
  duration: number;
  emoji: string;
  online: boolean;
};

const LEGACY_APPS: LegacyApp[] = [
  { key: "clock", title: "Relógio", description: "Hora e data em tela cheia.", duration: 30, emoji: "🕒", online: false },
  { key: "menu_board", title: "Menu Board", description: "Painel de cardápio para exibição em tela cheia.", duration: 30, emoji: "🍽️", online: false },
  { key: "busboard", title: "BusBoard", description: "Integração visual com informações de mobilidade.", duration: 30, emoji: "🚌", online: true },
];

const typeLabel: Record<MediaType, string> = {
  drive_image: "Imagem do Drive",
  drive_video: "Vídeo do Drive",
  youtube: "YouTube",
  webpage: "Página web",
  app: "App PontoView",
  message: "Comunicado",
};

function isPanelMedia(item: Media) {
  return item.type === "app"
    || Boolean(item.metadata?.pontoview_panel)
    || String(item.page_url || "").includes("/paineis/");
}

function mediaLabel(item: Media) {
  if (item.type === "app" && item.metadata?.seasonal) {
    const group = item.metadata?.seasonal_group || seasonalCampaignByKey(item.app_key)?.group;
    if (group === "holiday") return "Feriado";
    if (group === "commemorative") return "Data comemorativa";
    return "Campanha sazonal";
  }
  if (isPanelMedia(item)) return "Painel PontoView";
  return typeLabel[item.type];
}

export function ContentReorganizedPage() {
  const { organization, user } = useAuth();
  const [items, setItems] = useState<Media[]>([]);
  const [messages, setMessages] = useState<ExistingMessage[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Media | null>(null);
  const [source, setSource] = useState<Source>("youtube");
  const [busy, setBusy] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [webpageSecurityWarning, setWebpageSecurityWarning] = useState(false);

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

  const loadMessages = useCallback(async () => {
    if (!organization) return;
    const result = await supabase
      .from("messages")
      .select("id,title,body,is_active,priority,duration_mode,duration_seconds,style_variant,content_type")
      .eq("organization_id", organization.id)
      .eq("content_type", "message")
      .order("created_at", { ascending: false });
    if (result.error) setError(result.error.message);
    else setMessages((result.data || []) as ExistingMessage[]);
  }, [organization]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!modal || source !== "drive") return;
    void preloadGoogleDrivePicker().catch(() => undefined);
  }, [modal, source]);
  useEffect(() => {
    if (!modal || source !== "message") return;
    void loadMessages();
  }, [modal, source, loadMessages]);

  const shown = useMemo(() => {
    const query = search.toLowerCase().trim();
    return items.filter((item) => {
      const matchesFilter = filter === "all"
        || (filter === "panel" ? isPanelMedia(item) : item.type === filter);
      return matchesFilter && item.name.toLowerCase().includes(query);
    });
  }, [items, filter, search]);

  const activeSeasonals = useMemo(
    () => SEASONAL_CAMPAIGNS.filter((campaign) => isSeasonalCampaignActive(campaign, new Date())),
    [modal],
  );

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organization || !user) return;
    setBusy(true);
    setError(null);
    const data = formData(event);
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
        let meta: { title?: string; thumbnail?: string; durationSeconds?: number } = {};
        try { meta = await invokeFunction("content-resolver", { url: data.url }); } catch { meta = {}; }
        payload = {
          ...payload,
          type: "youtube",
          name: data.name || meta.title || "Vídeo do YouTube",
          youtube_video_id: id,
          thumbnail_url: meta.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
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
      } else if (source === "webpage") {
        const pageUrlValue = new URL(data.url);
        if (pageUrlValue.protocol !== "https:") {
          setWebpageSecurityWarning(true);
          return;
        }
        payload = {
          ...payload,
          type: "webpage",
          page_url: pageUrlValue.toString(),
          duration_seconds: Number(data.duration || 30),
          online_required: true,
        };
      } else {
        return;
      }
      const result = await supabase.from("media").insert(payload).select().single();
      if (result.error) throw result.error;
      setModal(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível adicionar o conteúdo.");
    } finally {
      setBusy(false);
    }
  };

  const addPanel = async (panel: PanelCatalogItem) => {
    if (!organization || !user) return;
    const key = `panel:${panel.key}`;
    setBusyKey(key);
    setError(null);
    try {
      const url = panelUrl(panel.slug);
      const existing = items.find((item) => item.type === "webpage" && item.page_url === url);
      if (existing) throw new Error(`${panel.title} já está na sua biblioteca.`);
      const archived = await supabase.from("media").select("id").eq("organization_id", organization.id).eq("type", "webpage").eq("page_url", url).eq("status", "archived").order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (archived.error) throw archived.error;
      const payload = {
        organization_id: organization.id,
        type: "webpage" as const,
        name: panel.title,
        page_url: url,
        duration_seconds: panel.duration,
        online_required: false,
        created_by: user.id,
        status: "ready",
        metadata: { pontoview_panel: true, panel_key: panel.key, panel_category: panel.category },
      };
      const result = archived.data?.id
        ? await supabase.from("media").update(payload).eq("id", archived.data.id)
        : await supabase.from("media").insert(payload);
      if (result.error) throw result.error;
      setModal(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível adicionar este painel.");
    } finally {
      setBusyKey(null);
    }
  };

  const addLegacyApp = async (app: LegacyApp) => {
    if (!organization || !user) return;
    const key = `legacy:${app.key}`;
    setBusyKey(key);
    setError(null);
    try {
      if (items.some((item) => item.type === "app" && item.app_key === app.key)) throw new Error(`${app.title} já está na sua biblioteca.`);
      const result = await supabase.from("media").insert({
        organization_id: organization.id,
        type: "app",
        app_key: app.key,
        name: app.title,
        duration_seconds: app.duration,
        online_required: app.online,
        created_by: user.id,
        status: "ready",
        metadata: { pontoview_app: true },
      });
      if (result.error) throw result.error;
      setModal(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível adicionar este App PontoView.");
    } finally {
      setBusyKey(null);
    }
  };

  const addSeasonal = async (campaign: SeasonalCampaign) => {
    if (!organization || !user) return;
    const key = `seasonal:${campaign.key}`;
    setBusyKey(key);
    setError(null);
    try {
      if (items.some((item) => item.type === "app" && item.app_key === campaign.key)) throw new Error(`${campaign.name} já está na sua biblioteca.`);
      const archived = await supabase.from("media").select("id").eq("organization_id", organization.id).eq("type", "app").eq("app_key", campaign.key).eq("status", "archived").order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (archived.error) throw archived.error;
      const payload = {
        organization_id: organization.id,
        type: "app" as const,
        app_key: campaign.key,
        name: campaign.name,
        duration_seconds: campaign.durationSeconds,
        online_required: false,
        created_by: user.id,
        status: "ready",
        metadata: {
          seasonal: true,
          seasonal_group: campaign.group,
          seasonal_category: campaign.category,
          seasonal_window: { start: campaign.start || null, end: campaign.end || null, rule: campaign.rule || null, period_label: campaign.periodLabel },
        },
      };
      const result = archived.data?.id
        ? await supabase.from("media").update(payload).eq("id", archived.data.id)
        : await supabase.from("media").insert(payload);
      if (result.error) throw result.error;
      setModal(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível adicionar este conteúdo sazonal.");
    } finally {
      setBusyKey(null);
    }
  };

  const addMessage = async (message: ExistingMessage) => {
    if (!organization || !user) return;
    const key = `message:${message.id}`;
    setBusyKey(key);
    setError(null);
    try {
      const duplicate = items.some((item) => item.type === "message" && String(item.metadata?.source_message_id || "") === message.id);
      if (duplicate) throw new Error("Este comunicado já está na sua biblioteca.");
      const duration = message.duration_mode === "manual" && Number(message.duration_seconds) >= 5
        ? Number(message.duration_seconds)
        : 15;
      const result = await supabase.from("media").insert({
        organization_id: organization.id,
        type: "message",
        name: message.title || "Comunicado",
        message_content: {
          title: message.title,
          body: message.body,
          priority: message.priority || "normal",
          style_variant: message.style_variant || "standard",
          source_message_id: message.id,
        },
        duration_seconds: duration,
        online_required: false,
        created_by: user.id,
        status: "ready",
        metadata: { source_message_id: message.id, from_information_center: true },
      });
      if (result.error) throw result.error;
      setModal(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível adicionar este comunicado.");
    } finally {
      setBusyKey(null);
    }
  };

  const archive = async (item: Media) => {
    if (!confirm(`Remover “${item.name}” da biblioteca?`)) return;
    const result = await supabase.from("media").update({ status: "archived" }).eq("id", item.id);
    if (result.error) setError(result.error.message);
    else await load();
  };

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    const data = formData(event);
    const payload: Record<string, unknown> = { name: data.name, duration_seconds: data.duration ? Number(data.duration) : null };
    if (editing.type === "youtube") {
      payload.youtube_options = {
        ...editing.youtube_options,
        mute: data.mute === "on",
        controls: data.controls === "on",
        volume: Number(data.volume || 100),
        start: Number(data.start || 0),
        end: data.end ? Number(data.end) : null,
      };
    }
    const result = await supabase.from("media").update(payload).eq("id", editing.id);
    setBusy(false);
    if (result.error) setError(result.error.message);
    else { setEditing(null); await load(); }
  };

  const isMobileDriveFlow = () => {
    const userAgent = navigator.userAgent || "";
    const iOS = /iPad|iPhone|iPod/i.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const safari = /Safari/i.test(userAgent) && !/Chrome|CriOS|Chromium|Edg|OPR|Android/i.test(userAgent);
    return iOS || safari;
  };

  const startDriveOAuth = async (pickerMode = false) => {
    if (!organization) return;
    setBusy(true);
    setError(null);
    try {
      const returnUrl = new URL("/conteudo", window.location.origin);
      returnUrl.searchParams.set("drivePicker", "1");
      const result = await invokeFunction<{ url: string }>("drive-oauth-start", {
        organizationId: organization.id,
        returnTo: returnUrl.toString(),
        pickerMode,
      });
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível conectar o Google Drive.");
      setBusy(false);
    }
  };

  const connectDrive = async () => { await startDriveOAuth(); };

  useEffect(() => {
    if (!organization || !user) return;
    const currentUrl = new URL(window.location.href);
    const driveStatus = currentUrl.searchParams.get("drive");
    const reopenDrive = currentUrl.searchParams.get("drivePicker") === "1";
    const pickedFileIds = String(currentUrl.searchParams.get("driveFileIds") || "").split(",").map((id) => id.trim()).filter(Boolean);
    const pickedConnectionId = String(currentUrl.searchParams.get("driveConnectionId") || "").trim();
    if (!driveStatus && !reopenDrive) return;
    if (reopenDrive) { setSource("drive"); setModal(true); }
    if (driveStatus === "denied" || driveStatus === "cancelled") setError("A conexão com o Google Drive foi cancelada.");
    else if (driveStatus === "picked" && pickedFileIds.length) void importDriveFilesByIds(pickedFileIds, pickedConnectionId);
    else if (driveStatus && driveStatus !== "connected" && driveStatus !== "picked") setError("Não foi possível concluir a conexão com o Google Drive. Tente novamente.");
    currentUrl.searchParams.delete("drive");
    currentUrl.searchParams.delete("drivePicker");
    currentUrl.searchParams.delete("driveFileIds");
    currentUrl.searchParams.delete("driveConnectionId");
    const nextUrl = currentUrl.pathname + (currentUrl.searchParams.toString() ? `?${currentUrl.searchParams.toString()}` : "") + currentUrl.hash;
    window.history.replaceState({}, "", nextUrl);
  }, [organization, user]);

  const importDriveFilesByIds = async (fileIds: string[], connectionId?: string) => {
    if (!organization || !user || !fileIds.length) return;
    setBusy(true);
    setError(null);
    try {
      const resolved = await invokeFunction<{ files: Array<{ id: string; name: string; mimeType: string; connectionId: string }> }>("drive-files", { fileIds, ...(connectionId ? { connectionId } : {}) });
      const uniqueFiles = Array.from(new Map((resolved.files || []).map((file) => [file.id, file])).values());
      if (!uniqueFiles.length) throw new Error("Nenhum arquivo compatível foi selecionado.");
      const existingResult = await supabase.from("media").select("drive_file_id").eq("organization_id", organization.id).neq("status", "archived").in("drive_file_id", uniqueFiles.map((file) => file.id));
      if (existingResult.error) throw existingResult.error;
      const existingIds = new Set((existingResult.data || []).map((row) => String(row.drive_file_id || "")).filter(Boolean));
      const filesToAdd = uniqueFiles.filter((file) => !existingIds.has(file.id));
      if (!filesToAdd.length) { setError("Os arquivos selecionados já estão na biblioteca."); return; }
      const result = await supabase.from("media").insert(filesToAdd.map((file) => ({
        organization_id: organization.id,
        type: file.mimeType.startsWith("video/") ? "drive_video" : "drive_image",
        name: file.name || "Arquivo do Drive",
        drive_connection_id: file.connectionId,
        drive_file_id: file.id,
        drive_mime_type: file.mimeType,
        drive_modified_time: null,
        drive_checksum: null,
        thumbnail_url: null,
        duration_seconds: file.mimeType.startsWith("image/") ? 15 : null,
        online_required: false,
        created_by: user.id,
        status: "ready",
      })));
      if (result.error) throw result.error;
      setModal(false);
      await load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível adicionar os arquivos do Google Drive.";
      if (message.includes("DRIVE_NOT_CONNECTED") || message.includes("DRIVE_RECONNECT_REQUIRED")) { await startDriveOAuth(true); return; }
      if (message.includes("DRIVE_LIST_FAILED") || message.includes("DRIVE_SELECTED_FILES_UNAVAILABLE") || message.includes("DRIVE_FILE_IDS_REQUIRED")) setError("Não foi possível acessar um dos arquivos selecionados. Abra o Google Drive novamente e selecione o arquivo desejado.");
      else setError(message);
    } finally { setBusy(false); }
  };

  const selectDriveFiles = async () => {
    if (!organization || !user) return;
    setBusy(true);
    setError(null);
    try {
      if (isMobileDriveFlow()) { await startDriveOAuth(true); return; }
      const apiKey = String(import.meta.env.VITE_GOOGLE_PICKER_API_KEY || "");
      const appId = String(import.meta.env.VITE_GOOGLE_PICKER_APP_ID || "");
      if (!apiKey || !appId) throw new Error("O Google Picker ainda não está configurado neste ambiente.");
      const token = await invokeFunction<{ accessToken: string; connectionId: string }>("drive-picker-token", {});
      const selected = await openGoogleDrivePicker({ accessToken: token.accessToken, apiKey, appId });
      if (!selected.length) return;
      const uniqueFiles = Array.from(new Map(selected.map((file) => [file.id, file])).values());
      const validated = await invokeFunction<{ files: Array<{ id: string; name: string; mimeType: string; modifiedTime?: string | null; md5Checksum?: string | null; connectionId?: string }> }>("drive-files", {
        fileIds: uniqueFiles.map((file) => file.id),
        connectionId: token.connectionId,
      });
      const validatedFiles = (validated.files || []).filter((file) => file.id && (file.mimeType?.startsWith("image/") || file.mimeType?.startsWith("video/")));
      if (!validatedFiles.length) throw new Error("Os arquivos selecionados não estão disponíveis para a PontoView. Tente selecioná-los novamente no Google Drive.");
      const existingResult = await supabase.from("media").select("drive_file_id").eq("organization_id", organization.id).neq("status", "archived").in("drive_file_id", validatedFiles.map((file) => file.id));
      if (existingResult.error) throw existingResult.error;
      const existingIds = new Set((existingResult.data || []).map((row) => String(row.drive_file_id || "")).filter(Boolean));
      const filesToAdd = validatedFiles.filter((file) => !existingIds.has(file.id));
      if (!filesToAdd.length) { setError("Os arquivos selecionados já estão na biblioteca."); return; }
      const result = await supabase.from("media").insert(filesToAdd.map((file) => ({
        organization_id: organization.id,
        type: file.mimeType.startsWith("video/") ? "drive_video" : "drive_image",
        name: file.name || "Arquivo do Drive",
        drive_connection_id: file.connectionId || token.connectionId,
        drive_file_id: file.id,
        drive_mime_type: file.mimeType,
        drive_modified_time: file.modifiedTime || null,
        drive_checksum: file.md5Checksum || null,
        thumbnail_url: null,
        duration_seconds: file.mimeType.startsWith("image/") ? 15 : null,
        online_required: false,
        created_by: user.id,
        status: "ready",
      })));
      if (result.error) throw result.error;
      setModal(false);
      await load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível abrir o Google Drive.";
      if (message.includes("DRIVE_NOT_CONNECTED") || message.includes("DRIVE_RECONNECT_REQUIRED")) { await startDriveOAuth(); return; }
      if (message.includes("GOOGLE_PICKER")) setError("Não foi possível abrir o seletor do Google Drive. Reconecte a conta e tente novamente.");
      else if (message.includes("DRIVE_LIST_FAILED") || message.includes("DRIVE_SELECTED_FILES_UNAVAILABLE") || message.includes("DRIVE_FILE_IDS_REQUIRED")) setError("Não foi possível acessar um dos arquivos selecionados. Abra o Google Drive novamente e selecione o arquivo desejado.");
      else setError(message);
    } finally { setBusy(false); }
  };

  return (
    <>
      <PageHead eyebrow="Biblioteca" title="Conteúdo" text="Google Drive, YouTube, páginas web, Painéis PontoView e comunicados em uma única biblioteca." action="Adicionar conteúdo" onAction={() => { setError(null); setModal(true); }} />

      <div className="toolbar content-toolbar">
        <div className="tabs">
          {([
            ["all", "Todos"], ["drive_video", "Vídeos"], ["drive_image", "Imagens"], ["youtube", "YouTube"], ["panel", "Painéis"], ["message", "Comunicados"],
          ] as Array<[Filter, string]>).map(([id, label]) => <button key={id} className={filter === id ? "selected" : ""} onClick={() => setFilter(id)}>{label}</button>)}
        </div>
        <label className="inline-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar conteúdo" /></label>
      </div>

      <FormMessage error={!modal ? error : null} />
      {shown.length ? (
        <div className="media-grid">
          {shown.map((item) => (
            <article className="media-card" key={item.id}>
              <div className={`media-thumb ${item.type === "youtube" ? "youtube-thumb" : `thumb-${item.id.charCodeAt(0) % 4}`}`}>
                {thumbIcon(item)}
                {item.type === "drive_image" || item.type === "drive_video" ? <DriveThumbnail mediaId={item.id} /> : item.thumbnail_url ? <img src={item.thumbnail_url} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}
                <span>{formatDuration(item.duration_seconds)}</span>
              </div>
              <div className="media-info">
                <b>{item.name}</b><span>{mediaLabel(item)}</span>
                <small className={item.online_required ? "requires-net" : "offline-ready"}>{item.online_required ? <><Wifi size={11} /> Requer internet</> : <>Disponível no cache</>}</small>
              </div>
              <div className="media-actions">
                <button className="icon-button" title="Editar" onClick={() => setEditing(item)}><MoreHorizontal size={17} /></button>
                <button className="icon-button danger-hover" title="Remover" onClick={() => void archive(item)}><Trash2 size={17} /></button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={<AppWindow />} title="Sua biblioteca está vazia" text="Adicione um vídeo do YouTube, arquivo do Drive, página, painel ou comunicado." action="Adicionar primeiro conteúdo" onAction={() => setModal(true)} />
      )}

      {modal && (
        <Modal eyebrow="ADICIONAR CONTEÚDO" title="Escolha a origem" onClose={() => setModal(false)}>
          <div className="source-grid source-grid-clean">
            {([
              ["youtube", "YouTube", Youtube],
              ["drive", "Google Drive", Cloud],
              ["webpage", "Página web", Link2],
              ["app", "App PontoView", Sparkles],
              ["message", "Comunicado", MessageSquareText],
            ] as const).map(([id, label, Icon]) => (
              <button className={source === id ? "source-card selected-source" : "source-card"} key={id} onClick={() => { setSource(id); setError(null); }}><Icon size={21} /><span>{label}</span></button>
            ))}
          </div>
          <FormMessage error={error} />

          {source === "drive" ? (
            <div className="drive-picker"><Cloud size={30} /><h3>Arquivos continuam no seu Drive</h3><p>Navegue pelas pastas do Google Drive e escolha imagens ou vídeos. A PontoView mantém apenas a referência e o cache necessário para o Player.</p><div className="modal-actions"><AsyncButton busy={busy} className="btn secondary" onClick={connectDrive}>Conectar outra conta</AsyncButton><AsyncButton busy={busy} className="btn primary" onClick={selectDriveFiles}>Selecionar arquivos</AsyncButton></div></div>
          ) : source === "app" ? (
            <PanelPicker items={items} activeSeasonals={activeSeasonals} busyKey={busyKey} onAddPanel={addPanel} onAddSeasonal={addSeasonal} onAddLegacy={addLegacyApp} />
          ) : source === "message" ? (
            <MessagePicker messages={messages} items={items} busyKey={busyKey} onAdd={addMessage} />
          ) : (
            <BasicContentForm source={source} busy={busy} onSubmit={save} onCancel={() => setModal(false)} />
          )}
        </Modal>
      )}

      {editing && (
        <Modal eyebrow="EDITAR CONTEÚDO" title={editing.name} onClose={() => setEditing(null)}>
          <form className="youtube-form" onSubmit={saveEdit}>
            <label>Nome<input name="name" required defaultValue={editing.name} /></label>
            {editing.type !== "drive_video" && <label>Duração (segundos)<input name="duration" type="number" min="1" defaultValue={editing.duration_seconds || ""} required={editing.type !== "youtube"} /></label>}
            {editing.type === "youtube" && <><div className="form-row"><label>Volume<input name="volume" type="number" min="0" max="100" defaultValue={Number(editing.youtube_options?.volume ?? 100)} /></label><label>Início (seg)<input name="start" type="number" min="0" defaultValue={Number(editing.youtube_options?.start || 0)} /></label><label>Fim (seg)<input name="end" type="number" min="1" defaultValue={String(editing.youtube_options?.end || "")} /></label></div><div className="yt-options"><label><input name="controls" type="checkbox" defaultChecked={Boolean(editing.youtube_options?.controls)} /> Mostrar controles</label><label><input name="mute" type="checkbox" defaultChecked={Boolean(editing.youtube_options?.mute)} /> Iniciar silenciado</label></div></>}
            <FormMessage error={error} />
            <div className="modal-actions"><button type="button" className="btn secondary" onClick={() => setEditing(null)}>Cancelar</button><AsyncButton busy={busy} className="btn primary">Salvar alterações</AsyncButton></div>
          </form>
        </Modal>
      )}

      {webpageSecurityWarning && (
        <Modal eyebrow="PÁGINA NÃO COMPATÍVEL" title="Não foi possível adicionar esta página" onClose={() => setWebpageSecurityWarning(false)}>
          <div className="webpage-security-warning"><span className="security-icon" aria-hidden="true"><Ban /></span><p><strong>Esta página não é compatível com os requisitos de segurança do PontoView.</strong> Utilize uma página com conexão HTTPS.</p><div className="modal-actions"><button type="button" className="btn primary" onClick={() => setWebpageSecurityWarning(false)}>Voltar e corrigir</button></div></div>
        </Modal>
      )}
    </>
  );
}

function PanelPicker({ items, activeSeasonals, busyKey, onAddPanel, onAddSeasonal, onAddLegacy }: {
  items: Media[];
  activeSeasonals: SeasonalCampaign[];
  busyKey: string | null;
  onAddPanel: (panel: PanelCatalogItem) => Promise<void>;
  onAddSeasonal: (campaign: SeasonalCampaign) => Promise<void>;
  onAddLegacy: (app: LegacyApp) => Promise<void>;
}) {
  return (
    <div className="content-panel-picker">
      {activeSeasonals.length > 0 && <section><div className="content-picker-heading"><div><b>Disponíveis agora</b><span>Conteúdos sazonais dentro do período atual.</span></div><Link to="/apps">Ver calendário completo</Link></div><div className="content-picker-grid seasonal-active-grid">{activeSeasonals.map((campaign) => {
        const marker = `seasonal:${campaign.key}`;
        const exists = items.some((item) => item.type === "app" && item.app_key === campaign.key);
        return <article className="content-picker-card seasonal" key={campaign.key}><span className="content-picker-art">{campaign.emoji}</span><div><small className="picker-status">Disponível agora</small><b>{campaign.name}</b><p>{campaign.description}</p><em>{campaign.periodLabel} · {campaign.durationSeconds}s</em></div><AsyncButton busy={busyKey === marker} disabled={exists || Boolean(busyKey && busyKey !== marker)} className={exists ? "btn secondary" : "btn primary"} onClick={() => void onAddSeasonal(campaign)}>{exists ? <Check /> : <Sparkles />}{exists ? "Na biblioteca" : "Adicionar"}</AsyncButton></article>;
      })}</div></section>}

      <section><div className="content-picker-heading"><div><b>Painéis PontoView</b><span>Conteúdos automáticos criados pela PontoView.</span></div><Link to="/apps">Abrir Painéis PontoView</Link></div><div className="content-picker-grid">{PANEL_CATALOG.map((panel) => {
        const marker = `panel:${panel.key}`;
        const exists = items.some((item) => item.type === "webpage" && item.page_url === panelUrl(panel.slug));
        return <article className="content-picker-card" key={panel.key}><span className="content-picker-art">{panel.emoji}</span><div><small>{panel.category}</small><b>{panel.title}</b><p>{panel.description}</p><em>{panel.duration}s</em></div><AsyncButton busy={busyKey === marker} disabled={exists || Boolean(busyKey && busyKey !== marker)} className="btn secondary" onClick={() => void onAddPanel(panel)}>{exists ? <Check /> : <Sparkles />}{exists ? "Na biblioteca" : "Adicionar"}</AsyncButton></article>;
      })}</div></section>

      <section><div className="content-picker-heading"><div><b>Apps integrados</b><span>Recursos legados continuam disponíveis.</span></div></div><div className="content-picker-grid compact">{LEGACY_APPS.map((app) => {
        const marker = `legacy:${app.key}`;
        const exists = items.some((item) => item.type === "app" && item.app_key === app.key);
        return <article className="content-picker-card" key={app.key}><span className="content-picker-art">{app.emoji}</span><div><b>{app.title}</b><p>{app.description}</p></div><AsyncButton busy={busyKey === marker} disabled={exists || Boolean(busyKey && busyKey !== marker)} className="btn secondary" onClick={() => void onAddLegacy(app)}>{exists ? <Check /> : <Sparkles />}{exists ? "Na biblioteca" : "Adicionar"}</AsyncButton></article>;
      })}</div></section>
    </div>
  );
}

function MessagePicker({ messages, items, busyKey, onAdd }: { messages: ExistingMessage[]; items: Media[]; busyKey: string | null; onAdd: (message: ExistingMessage) => Promise<void> }) {
  return (
    <div className="message-picker">
      <div className="content-picker-heading"><div><b>Mensagens já criadas</b><span>Ao adicionar, a mensagem vira um painel de tela cheia que pode entrar em qualquer playlist.</span></div><Link to="/mensagens">Gerenciar mensagens</Link></div>
      {messages.length ? <div className="message-picker-list">{messages.map((message) => {
        const marker = `message:${message.id}`;
        const exists = items.some((item) => item.type === "message" && String(item.metadata?.source_message_id || "") === message.id);
        return <article className="message-picker-card" key={message.id}><span className="message-picker-icon"><MessageSquareText /></span><div className="message-picker-copy"><span className={message.is_active ? "status active" : "status offline-status"}>{message.is_active ? "Ativa" : "Pausada"}</span><b>{message.title || "Mensagem"}</b><p>{message.body}</p></div><AsyncButton busy={busyKey === marker} disabled={exists || Boolean(busyKey && busyKey !== marker)} className={exists ? "btn secondary" : "btn primary"} onClick={() => void onAdd(message)}>{exists ? <Check /> : <Sparkles />}{exists ? "Na biblioteca" : "Adicionar à biblioteca"}</AsyncButton></article>;
      })}</div> : <div className="message-picker-empty"><MessageSquareText /><b>Nenhuma mensagem criada</b><span>Crie sua primeira mensagem na Central de informações e volte para adicioná-la à biblioteca.</span><Link className="btn primary" to="/mensagens">Criar mensagem</Link></div>}
    </div>
  );
}

function BasicContentForm({ source, busy, onSubmit, onCancel }: { source: "youtube" | "webpage"; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  return <form className="youtube-form" onSubmit={onSubmit}>
    {source === "youtube" && <><label>Link do YouTube<input name="url" required placeholder="youtube.com/watch, youtu.be, Shorts ou live" /></label><label>Nome na biblioteca <span>(opcional)</span><input name="name" /></label><div className="form-row"><label>Volume<input name="volume" type="number" min="0" max="100" defaultValue="100" /></label><label>Início (seg)<input name="start" type="number" min="0" defaultValue="0" /></label><label>Fim (seg)<input name="end" type="number" min="1" /></label></div><div className="yt-options"><label><input name="controls" type="checkbox" /> Mostrar controles</label><label><input name="mute" type="checkbox" /> Iniciar silenciado</label></div></>}
    {source === "webpage" && <><label>Nome<input name="name" required /></label><label>Endereço da página<input name="url" type="url" required placeholder="https://" /></label><label>Duração (segundos)<input name="duration" type="number" min="5" defaultValue="30" required /></label></>}
    <div className="modal-actions"><button type="button" className="btn secondary" onClick={onCancel}>Cancelar</button><AsyncButton busy={busy} className="btn primary">Adicionar à biblioteca</AsyncButton></div>
  </form>;
}

function thumbIcon(item: Media) {
  if (item.type === "youtube") return <Youtube size={34} />;
  if (item.type === "drive_video") return <FileVideo size={28} />;
  if (item.type === "drive_image") return <FileImage size={28} />;
  if (item.type === "webpage") return isPanelMedia(item) ? <Sparkles size={28} /> : <Globe2 size={28} />;
  if (item.type === "message") return <MessageSquareText size={28} />;
  return <Sparkles size={28} />;
}
