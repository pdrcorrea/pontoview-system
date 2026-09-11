import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  CloudSun,
  MessageSquareText,
  Monitor,
  Newspaper,
  PanelBottom,
  PanelRight,
  PanelTop,
  Pencil,
  Play,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  AsyncButton,
  EmptyState,
  FormMessage,
  Modal,
  PageHead,
  formData,
  timeAgo,
} from "../components/ui";
import { defaultOperatingHours, normalizeOperatingHours, operatingHoursSummary } from "../lib/operatingHours";
import { CURRENT_PLAYER_VERSION } from "../lib/playerVersion";
import { supabase } from "../lib/supabase";
import type { OperatingHours, Playlist, Screen, ScreenRotation, ScreenSettings, ScreenStatus } from "../types";

const defaultSettings: ScreenSettings = {
  screen_id: "",
  layout_mode: "fullscreen",
  side_position: "right",
  bar_position: "bottom",
  side_width_percent: 20,
  bar_height_percent: 9,
  widgets: {
    clock: true,
    date: true,
    weather: false,
    news: false,
    messages: false,
    business: false,
  },
  weather_location: null,
  news_categories: ["general"],
  transition: "fade",
  image_duration_seconds: 15,
  operating_hours: defaultOperatingHours,
};

const rotationLabels: Record<ScreenRotation, string> = {
  standard: "Sem giro",
  right: "90° à direita",
  left: "90° à esquerda",
  "180": "180°",
};

const weekdayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type ScreenTab = "general" | "visual" | "schedule" | "advanced";

type ScheduleRule = {
  id: string;
  screen_id: string | null;
  weekdays: number[];
  start_time: string;
  end_time: string;
};

type ScheduleRow = {
  id: string;
  organization_id: string;
  name: string;
  playlist_id: string;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string;
  is_active: boolean;
  playlists?: { name: string } | null;
  schedule_rules?: ScheduleRule[];
};

type Group = {
  id: string;
  name: string;
  screen_group_members: Array<{ screen_id: string }>;
};

export function ScreensSimplePage() {
  const { organization, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [screens, setScreens] = useState<Screen[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Screen | null>(null);
  const [pairing, setPairing] = useState(params.get("parear") === "1");
  const [groupModal, setGroupModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organization) return;
    const [screenResult, playlistResult, groupResult] = await Promise.all([
      supabase
        .from("screens")
        .select("id,organization_id,name,slug,orientation,rotation,default_playlist_id,is_active,settings_revision,reload_revision,screen_status(last_seen,current_media_id,current_playlist_id,player_version,screenshot_url,screenshot_at),screen_settings(*)")
        .eq("organization_id", organization.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase.from("playlists").select("*").eq("organization_id", organization.id).order("name"),
      supabase.from("screen_groups").select("id,name,screen_group_members(screen_id)").eq("organization_id", organization.id).order("name"),
    ]);

    if (screenResult.error) setError(screenResult.error.message);
    else setScreens((screenResult.data || []) as unknown as Screen[]);
    if (playlistResult.data) setPlaylists(playlistResult.data as Playlist[]);
    if (groupResult.data) setGroups((groupResult.data || []) as unknown as Group[]);
  }, [organization]);

  useEffect(() => {
    void load();
    if (!organization) return;
    const channel = supabase
      .channel(`screens-simple:${organization.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "screen_status", filter: `organization_id=eq.${organization.id}` },
        () => void load(),
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, organization]);

  const closePair = () => {
    setPairing(false);
    params.delete("parear");
    setParams(params, { replace: true });
  };

  const pair = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = formData(event);
    const result = await supabase.rpc("claim_screen_activation", {
      p_code: data.code.replace(/\D/g, ""),
      p_name: data.name,
    });
    setBusy(false);
    if (result.error) setError(readPairError(result.error.message));
    else {
      closePair();
      await load();
    }
  };

  const deactivate = async (screen: Screen) => {
    if (!confirm(`Desconectar “${screen.name}”? A TV precisará ser conectada novamente.`)) return;
    const result = await supabase
      .from("screens")
      .update({ is_active: false, device_token_hash: null })
      .eq("id", screen.id);
    if (result.error) setError(result.error.message);
    else {
      setSelected(null);
      await load();
    }
  };

  const createGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organization || !user) return;
    setBusy(true);
    setError(null);
    const data = formData(event);
    const raw = new FormData(event.currentTarget);
    const selectedScreens = screens.filter((screen) => raw.has(`screen_${screen.id}`));
    const group = await supabase
      .from("screen_groups")
      .insert({ organization_id: organization.id, name: data.name, created_by: user.id })
      .select("id")
      .single();

    let memberError: string | null = null;
    if (!group.error && selectedScreens.length) {
      const members = await supabase.from("screen_group_members").insert(
        selectedScreens.map((screen) => ({
          organization_id: organization.id,
          group_id: group.data.id,
          screen_id: screen.id,
        })),
      );
      if (members.error) memberError = members.error.message;
    }

    setBusy(false);
    if (group.error || memberError) setError(group.error?.message || memberError);
    else {
      setGroupModal(false);
      await load();
    }
  };

  const removeGroup = async (group: Group) => {
    if (!confirm(`Excluir o grupo “${group.name}”?`)) return;
    const result = await supabase.from("screen_groups").delete().eq("id", group.id);
    if (result.error) setError(result.error.message);
    else await load();
  };

  if (selected) {
    return (
      <ScreenEditor
        screen={screens.find((item) => item.id === selected.id) || selected}
        screens={screens}
        playlists={playlists}
        onBack={() => setSelected(null)}
        onRefresh={load}
        onDeactivate={() => void deactivate(selected)}
      />
    );
  }

  return (
    <>
      <PageHead
        eyebrow="Suas telas"
        title="Telas"
        text="Cada TV tem sua própria configuração. Escolha uma tela para ajustar conteúdo, visual e horários."
        action="Conectar tela"
        onAction={() => setPairing(true)}
      />
      <FormMessage error={!pairing ? error : null} />

      {screens.length ? (
        <div className="simple-screen-grid">
          {screens.map((screen) => (
            <ScreenCard
              key={screen.id}
              screen={screen}
              playlists={playlists}
              onManage={() => setSelected(screen)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Monitor />}
          title="Nenhuma tela conectada"
          text="Abra tv.pontoview.com.br na TV, anote o código exibido e conecte a tela aqui."
          action="Conectar primeira tela"
          onAction={() => setPairing(true)}
        />
      )}

      {screens.length > 0 && (
        <details className="screen-groups-disclosure">
          <summary>
            <span className="summary-icon"><Users /></span>
            <span><b>Organizar telas em grupos</b><small>Opcional. Útil para instalações com várias TVs.</small></span>
            <strong>{groups.length}</strong>
          </summary>
          <div className="screen-groups-body">
            <div className="screen-groups-head">
              <p>Os grupos ficam fora do caminho principal para manter a configuração simples.</p>
              <div className="screen-groups-actions">
                <Link className="btn secondary" to="/programacoes"><CalendarClock /> Programar grupos</Link>
                <button className="btn secondary" onClick={() => setGroupModal(true)}><Plus /> Novo grupo</button>
              </div>
            </div>
            {groups.length ? (
              <div className="group-list">
                {groups.map((group) => (
                  <article className="panel group-card" key={group.id}>
                    <Users />
                    <span><b>{group.name}</b><small>{group.screen_group_members.length} tela(s)</small></span>
                    <button className="icon-button danger-hover" title="Excluir grupo" onClick={() => void removeGroup(group)}><Trash2 /></button>
                  </article>
                ))}
              </div>
            ) : <small className="screen-muted">Nenhum grupo criado.</small>}
          </div>
        </details>
      )}

      {pairing && (
        <Modal eyebrow="CONECTAR TV" title="Conectar uma tela" onClose={closePair}>
          <form className="youtube-form pairing-form simplified-modal" onSubmit={pair}>
            <div className="pair-help">
              <Monitor />
              <span>
                <b>Abra tv.pontoview.com.br na TV</b>
                <small>Digite abaixo o código de 6 dígitos que aparecer na tela.</small>
              </span>
            </div>
            <label>Código mostrado na TV<input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoFocus className="pair-code" placeholder="000000" /></label>
            <label>Como você quer chamar esta tela?<input name="name" required placeholder="Ex.: Recepção principal" /></label>
            <FormMessage error={error} />
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={closePair}>Cancelar</button>
              <AsyncButton busy={busy} className="btn primary">Conectar</AsyncButton>
            </div>
          </form>
        </Modal>
      )}

      {groupModal && (
        <Modal eyebrow="ORGANIZAÇÃO" title="Novo grupo de telas" onClose={() => setGroupModal(false)}>
          <form className="youtube-form simplified-modal" onSubmit={createGroup}>
            <label>Nome do grupo<input name="name" required placeholder="Ex.: Recepção e corredores" /></label>
            <fieldset className="screen-picker">
              <legend>Quais telas fazem parte?</legend>
              {screens.map((screen) => (
                <label key={screen.id}>
                  <input type="checkbox" name={`screen_${screen.id}`} />
                  <span>{screen.name}</span>
                </label>
              ))}
            </fieldset>
            <FormMessage error={error} />
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setGroupModal(false)}>Cancelar</button>
              <AsyncButton busy={busy} className="btn primary">Criar grupo</AsyncButton>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function ScreenCard({ screen, playlists, onManage }: { screen: Screen; playlists: Playlist[]; onManage: () => void }) {
  const status = firstStatus(screen);
  const settings = firstSettings(screen);
  const online = Boolean(status?.last_seen && Date.now() - new Date(status.last_seen).getTime() < 120000);
  const playlistName = playlists.find((playlist) => playlist.id === screen.default_playlist_id)?.name || "Sem playlist padrão";

  return (
    <article className="simple-screen-card">
      <div className="simple-screen-card-top">
        <span className="screen-device-icon"><Monitor /></span>
        <div>
          <h2>{screen.name}</h2>
          <p>{screen.orientation === "portrait" ? "Vertical" : "Horizontal"} · {settings?.layout_mode === "lframe" ? "Com informações" : "Tela cheia"}</p>
        </div>
        <span className={online ? "status active" : "status offline-status"}>
          {online ? <Wifi /> : <WifiOff />}{online ? " Online" : " Offline"}
        </span>
      </div>

      <div className="simple-screen-summary">
        <div><small>Conteúdo padrão</small><b>{playlistName}</b></div>
        <div><small>Último contato</small><b>{timeAgo(status?.last_seen)}</b></div>
      </div>

      <button className="btn primary full screen-manage-button" onClick={onManage}>
        <Settings2 /> Configurar esta tela
      </button>
    </article>
  );
}

function ScreenEditor({
  screen,
  screens,
  playlists,
  onBack,
  onRefresh,
  onDeactivate,
}: {
  screen: Screen;
  screens: Screen[];
  playlists: Playlist[];
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onDeactivate: () => void;
}) {
  const { organization, user } = useAuth();
  const initial = firstSettings(screen);
  const seededSettings: ScreenSettings = {
    ...defaultSettings,
    ...initial,
    widgets: { ...defaultSettings.widgets, ...initial?.widgets },
    operating_hours: normalizeOperatingHours(initial?.operating_hours || defaultOperatingHours),
  };

  const [settings, setSettings] = useState<ScreenSettings>(seededSettings);
  const [activeTab, setActiveTab] = useState<ScreenTab>("general");
  const [orientation, setOrientation] = useState<"landscape" | "portrait">(screen.orientation || "landscape");
  const [rotation, setRotation] = useState<ScreenRotation>(screen.rotation || "standard");
  const [name, setName] = useState(screen.name);
  const [playlist, setPlaylist] = useState(screen.default_playlist_id || "");
  const [revision, setRevision] = useState(screen.settings_revision || 0);
  const [savedFingerprint, setSavedFingerprint] = useState(() => screenConfigFingerprint({
    name: screen.name,
    playlist: screen.default_playlist_id || "",
    orientation: screen.orientation || "landscape",
    rotation: screen.rotation || "standard",
    settings: seededSettings,
  }));
  const [busy, setBusy] = useState(false);
  const [reloadBusy, setReloadBusy] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyModal, setCopyModal] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const status = firstStatus(screen);
  const online = Boolean(status?.last_seen && Date.now() - new Date(status.last_seen).getTime() < 120000);
  const currentPlaylistName = playlists.find((item) => item.id === status?.current_playlist_id)?.name
    || playlists.find((item) => item.id === playlist)?.name
    || "Sem playlist";
  const otherScreens = screens.filter((item) => item.id !== screen.id);

  const currentFingerprint = useMemo(() => screenConfigFingerprint({
    name,
    playlist,
    orientation,
    rotation,
    settings,
  }), [name, playlist, orientation, rotation, settings]);
  const dirty = currentFingerprint !== savedFingerprint;

  const tabs: Array<{ id: ScreenTab; label: string; icon: typeof Monitor }> = [
    { id: "general", label: "Geral", icon: Monitor },
    { id: "visual", label: "Visual", icon: PanelRight },
    { id: "schedule", label: "Programação", icon: CalendarClock },
    { id: "advanced", label: "Avançado", icon: Settings2 },
  ];

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const guardLinks = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target.closest("a[href]") as HTMLAnchorElement | null : null;
      if (!element || element.target === "_blank") return;
      if (!confirm("Há alterações que ainda não foram salvas. Sair mesmo assim?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", guardLinks, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", guardLinks, true);
    };
  }, [dirty]);

  useEffect(() => {
    if (dirty) setSuccess(null);
  }, [dirty]);

  const guardedBack = () => {
    if (dirty && !confirm("Há alterações que ainda não foram salvas. Voltar sem salvar?")) return;
    onBack();
  };

  const toggleWidget = (key: string) => setSettings((current) => ({
    ...current,
    widgets: { ...current.widgets, [key]: !current.widgets[key] },
  }));

  const setWeatherName = (value: string) => setSettings((current) => ({
    ...current,
    weather_location: value.trim() ? { name: value, latitude: null, longitude: null } : null,
  }));

  const toggleNewsCategory = (category: string) => setSettings((current) => ({
    ...current,
    news_categories: current.news_categories.includes(category)
      ? current.news_categories.filter((item) => item !== category)
      : [...current.news_categories, category],
  }));

  const setOperatingHours = (next: OperatingHours) => setSettings((current) => ({
    ...current,
    operating_hours: next,
  }));

  const save = async () => {
    if (!name.trim()) {
      setError("Dê um nome para a tela.");
      setActiveTab("general");
      return;
    }
    if (settings.widgets.weather && !String(settings.weather_location?.name || "").trim()) {
      setError("Informe a cidade usada pelo clima.");
      setActiveTab("visual");
      return;
    }
    if (settings.widgets.news && settings.news_categories.length === 0) {
      setError("Escolha pelo menos uma categoria de notícias.");
      setActiveTab("visual");
      return;
    }
    if (settings.operating_hours.enabled && !settings.operating_hours.weekdays.length) {
      setError("Escolha pelo menos um dia de funcionamento.");
      setActiveTab("schedule");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    const nextRevision = revision + 1;

    const [settingsResult, screenResult] = await Promise.all([
      supabase.from("screen_settings").update(screenSettingsPayload(settings)).eq("screen_id", screen.id),
      supabase.from("screens").update({
        name: name.trim(),
        orientation,
        rotation,
        default_playlist_id: playlist || null,
        settings_revision: nextRevision,
      }).eq("id", screen.id),
    ]);

    setBusy(false);
    if (settingsResult.error || screenResult.error) {
      setError(settingsResult.error?.message || screenResult.error?.message || "Não foi possível salvar.");
      return;
    }

    setRevision(nextRevision);
    setName(name.trim());
    setSavedFingerprint(screenConfigFingerprint({ name, playlist, orientation, rotation, settings }));
    setSuccess("Salvo. A TV recebe as alterações automaticamente.");
    await onRefresh();
  };

  const requestReload = async () => {
    if (!confirm(`Recarregar o Player “${name}”? A reprodução será interrompida por alguns segundos.`)) return;
    setReloadBusy(true);
    setError(null);
    setSuccess(null);
    const result = await supabase.rpc("request_player_reload", { p_screen_id: screen.id });
    setReloadBusy(false);
    if (result.error) setError(result.error.message);
    else setSuccess("Comando enviado. A TV será recarregada em até 15 segundos.");
  };

  const copyConfiguration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (dirty) {
      setCopyError("Salve esta tela antes de copiar.");
      return;
    }
    const raw = new FormData(event.currentTarget);
    const targets = otherScreens.filter((item) => raw.has(`target_${item.id}`));
    if (!targets.length) {
      setCopyError("Escolha pelo menos uma tela.");
      return;
    }

    setCopyBusy(true);
    setCopyError(null);
    const results = await Promise.all(targets.map(async (target) => {
      const [settingsResult, screenResult] = await Promise.all([
        supabase.from("screen_settings").update(screenSettingsPayload(settings)).eq("screen_id", target.id),
        supabase.from("screens").update({
          orientation,
          rotation,
          default_playlist_id: playlist || null,
          settings_revision: (target.settings_revision || 0) + 1,
        }).eq("id", target.id),
      ]);
      return settingsResult.error?.message || screenResult.error?.message || null;
    }));
    setCopyBusy(false);

    const copyFailure = results.find(Boolean);
    if (copyFailure) {
      setCopyError(copyFailure);
      return;
    }

    setCopyModal(false);
    setSuccess(`Configuração copiada para ${targets.length} tela(s).`);
    await onRefresh();
  };

  return (
    <div className="screen-editor-v2">
      <div className="screen-editor-header">
        <button className="btn secondary screen-back" onClick={guardedBack}>← Telas</button>
        <div className="screen-editor-title">
          <small>CONFIGURAÇÃO DA TELA</small>
          <h1>{name || screen.name}</h1>
          <span>{orientation === "portrait" ? "Vertical" : "Horizontal"} · {playlists.find((item) => item.id === playlist)?.name || "Sem playlist padrão"}</span>
        </div>
        <AsyncButton busy={busy} disabled={!dirty} className={`btn primary screen-save-top ${dirty ? "has-changes" : ""}`} onClick={() => void save()}>
          <Save /> {dirty ? "Salvar alterações •" : "Salvo"}
        </AsyncButton>
      </div>

      <div className="screen-health-strip">
        <span className={online ? "screen-health online" : "screen-health offline"}>{online ? <Wifi /> : <WifiOff />}<b>{online ? "Online" : "Offline"}</b></span>
        <span><Play /><b>{currentPlaylistName}</b></span>
        <span><Clock3 /><b>{operatingHoursSummary(settings.operating_hours)}</b></span>
        <span className="screen-health-last">Último contato: {timeAgo(status?.last_seen)}</span>
      </div>

      <nav className="screen-config-tabs" aria-label="Áreas da configuração">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} className={activeTab === id ? "active" : ""} onClick={() => { setActiveTab(id); setError(null); }}>
            <Icon /><span>{label}</span>
          </button>
        ))}
      </nav>

      <FormMessage error={error} success={success} />

      <div className={activeTab === "visual" ? "screen-editor-content with-preview" : "screen-editor-content"}>
        <section className="screen-config-section">
          {activeTab === "general" && (
            <GeneralSettings
              name={name}
              setName={setName}
              playlist={playlist}
              setPlaylist={setPlaylist}
              playlists={playlists}
              orientation={orientation}
              setOrientation={setOrientation}
              onAdvanced={() => setActiveTab("advanced")}
            />
          )}

          {activeTab === "visual" && (
            <VisualSettings
              settings={settings}
              setSettings={setSettings}
              toggleWidget={toggleWidget}
              setWeatherName={setWeatherName}
              toggleNewsCategory={toggleNewsCategory}
            />
          )}

          {activeTab === "schedule" && organization && user && (
            <ProgrammingSettings
              screen={screen}
              playlists={playlists}
              operatingHours={settings.operating_hours}
              onOperatingHoursChange={setOperatingHours}
              organizationId={organization.id}
              timezone={organization.timezone || "America/Sao_Paulo"}
              userId={user.id}
            />
          )}

          {activeTab === "advanced" && (
            <AdvancedSettings
              rotation={rotation}
              setRotation={setRotation}
              reloadBusy={reloadBusy}
              requestReload={requestReload}
              onDeactivate={onDeactivate}
              onCopy={() => {
                if (dirty) {
                  setError("Salve as alterações antes de copiar a configuração.");
                  return;
                }
                setCopyError(null);
                setCopyModal(true);
              }}
              canCopy={otherScreens.length > 0}
              status={status}
              online={online}
              currentPlaylistName={currentPlaylistName}
            />
          )}
        </section>

        {activeTab === "visual" && (
          <aside className="screen-preview-card">
            <div className="preview-label">
              <span>PRÉ-VISUALIZAÇÃO</span>
              <small>{orientation === "portrait" ? "Vertical" : "Horizontal"}</small>
            </div>
            <ScreenPreview settings={settings} orientation={orientation} />
            <div className="preview-note">
              <ShieldCheck />
              <span>Na TV, o Player usa toda a área disponível e adapta o layout automaticamente.</span>
            </div>
          </aside>
        )}
      </div>

      <div className={`screen-mobile-save ${dirty ? "pending" : ""}`}>
        <span>{dirty ? "Alterações pendentes" : "Tudo salvo"}</span>
        <AsyncButton busy={busy} disabled={!dirty} className="btn primary" onClick={() => void save()}><Save /> {dirty ? "Salvar" : "Salvo"}</AsyncButton>
      </div>

      {copyModal && (
        <Modal eyebrow="COPIAR CONFIGURAÇÃO" title="Aplicar em outras telas" onClose={() => setCopyModal(false)}>
          <form className="youtube-form simplified-modal" onSubmit={copyConfiguration}>
            <fieldset className="screen-picker">
              <legend>Escolha as telas</legend>
              {otherScreens.map((item) => (
                <label key={item.id}>
                  <input type="checkbox" name={`target_${item.id}`} />
                  <span>{item.name}</span>
                </label>
              ))}
            </fieldset>
            <small className="copy-note">Copia conteúdo padrão, visual, funcionamento e giro. O nome da tela não muda.</small>
            <FormMessage error={copyError} />
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setCopyModal(false)}>Cancelar</button>
              <AsyncButton busy={copyBusy} className="btn primary"><Copy /> Copiar</AsyncButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function GeneralSettings({
  name,
  setName,
  playlist,
  setPlaylist,
  playlists,
  orientation,
  setOrientation,
  onAdvanced,
}: {
  name: string;
  setName: (value: string) => void;
  playlist: string;
  setPlaylist: (value: string) => void;
  playlists: Playlist[];
  orientation: "landscape" | "portrait";
  setOrientation: (value: "landscape" | "portrait") => void;
  onAdvanced: () => void;
}) {
  return (
    <>
      <ConfigIntro
        icon={<Monitor />}
        title="O essencial"
        text="Aqui ficam apenas as escolhas que você normalmente precisa fazer ao instalar uma TV."
      />

      <div className="simple-setting-card">
        <div className="simple-setting-heading">
          <span>1</span>
          <div><h2>Identifique a tela</h2><p>Use um nome que qualquer pessoa reconheça.</p></div>
        </div>
        <label className="simple-field">Nome da tela<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Recepção principal" /></label>
      </div>

      <div className="simple-setting-card">
        <div className="simple-setting-heading">
          <span>2</span>
          <div><h2>Escolha o conteúdo padrão</h2><p>Esta playlist será exibida quando não houver uma programação especial.</p></div>
        </div>
        <label className="simple-field">
          Playlist padrão
          <select value={playlist} onChange={(event) => setPlaylist(event.target.value)}>
            <option value="">Sem playlist</option>
            {playlists.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </div>

      <div className="simple-setting-card">
        <div className="simple-setting-heading">
          <span>3</span>
          <div><h2>Como a TV está instalada?</h2><p>Escolha apenas a posição física da tela.</p></div>
        </div>
        <div className="friendly-choice-grid">
          <button className={orientation === "landscape" ? "friendly-choice selected" : "friendly-choice"} onClick={() => setOrientation("landscape")}>
            <Monitor /><div><b>Horizontal</b><small>TV instalada deitada</small></div>{orientation === "landscape" && <Check />}
          </button>
          <button className={orientation === "portrait" ? "friendly-choice selected" : "friendly-choice"} onClick={() => setOrientation("portrait")}>
            <Monitor className="portrait-monitor" /><div><b>Vertical</b><small>TV instalada em pé</small></div>{orientation === "portrait" && <Check />}
          </button>
        </div>
        <button className="simple-text-action" onClick={onAdvanced}>A imagem ficou virada? Ajustar giro em Avançado</button>
      </div>
    </>
  );
}

function VisualSettings({
  settings,
  setSettings,
  toggleWidget,
  setWeatherName,
  toggleNewsCategory,
}: {
  settings: ScreenSettings;
  setSettings: React.Dispatch<React.SetStateAction<ScreenSettings>>;
  toggleWidget: (key: string) => void;
  setWeatherName: (value: string) => void;
  toggleNewsCategory: (category: string) => void;
}) {
  const weatherInputRef = useRef<HTMLInputElement>(null);
  const activePreset = settings.layout_mode === "fullscreen"
    ? "clean"
    : settings.widgets.clock && settings.widgets.news && settings.widgets.business && !settings.widgets.weather && !settings.widgets.messages
      ? "info"
      : settings.widgets.clock && settings.widgets.weather && settings.widgets.news && settings.widgets.messages && settings.widgets.business
        ? "full"
        : "";

  useEffect(() => {
    if (!settings.widgets.weather) return;
    window.requestAnimationFrame(() => weatherInputRef.current?.focus());
  }, [settings.widgets.weather]);

  const applyPreset = (preset: "clean" | "info" | "full") => {
    if (preset === "clean") {
      setSettings((current) => ({ ...current, layout_mode: "fullscreen" }));
      return;
    }

    if (preset === "info") {
      setSettings((current) => ({
        ...current,
        layout_mode: "lframe",
        widgets: {
          ...current.widgets,
          clock: true,
          date: true,
          news: true,
          weather: false,
          messages: false,
          business: true,
        },
      }));
      return;
    }

    setSettings((current) => ({
      ...current,
      layout_mode: "lframe",
      widgets: {
        ...current.widgets,
        clock: true,
        date: true,
        weather: true,
        news: true,
        messages: true,
        business: true,
      },
    }));
  };

  return (
    <>
      <ConfigIntro
        icon={<PanelRight />}
        title="Visual da tela"
        text="Escolha um modelo pronto ou personalize somente o que precisar."
      />

      <div className="simple-setting-card">
        <div className="simple-setting-heading no-number">
          <div><h2>Modelos rápidos</h2><p>Um toque já deixa a tela pronta para os usos mais comuns.</p></div>
        </div>
        <div className="visual-presets">
          <button className={activePreset === "clean" ? "active" : ""} onClick={() => applyPreset("clean")}><Monitor /><span><b>Essencial</b><small>Somente conteúdo</small></span>{activePreset === "clean" && <Check />}</button>
          <button className={activePreset === "info" ? "active" : ""} onClick={() => applyPreset("info")}><Newspaper /><span><b>Informativo</b><small>Relógio e notícias</small></span>{activePreset === "info" && <Check />}</button>
          <button className={activePreset === "full" ? "active" : ""} onClick={() => applyPreset("full")}><PanelRight /><span><b>Completo</b><small>Todas as informações</small></span>{activePreset === "full" && <Check />}</button>
        </div>
      </div>

      <div className="simple-setting-card">
        <div className="simple-setting-heading no-number">
          <div><h2>Formato de exibição</h2><p>Você ainda pode ajustar o modelo escolhido.</p></div>
        </div>
        <div className="friendly-choice-grid">
          <button className={settings.layout_mode === "fullscreen" ? "friendly-choice selected" : "friendly-choice"} onClick={() => setSettings((current) => ({ ...current, layout_mode: "fullscreen" }))}>
            <Monitor /><div><b>Tela cheia</b><small>Somente o conteúdo principal</small></div>{settings.layout_mode === "fullscreen" && <Check />}
          </button>
          <button className={settings.layout_mode === "lframe" ? "friendly-choice selected" : "friendly-choice"} onClick={() => setSettings((current) => ({ ...current, layout_mode: "lframe", widgets: { ...current.widgets, clock: true, date: true } }))}>
            <PanelRight /><div><b>Com informações</b><small>Relógio, clima, notícias e avisos</small></div>{settings.layout_mode === "lframe" && <Check />}
          </button>
        </div>
      </div>

      {settings.layout_mode === "lframe" && (
        <>
          <div className="simple-setting-card">
            <div className="simple-setting-heading no-number">
              <div><h2>Posição das informações</h2></div>
            </div>
            <div className="position-choices">
              <div>
                <small>COLUNA</small>
                <div className="segmented">
                  <button className={settings.side_position === "left" ? "selected" : ""} onClick={() => setSettings((current) => ({ ...current, side_position: "left" }))}><PanelRight style={{ transform: "scaleX(-1)" }} /> Esquerda</button>
                  <button className={settings.side_position === "right" ? "selected" : ""} onClick={() => setSettings((current) => ({ ...current, side_position: "right" }))}><PanelRight /> Direita</button>
                </div>
              </div>
              <div>
                <small>FAIXA</small>
                <div className="segmented">
                  <button className={settings.bar_position === "top" ? "selected" : ""} onClick={() => setSettings((current) => ({ ...current, bar_position: "top" }))}><PanelTop /> Superior</button>
                  <button className={settings.bar_position === "bottom" ? "selected" : ""} onClick={() => setSettings((current) => ({ ...current, bar_position: "bottom" }))}><PanelBottom /> Inferior</button>
                </div>
              </div>
            </div>
          </div>

          <div className="simple-setting-card">
            <div className="simple-setting-heading no-number">
              <div><h2>Informações exibidas</h2></div>
            </div>
            <div className="friendly-widget-list">
              <FriendlyWidget icon={Clock3} label="Relógio e data" hint="Hora e data na coluna lateral" checked={settings.widgets.clock} onClick={() => toggleWidget("clock")} />
              <FriendlyWidget icon={CloudSun} label="Clima" hint="Temperatura e previsão" checked={settings.widgets.weather} onClick={() => toggleWidget("weather")} />
              <FriendlyWidget icon={Newspaper} label="Notícias" hint="Manchetes na faixa informativa" checked={settings.widgets.news} onClick={() => toggleWidget("news")} />
              <FriendlyWidget icon={MessageSquareText} label="Mensagens" hint="Avisos cadastrados no sistema" checked={settings.widgets.messages} onClick={() => toggleWidget("messages")} />
              <FriendlyWidget icon={Building2} label="Sua marca" hint="Nome ou logo do estabelecimento" checked={settings.widgets.business} onClick={() => toggleWidget("business")} />
            </div>

            {settings.widgets.weather && (
              <div className="nested-setting">
                <label className="simple-field">Cidade do clima<input ref={weatherInputRef} value={String(settings.weather_location?.name || "")} onChange={(event) => setWeatherName(event.target.value)} placeholder="Ex.: Colatina, ES" /></label>
              </div>
            )}

            {settings.widgets.news && (
              <div className="nested-setting">
                <b>Categorias das notícias</b>
                <div className="weekday-picker simple-category-picker">
                  {[
                    ["general", "Geral"], ["economy", "Economia"], ["sports", "Esportes"],
                    ["technology", "Tecnologia"], ["health", "Saúde"], ["local", "Local"],
                  ].map(([id, label]) => (
                    <label key={id}>
                      <input type="checkbox" checked={settings.news_categories.includes(id)} onChange={() => toggleNewsCategory(id)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

function ProgrammingSettings({
  screen,
  playlists,
  operatingHours,
  onOperatingHoursChange,
  organizationId,
  timezone,
  userId,
}: {
  screen: Screen;
  playlists: Playlist[];
  operatingHours: OperatingHours;
  onOperatingHoursChange: (value: OperatingHours) => void;
  organizationId: string;
  timezone: string;
  userId: string;
}) {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<ScheduleRow | null>(null);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  const loadSchedules = useCallback(async () => {
    const result = await supabase
      .from("schedules")
      .select("id,organization_id,name,playlist_id,starts_at,ends_at,timezone,is_active,playlists(name),schedule_rules(id,screen_id,weekdays,start_time,end_time)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (result.error) {
      setScheduleError(result.error.message);
      return;
    }

    const all = (result.data || []) as unknown as ScheduleRow[];
    setRows(all.filter((row) => row.schedule_rules?.some((rule) => rule.screen_id === screen.id)));
  }, [organizationId, screen.id]);

  useEffect(() => { void loadSchedules(); }, [loadSchedules]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const openNew = () => {
    setEditing(null);
    setScheduleError(null);
    setModal(true);
  };

  const openEdit = (row: ScheduleRow) => {
    setEditing(row);
    setScheduleError(null);
    setModal(true);
  };

  const saveSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setScheduleBusy(true);
    setScheduleError(null);

    const data = formData(event);
    const raw = new FormData(event.currentTarget);
    const weekdays = weekdayNames.map((_, index) => index).filter((index) => raw.has(`day_${index}`));

    if (!weekdays.length) {
      setScheduleBusy(false);
      setScheduleError("Escolha pelo menos um dia da semana.");
      return;
    }

    const payload = {
      organization_id: organizationId,
      name: data.name,
      playlist_id: data.playlist_id,
      priority: "timed",
      starts_at: data.starts_at ? new Date(`${data.starts_at}T00:00:00`).toISOString() : null,
      ends_at: data.ends_at ? new Date(`${data.ends_at}T23:59:59`).toISOString() : null,
      timezone,
      is_active: true,
      created_by: userId,
    };

    let scheduleId = editing?.id || "";
    if (editing) {
      const update = await supabase.from("schedules").update(payload).eq("id", editing.id);
      if (update.error) {
        setScheduleBusy(false);
        setScheduleError(update.error.message);
        return;
      }
      await supabase.from("schedule_rules").delete().eq("schedule_id", editing.id);
    } else {
      const create = await supabase.from("schedules").insert(payload).select("id").single();
      if (create.error) {
        setScheduleBusy(false);
        setScheduleError(create.error.message);
        return;
      }
      scheduleId = create.data.id;
    }

    const rule = await supabase.from("schedule_rules").insert({
      organization_id: organizationId,
      schedule_id: scheduleId,
      screen_id: screen.id,
      screen_group_id: null,
      weekdays,
      start_time: data.start_time || "00:00",
      end_time: data.end_time || "23:59",
    });

    setScheduleBusy(false);
    if (rule.error) setScheduleError(rule.error.message);
    else {
      setModal(false);
      setEditing(null);
      await loadSchedules();
    }
  };

  const toggleSchedule = async (row: ScheduleRow) => {
    const result = await supabase.from("schedules").update({ is_active: !row.is_active }).eq("id", row.id);
    if (result.error) setScheduleError(result.error.message);
    else await loadSchedules();
  };

  const removeSchedule = async (row: ScheduleRow) => {
    if (!confirm(`Excluir a programação “${row.name}”?`)) return;
    const result = await supabase.from("schedules").delete().eq("id", row.id);
    if (result.error) setScheduleError(result.error.message);
    else await loadSchedules();
  };

  const toggleOperating = () => onOperatingHoursChange({ ...operatingHours, enabled: !operatingHours.enabled });
  const toggleOperatingDay = (day: number) => {
    const weekdays = operatingHours.weekdays.includes(day)
      ? operatingHours.weekdays.filter((item) => item !== day)
      : [...operatingHours.weekdays, day].sort((a, b) => a - b);
    onOperatingHoursChange({ ...operatingHours, weekdays });
  };

  return (
    <>
      <ConfigIntro
        icon={<CalendarClock />}
        title="Programação"
        text="Defina quando a TV fica ligada e, se quiser, troque a playlist automaticamente em determinados horários."
      />

      <div className="schedule-flow">
        <span><b>Playlist padrão</b><small>Exibida normalmente</small></span>
        <ChevronRight />
        <span><b>Horário programado</b><small>Troca automática</small></span>
        <ChevronRight />
        <span><b>Playlist padrão</b><small>Volta sozinha</small></span>
      </div>

      <div className="simple-setting-card">
        <div className="simple-setting-heading no-number">
          <div>
            <h2>Horário de funcionamento</h2>
            <p>Fora deste período, o Player fica preto. Se desativado, a tela funciona o tempo todo.</p>
          </div>
          <button className={operatingHours.enabled ? "simple-switch on" : "simple-switch"} onClick={toggleOperating} aria-label="Ativar horário de funcionamento"><b /></button>
        </div>

        <div className="schedule-summary-line">
          <Power />
          <span><b>{operatingHoursSummary(operatingHours)}</b><small>Salvo junto com as configurações da tela.</small></span>
        </div>

        {operatingHours.enabled && (
          <div className="nested-setting operating-fields">
            <b>Dias em funcionamento</b>
            <div className="weekday-picker">
              {weekdayNames.map((label, index) => (
                <label key={label}>
                  <input type="checkbox" checked={operatingHours.weekdays.includes(index)} onChange={() => toggleOperatingDay(index)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div className="form-row">
              <label className="simple-field">Ligar às<input type="time" value={operatingHours.start} onChange={(event) => onOperatingHoursChange({ ...operatingHours, start: event.target.value })} /></label>
              <label className="simple-field">Entrar em repouso às<input type="time" value={operatingHours.end} onChange={(event) => onOperatingHoursChange({ ...operatingHours, end: event.target.value })} /></label>
            </div>
            <small>Horários que atravessam a meia-noite também funcionam, por exemplo 18:00 até 02:00.</small>
          </div>
        )}
      </div>

      <div className="simple-setting-card">
        <div className="simple-setting-heading no-number schedule-card-heading">
          <div><h2>Trocas automáticas de conteúdo</h2><p>A playlist padrão continua sendo usada fora dos horários abaixo.</p></div>
          <button className="btn primary" onClick={openNew}><Plus /> Nova programação</button>
        </div>

        <FormMessage error={scheduleError} />

        {rows.length ? (
          <div className="inline-schedule-list">
            {rows.map((row) => {
              const rule = row.schedule_rules?.find((item) => item.screen_id === screen.id) || row.schedule_rules?.[0];
              const activeNow = scheduleMatchesNow(row, rule, timezone, now);
              return (
                <article className={activeNow ? "inline-schedule-card current" : "inline-schedule-card"} key={row.id}>
                  <div className="inline-schedule-main">
                    <span className={activeNow ? "schedule-state now" : row.is_active ? "schedule-state active" : "schedule-state paused"}>{activeNow ? "Em exibição agora" : row.is_active ? "Agendada" : "Pausada"}</span>
                    <h3>{row.name}</h3>
                    <p>{row.playlists?.name || "Playlist"} · {scheduleDays(rule?.weekdays || [])}</p>
                    <small><Clock3 /> {formatRuleTime(rule)}</small>
                  </div>
                  <div className="inline-schedule-actions">
                    <button className="icon-button" title={row.is_active ? "Pausar" : "Ativar"} onClick={() => void toggleSchedule(row)}>{row.is_active ? <PowerOff /> : <Play />}</button>
                    <button className="icon-button" title="Editar" onClick={() => openEdit(row)}><Pencil /></button>
                    <button className="icon-button danger-hover" title="Excluir" onClick={() => void removeSchedule(row)}><Trash2 /></button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="simple-empty-inline">
            <CalendarClock />
            <div><b>Nenhuma troca programada</b><small>A playlist padrão será usada durante todo o período de funcionamento.</small></div>
          </div>
        )}
      </div>

      {modal && (
        <Modal eyebrow="PROGRAMAÇÃO DA TELA" title={editing ? "Editar programação" : "Nova programação"} onClose={() => { setModal(false); setEditing(null); setScheduleError(null); }}>
          <form className="youtube-form simplified-modal schedule-modal-form" onSubmit={saveSchedule}>
            <div className="info-box compact-info">
              <Monitor />
              <span><b>{screen.name}</b><small>Esta programação será aplicada somente a esta tela.</small></span>
            </div>

            <label>Nome da programação<input name="name" required defaultValue={editing?.name || ""} placeholder="Ex.: Almoço" /></label>
            <label>Qual playlist deve aparecer?
              <select name="playlist_id" required defaultValue={editing?.playlist_id || ""}>
                <option value="">Selecione</option>
                {playlists.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>

            <fieldset className="screen-picker schedule-days">
              <legend>Em quais dias?</legend>
              <div className="weekday-picker">
                {weekdayNames.map((label, index) => (
                  <label key={label}>
                    <input type="checkbox" name={`day_${index}`} defaultChecked={(editing?.schedule_rules?.[0]?.weekdays || [1, 2, 3, 4, 5]).includes(index)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="form-row">
              <label>Começa às<input name="start_time" type="time" required defaultValue={String(editing?.schedule_rules?.[0]?.start_time || "08:00").slice(0, 5)} /></label>
              <label>Termina às<input name="end_time" type="time" required defaultValue={String(editing?.schedule_rules?.[0]?.end_time || "18:00").slice(0, 5)} /></label>
            </div>

            <details className="schedule-optional">
              <summary>Definir período de datas, opcional</summary>
              <div className="form-row">
                <label>Data inicial<input name="starts_at" type="date" defaultValue={editing?.starts_at?.slice(0, 10) || ""} /></label>
                <label>Data final<input name="ends_at" type="date" defaultValue={editing?.ends_at?.slice(0, 10) || ""} /></label>
              </div>
            </details>

            <FormMessage error={scheduleError} />
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => { setModal(false); setEditing(null); setScheduleError(null); }}>Cancelar</button>
              <AsyncButton busy={scheduleBusy} className="btn primary">Salvar programação</AsyncButton>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function AdvancedSettings({
  rotation,
  setRotation,
  reloadBusy,
  requestReload,
  onDeactivate,
  onCopy,
  canCopy,
  status,
  online,
  currentPlaylistName,
}: {
  rotation: ScreenRotation;
  setRotation: (value: ScreenRotation) => void;
  reloadBusy: boolean;
  requestReload: () => Promise<void>;
  onDeactivate: () => void;
  onCopy: () => void;
  canCopy: boolean;
  status: ScreenStatus | null;
  online: boolean;
  currentPlaylistName: string;
}) {
  return (
    <>
      <ConfigIntro
        icon={<Settings2 />}
        title="Avançado"
        text="Use esta área somente quando precisar ajustar instalação ou manutenção."
      />

      <div className="simple-setting-card">
        <div className="simple-setting-heading no-number">
          <div><h2>Diagnóstico rápido</h2></div>
        </div>
        <div className="diagnostic-grid">
          <div className={online ? "diagnostic-item ok" : "diagnostic-item warn"}>
            {online ? <Wifi /> : <WifiOff />}
            <span><small>Conexão</small><b>{online ? "TV conectada" : "Sem comunicação"}</b></span>
          </div>
          <div className={status?.player_version === CURRENT_PLAYER_VERSION ? "diagnostic-item ok" : "diagnostic-item"}>
            <RefreshCw />
            <span><small>Player</small><b>{status?.player_version === CURRENT_PLAYER_VERSION ? "Atualizado" : status?.player_version ? "Atualização pendente" : "Não identificado"}</b></span>
          </div>
          <div className="diagnostic-item">
            <Play />
            <span><small>Conteúdo</small><b>{currentPlaylistName}</b></span>
          </div>
        </div>
        <details className="diagnostic-details">
          <summary>Detalhes técnicos</summary>
          <dl>
            <div><dt>Versão instalada</dt><dd>{status?.player_version || "Não identificada"}</dd></div>
            <div><dt>Versão atual</dt><dd>{CURRENT_PLAYER_VERSION}</dd></div>
            <div><dt>Última sincronização</dt><dd>{timeAgo(status?.last_seen)}</dd></div>
            <div><dt>Giro</dt><dd>{rotationLabels[rotation]}</dd></div>
          </dl>
        </details>
      </div>

      <div className="simple-setting-card">
        <div className="simple-setting-heading no-number">
          <div><h2>A imagem ficou virada?</h2></div>
        </div>
        <div className="rotation-choice friendly-rotation">
          <button className={rotation === "standard" ? "rotation-option selected" : "rotation-option"} onClick={() => setRotation("standard")}><Monitor /><span>Sem giro</span></button>
          <button className={rotation === "left" ? "rotation-option selected" : "rotation-option"} onClick={() => setRotation("left")}><RotateCcw /><span>Esquerda</span></button>
          <button className={rotation === "right" ? "rotation-option selected" : "rotation-option"} onClick={() => setRotation("right")}><RotateCw /><span>Direita</span></button>
          <button className={rotation === "180" ? "rotation-option selected" : "rotation-option"} onClick={() => setRotation("180")}><RefreshCw /><span>Inverter</span></button>
        </div>
      </div>

      {canCopy && (
        <div className="simple-setting-card">
          <div className="simple-setting-heading no-number">
            <div><h2>Usar esta configuração em outra TV</h2></div>
          </div>
          <button className="btn secondary" onClick={onCopy}><Copy /> Copiar para outra tela</button>
        </div>
      )}

      <div className="simple-setting-card">
        <div className="simple-setting-heading no-number">
          <div><h2>Recarregar a TV</h2></div>
        </div>
        <div className="maintenance-action">
          <RefreshCw />
          <span><b>Limpar cache e recarregar</b><small>O pareamento é mantido.</small></span>
          <AsyncButton busy={reloadBusy} className="btn secondary" onClick={() => void requestReload()}>Recarregar</AsyncButton>
        </div>
      </div>

      <div className="simple-setting-card danger-zone">
        <div className="simple-setting-heading no-number">
          <div><h2>Desconectar esta TV</h2></div>
        </div>
        <button className="btn danger" onClick={onDeactivate}><Power /> Desconectar Player</button>
      </div>
    </>
  );
}

function ConfigIntro({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="config-intro">
      <span>{icon}</span>
      <div><h2>{title}</h2><p>{text}</p></div>
    </div>
  );
}

function FriendlyWidget({ icon: Icon, label, hint, checked, onClick }: { icon: typeof Clock3; label: string; hint: string; checked?: boolean; onClick: () => void }) {
  return (
    <button className={checked ? "friendly-widget enabled" : "friendly-widget"} onClick={onClick}>
      <span className="friendly-widget-icon"><Icon /></span>
      <span><b>{label}</b><small>{hint}</small></span>
      <i className={checked ? "simple-switch on" : "simple-switch"}><b /></i>
    </button>
  );
}

function ScreenPreview({ settings, orientation }: { settings: ScreenSettings; orientation: "landscape" | "portrait" }) {
  const style = {
    aspectRatio: orientation === "portrait" ? "9 / 16" : "16 / 9",
    width: orientation === "portrait" ? "min(100%, 320px)" : "100%",
    marginInline: "auto",
  } as const;

  if (settings.layout_mode === "fullscreen") {
    return (
      <div className={`frame-preview fullscreen-preview orientation-${orientation}`} style={style}>
        <div className="main-media"><Play /><b>Conteúdo da playlist</b><small>Vídeos · Imagens · Painéis · YouTube</small></div>
      </div>
    );
  }

  return (
    <div className={`frame-preview l-preview orientation-${orientation} side-${settings.side_position} bar-${settings.bar_position}`} style={style}>
      <div className="main-media"><Play /><b>Conteúdo principal</b><small>Playlist PontoView</small></div>
      <aside className="frame-side">
        {settings.widgets.clock && <div className="clock-widget"><b>13:06</b><small>SEX · 11 SET</small></div>}
        {settings.widgets.weather && <div className="weather-widget"><CloudSun /><span><b>26°</b><small>{String(settings.weather_location?.name || "Sua cidade")}</small></span></div>}
        {settings.widgets.business && <div className="business-widget"><Building2 /><small>Sua empresa</small></div>}
      </aside>
      <div className="frame-bar">
        {settings.widgets.news && <span><b>AGORA</b> Notícias e informações atualizadas...</span>}
        {settings.widgets.messages && <span>• Mensagem da empresa</span>}
      </div>
    </div>
  );
}

function firstStatus(screen: Screen) {
  const raw = screen.screen_status;
  return (Array.isArray(raw) ? raw[0] : raw) as ScreenStatus | null;
}

function firstSettings(screen: Screen) {
  const raw = screen.screen_settings;
  return (Array.isArray(raw) ? raw[0] : raw) as ScreenSettings | undefined;
}

function scheduleDays(days: number[]) {
  if (days.length === 7) return "Todos os dias";
  if (days.join(",") === "1,2,3,4,5") return "Seg a Sex";
  return days.map((day) => weekdayNames[day]).join(", ") || "Sem dias";
}

function formatRuleTime(rule?: ScheduleRule) {
  if (!rule) return "Sem horário";
  return `${String(rule.start_time).slice(0, 5)} até ${String(rule.end_time).slice(0, 5)}`;
}

function screenSettingsPayload(settings: ScreenSettings) {
  return {
    layout_mode: settings.layout_mode,
    side_position: settings.side_position,
    bar_position: settings.bar_position,
    widgets: settings.widgets,
    weather_location: settings.weather_location,
    news_categories: settings.news_categories,
    transition: settings.transition,
    image_duration_seconds: settings.image_duration_seconds,
    operating_hours: settings.operating_hours,
  };
}

function screenConfigFingerprint(value: {
  name: string;
  playlist: string;
  orientation: "landscape" | "portrait";
  rotation: ScreenRotation;
  settings: ScreenSettings;
}) {
  return JSON.stringify({
    name: value.name.trim(),
    playlist: value.playlist,
    orientation: value.orientation,
    rotation: value.rotation,
    settings: screenSettingsPayload(value.settings),
  });
}

function scheduleMatchesNow(row: ScheduleRow, rule: ScheduleRule | undefined, timezone: string, now: Date) {
  if (!row.is_active || !rule) return false;
  if (row.starts_at && now < new Date(row.starts_at)) return false;
  if (row.ends_at && now >= new Date(row.ends_at)) return false;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || row.timezone || "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((part) => part.type === "weekday")?.value || "Sun");
  const minute = Number(parts.find((part) => part.type === "hour")?.value || 0) * 60
    + Number(parts.find((part) => part.type === "minute")?.value || 0);
  const [startHour, startMinute] = String(rule.start_time || "00:00").split(":").map(Number);
  const [endHour, endMinute] = String(rule.end_time || "23:59").split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;

  if (start <= end) return rule.weekdays.includes(day) && minute >= start && minute <= end;
  if (minute >= start) return rule.weekdays.includes(day);
  return minute <= end && rule.weekdays.includes((day + 6) % 7);
}

function readPairError(message: string) {
  if (message.includes("CODE_NOT_FOUND")) return "Código inválido ou expirado. Abra novamente o Player na TV.";
  if (message.includes("SCREEN_LIMIT")) return "O limite de telas do plano foi atingido.";
  if (message.includes("SUBSCRIPTION")) return "A assinatura precisa estar ativa para conectar uma nova tela.";
  return message;
}
