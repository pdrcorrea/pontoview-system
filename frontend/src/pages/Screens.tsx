import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Building2,
  Clock3,
  CloudSun,
  MessageSquareText,
  Monitor,
  Newspaper,
  PanelBottom,
  PanelRight,
  PanelTop,
  Play,
  Power,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
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
import { defaultOperatingHours } from "../lib/operatingHours";
import { supabase } from "../lib/supabase";
import type { Playlist, Screen, ScreenRotation, ScreenSettings, ScreenStatus } from "../types";

const defaultSettings: ScreenSettings = {
  screen_id: "",
  layout_mode: "fullscreen",
  side_position: "right",
  bar_position: "bottom",
  side_width_percent: 24,
  bar_height_percent: 15,
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
  standard: "Padrão",
  right: "90° à direita",
  left: "90° à esquerda",
  "180": "180°",
};

export function ScreensPage() {
  const { organization, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [screens, setScreens] = useState<Screen[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [groups, setGroups] = useState<Array<{
    id: string;
    name: string;
    screen_group_members: Array<{ screen_id: string }>;
  }>>([]);
  const [groupModal, setGroupModal] = useState(false);
  const [selected, setSelected] = useState<Screen | null>(null);
  const [pairing, setPairing] = useState(params.get("parear") === "1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organization) return;
    const [s, p, g] = await Promise.all([
      supabase
        .from("screens")
        .select("id,organization_id,name,slug,orientation,rotation,default_playlist_id,is_active,settings_revision,reload_revision,screen_status(last_seen,current_media_id,current_playlist_id,player_version,screenshot_url,screenshot_at),screen_settings(*)")
        .eq("organization_id", organization.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase.from("playlists").select("*").eq("organization_id", organization.id).order("name"),
      supabase.from("screen_groups").select("id,name,screen_group_members(screen_id)").eq("organization_id", organization.id).order("name"),
    ]);
    if (s.error) setError(s.error.message);
    else setScreens((s.data || []) as unknown as Screen[]);
    if (p.data) setPlaylists(p.data as Playlist[]);
    if (g.data) setGroups(g.data as unknown as typeof groups);
  }, [organization]);

  useEffect(() => {
    void load();
    if (!organization) return;
    const channel = supabase
      .channel(`screens:${organization.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "screen_status",
        filter: `organization_id=eq.${organization.id}`,
      }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, organization]);

  const closePair = () => {
    setPairing(false);
    params.delete("parear");
    setParams(params, { replace: true });
  };

  const pair = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = formData(e);
    const result = await supabase.rpc("claim_screen_activation", {
      p_code: data.code.replace(/\D/g, ""),
      p_name: data.name,
    });
    setBusy(false);
    if (result.error) setError(readPairError(result.error.message));
    else { closePair(); await load(); }
  };

  const deactivate = async (screen: Screen) => {
    if (!confirm(`Desconectar “${screen.name}”? O Player precisará ser pareado novamente.`)) return;
    const result = await supabase.from("screens").update({ is_active: false, device_token_hash: null }).eq("id", screen.id);
    if (result.error) setError(result.error.message);
    else { setSelected(null); await load(); }
  };

  const createGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organization || !user) return;
    setBusy(true);
    setError(null);
    const data = formData(event);
    const raw = new FormData(event.currentTarget);
    const selectedScreens = screens.filter((screen) => raw.has(`screen_${screen.id}`));
    const group = await supabase.from("screen_groups").insert({
      organization_id: organization.id,
      name: data.name,
      created_by: user.id,
    }).select("id").single();
    let memberError: string | null = null;
    if (!group.error && selectedScreens.length) {
      const members = await supabase.from("screen_group_members").insert(selectedScreens.map((screen) => ({
        organization_id: organization.id,
        group_id: group.data.id,
        screen_id: screen.id,
      })));
      if (members.error) memberError = members.error.message;
    }
    setBusy(false);
    if (group.error || memberError) setError(group.error?.message || memberError);
    else { setGroupModal(false); await load(); }
  };

  const removeGroup = async (group: { id: string; name: string }) => {
    if (!confirm(`Excluir o grupo “${group.name}”?`)) return;
    const result = await supabase.from("screen_groups").delete().eq("id", group.id);
    if (result.error) setError(result.error.message);
    else await load();
  };

  return (
    <>
      <PageHead
        eyebrow="Dispositivos"
        title="Telas"
        text="Conecte, monitore e configure cada Player sem login na TV."
        action="Conectar tela"
        onAction={() => setPairing(true)}
      />
      <FormMessage error={!pairing ? error : null} />
      {selected ? (
        <ScreenEditor
          screen={selected}
          playlists={playlists}
          onBack={() => setSelected(null)}
          onSaved={async () => { setSelected(null); await load(); }}
          onDeactivate={() => void deactivate(selected)}
        />
      ) : screens.length ? (
        <div className="device-grid">
          {screens.map((screen) => (
            <ScreenCard key={screen.id} screen={screen} onManage={() => setSelected(screen)} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Monitor />}
          title="Nenhuma tela conectada"
          text="Abra a rota /player em uma TV ou computador e informe aqui o código exibido."
          action="Conectar primeira tela"
          onAction={() => setPairing(true)}
        />
      )}

      {!selected && screens.length > 0 && (
        <section className="groups-section">
          <div className="panel-title">
            <div><h2>Grupos de telas</h2><p>Use grupos para programar vários Players de uma vez.</p></div>
            <button className="btn secondary" onClick={() => setGroupModal(true)}><Users /> Novo grupo</button>
          </div>
          <div className="group-list">
            {groups.length ? groups.map((group) => (
              <article className="panel group-card" key={group.id}>
                <Users />
                <span><b>{group.name}</b><small>{group.screen_group_members.length} tela(s)</small></span>
                <button className="icon-button danger-hover" title="Excluir grupo" onClick={() => void removeGroup(group)}><Trash2 /></button>
              </article>
            )) : <small>Nenhum grupo criado.</small>}
          </div>
        </section>
      )}

      {pairing && (
        <Modal eyebrow="PAREAR PLAYER" title="Conectar uma tela" onClose={closePair}>
          <form className="youtube-form pairing-form" onSubmit={pair}>
            <div className="pair-help">
              <Monitor />
              <span><b>Abra {window.location.origin}/player na TV</b><small>O Player mostrará um código temporário de 6 dígitos.</small></span>
            </div>
            <label>Código da TV<input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoFocus className="pair-code" placeholder="000000" /></label>
            <label>Nome da tela<input name="name" required placeholder="Ex.: Recepção principal" /></label>
            <FormMessage error={error} />
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={closePair}>Cancelar</button>
              <AsyncButton busy={busy} className="btn primary">Conectar tela</AsyncButton>
            </div>
          </form>
        </Modal>
      )}

      {groupModal && (
        <Modal eyebrow="GRUPO DE TELAS" title="Novo grupo" onClose={() => setGroupModal(false)}>
          <form className="youtube-form" onSubmit={createGroup}>
            <label>Nome do grupo<input name="name" required placeholder="Ex.: Lojas do Centro" /></label>
            <fieldset className="screen-picker">
              <legend>Telas do grupo</legend>
              {screens.map((screen) => (
                <label key={screen.id}><input type="checkbox" name={`screen_${screen.id}`} /><span>{screen.name}</span></label>
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

function ScreenCard({ screen, onManage }: { screen: Screen; onManage: () => void }) {
  const rawStatus = screen.screen_status;
  const status = (Array.isArray(rawStatus) ? rawStatus[0] : rawStatus) as ScreenStatus | null;
  const rawSettings = screen.screen_settings;
  const settings = (Array.isArray(rawSettings) ? rawSettings[0] : rawSettings) as ScreenSettings | undefined;
  const online = Boolean(status?.last_seen && Date.now() - new Date(status.last_seen).getTime() < 120000);
  const rotation = screen.rotation || "standard";
  return (
    <article className="device-card compact-device">
      <div className="device-head">
        <div>
          <h2>{screen.name}</h2>
          <p>{settings?.layout_mode === "lframe" ? "Moldura em L" : "Tela cheia"} · {screen.orientation === "portrait" ? "Vertical" : "Horizontal"}{rotation !== "standard" ? ` · ${rotationLabels[rotation]}` : ""}</p>
        </div>
        <span className={online ? "status active" : "status offline-status"}>{online ? <Wifi /> : <WifiOff />}{online ? " Online" : " Offline"}</span>
      </div>
      <dl>
        <div><dt>Última comunicação</dt><dd>{timeAgo(status?.last_seen)}</dd></div>
        <div><dt>Player</dt><dd>{status?.player_version || "—"}</dd></div>
      </dl>
      <button className="btn secondary full" onClick={onManage}>Gerenciar tela</button>
    </article>
  );
}

function ScreenEditor({
  screen,
  playlists,
  onBack,
  onSaved,
  onDeactivate,
}: {
  screen: Screen;
  playlists: Playlist[];
  onBack: () => void;
  onSaved: () => void;
  onDeactivate: () => void;
}) {
  const raw = screen.screen_settings;
  const initial = (Array.isArray(raw) ? raw[0] : raw) as ScreenSettings | undefined;
  const [settings, setSettings] = useState<ScreenSettings>({
    ...defaultSettings,
    ...initial,
    widgets: { ...defaultSettings.widgets, ...initial?.widgets },
    operating_hours: { ...defaultOperatingHours, ...initial?.operating_hours },
  });
  const [orientation, setOrientation] = useState<"landscape" | "portrait">(screen.orientation || "landscape");
  const [rotation, setRotation] = useState<ScreenRotation>(screen.rotation || "standard");
  const [name, setName] = useState(screen.name);
  const [playlist, setPlaylist] = useState(screen.default_playlist_id || "");
  const [busy, setBusy] = useState(false);
  const [reloadBusy, setReloadBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null);

  const toggle = (key: string) => setSettings((s) => ({ ...s, widgets: { ...s.widgets, [key]: !s.widgets[key] } }));
  const setWeatherName = (value: string) => setSettings((current) => ({
    ...current,
    weather_location: value.trim()
      ? { name: value, latitude: null, longitude: null }
      : null,
  }));
  const toggleNewsCategory = (category: string) => setSettings((current) => ({
    ...current,
    news_categories: current.news_categories.includes(category)
      ? current.news_categories.filter((item) => item !== category)
      : [...current.news_categories, category],
  }));

  const save = async () => {
    if (settings.widgets.weather && !String(settings.weather_location?.name || "").trim()) {
      setError("Informe a cidade usada pelo widget de clima.");
      return;
    }
    if (settings.widgets.news && settings.news_categories.length === 0) {
      setError("Selecione pelo menos uma categoria de notícias.");
      return;
    }
    setBusy(true);
    setError(null);
    setMaintenanceMessage(null);
    const [a, b] = await Promise.all([
      supabase.from("screen_settings").update({
        layout_mode: settings.layout_mode,
        side_position: settings.side_position,
        bar_position: settings.bar_position,
        widgets: settings.widgets,
        weather_location: settings.weather_location,
        news_categories: settings.news_categories,
        transition: settings.transition,
        image_duration_seconds: settings.image_duration_seconds,
        operating_hours: settings.operating_hours,
      }).eq("screen_id", screen.id),
      supabase.from("screens").update({
        name,
        orientation,
        rotation,
        default_playlist_id: playlist || null,
        settings_revision: screen.settings_revision + 1,
      }).eq("id", screen.id),
    ]);
    setBusy(false);
    if (a.error || b.error) setError(a.error?.message || b.error?.message || "Não foi possível salvar.");
    else onSaved();
  };

  const requestReload = async () => {
    if (!confirm(`Limpar o cache e recarregar o Player “${screen.name}”? A reprodução será interrompida por alguns segundos.`)) return;
    setReloadBusy(true);
    setError(null);
    setMaintenanceMessage(null);
    const result = await supabase.rpc("request_player_reload", { p_screen_id: screen.id });
    setReloadBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setMaintenanceMessage("Comando enviado. O Player limpará o cache e recarregará automaticamente em até 15 segundos.");
  };

  return (
    <div className="screen-config">
      <div className="config-top">
        <button className="btn secondary" onClick={onBack}>← Voltar</button>
        <div><small>CONFIGURAÇÃO DA TELA</small><h2>{screen.name}</h2></div>
        <AsyncButton busy={busy} className="btn primary" onClick={() => void save()}><Save /> Salvar configuração</AsyncButton>
      </div>
      <FormMessage error={error} success={maintenanceMessage} />
      <div className="config-grid">
        <section className="panel config-controls">
          <label>Nome da tela<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>
            Playlist padrão
            <select value={playlist} onChange={(e) => setPlaylist(e.target.value)}>
              <option value="">Sem playlist</option>
              {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>

          <h3>Orientação da tela</h3>
          <div className="layout-choice">
            <button className={orientation === "landscape" ? "layout-option active-option" : "layout-option"} onClick={() => setOrientation("landscape")}>
              <Monitor /><b>Horizontal</b><small>Formato 16:9 para TVs convencionais.</small>
            </button>
            <button className={orientation === "portrait" ? "layout-option active-option" : "layout-option"} onClick={() => setOrientation("portrait")}>
              <Monitor style={{ transform: "rotate(90deg)" }} /><b>Vertical</b><small>Formato 9:16 para telas em retrato.</small>
            </button>
          </div>

          <h3>Rotação da imagem</h3>
          <label>
            Rotação
            <select value={rotation} onChange={(event) => setRotation(event.target.value as ScreenRotation)}>
              <option value="standard">Padrão</option>
              <option value="right">Girar 90° à direita</option>
              <option value="left">Girar 90° à esquerda</option>
              <option value="180">Girar 180°</option>
            </select>
            <small style={{ display: "block", marginTop: 7, lineHeight: 1.5 }}>
              Use esta opção quando a TV estiver instalada fisicamente girada. A orientação define o formato do conteúdo; a rotação define como ele é virado no display.
            </small>
          </label>

          <h3>Modo de exibição</h3>
          <div className="layout-choice">
            <button className={settings.layout_mode === "fullscreen" ? "layout-option active-option" : "layout-option"} onClick={() => setSettings((s) => ({ ...s, layout_mode: "fullscreen" }))}>
              <Monitor /><b>Tela cheia</b><small>Conteúdo ocupa toda a tela.</small>
            </button>
            <button className={settings.layout_mode === "lframe" ? "layout-option active-option" : "layout-option"} onClick={() => setSettings((s) => ({ ...s, layout_mode: "lframe" }))}>
              <PanelRight /><b>Moldura em L</b><small>Conteúdo com áreas informativas.</small>
            </button>
          </div>

          {settings.layout_mode === "lframe" && (
            <>
              <h3>Posição</h3>
              <div className="segmented">
                <button className={settings.side_position === "left" ? "selected" : ""} onClick={() => setSettings((s) => ({ ...s, side_position: "left" }))}>Coluna esquerda</button>
                <button className={settings.side_position === "right" ? "selected" : ""} onClick={() => setSettings((s) => ({ ...s, side_position: "right" }))}>Coluna direita</button>
              </div>
              <div className="segmented">
                <button className={settings.bar_position === "top" ? "selected" : ""} onClick={() => setSettings((s) => ({ ...s, bar_position: "top" }))}><PanelTop /> Faixa superior</button>
                <button className={settings.bar_position === "bottom" ? "selected" : ""} onClick={() => setSettings((s) => ({ ...s, bar_position: "bottom" }))}><PanelBottom /> Faixa inferior</button>
              </div>

              <h3>Widgets</h3>
              <div className="widget-list">
                <Widget icon={Clock3} label="Relógio e data" checked={settings.widgets.clock} onClick={() => toggle("clock")} />
                <Widget icon={CloudSun} label="Clima" checked={settings.widgets.weather} onClick={() => toggle("weather")} />
                <Widget icon={Newspaper} label="Notícias" checked={settings.widgets.news} onClick={() => toggle("news")} />
                <Widget icon={MessageSquareText} label="Mensagens programadas" checked={settings.widgets.messages} onClick={() => toggle("messages")} />
                <Widget icon={Building2} label="Informações do estabelecimento" checked={settings.widgets.business} onClick={() => toggle("business")} />
              </div>

              {settings.widgets.weather && (
                <div className="widget-config">
                  <label>
                    Cidade do clima
                    <input
                      value={String(settings.weather_location?.name || "")}
                      onChange={(event) => setWeatherName(event.target.value)}
                      placeholder="Ex.: Colatina, ES"
                    />
                  </label>
                  <small style={{ display: "block", marginTop: 8, lineHeight: 1.5 }}>
                    A PontoView localiza automaticamente a cidade e valida as coordenadas antes de consultar o Open-Meteo. Não é necessário preencher latitude ou longitude.
                  </small>
                </div>
              )}

              {settings.widgets.news && (
                <div className="widget-config">
                  <small>CATEGORIAS DE NOTÍCIAS</small>
                  <div className="weekday-picker">
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
                  <small style={{ display: "block", marginTop: 8, lineHeight: 1.5 }}>
                    As notícias usam a mesma central PontoView dos painéis automáticos, com cache e classificação por categoria.
                  </small>
                </div>
              )}
            </>
          )}

          <h3>Manutenção do Player</h3>
          <div className="widget-config">
            <small style={{ display: "block", marginBottom: 10, lineHeight: 1.5 }}>
              Use esta opção se uma TV mantiver conteúdo ou configurações antigas. O comando preserva o pareamento da tela.
            </small>
            <AsyncButton busy={reloadBusy} className="btn secondary full" onClick={() => void requestReload()}>
              <RefreshCw /> Limpar cache e recarregar Player
            </AsyncButton>
          </div>

          <button className="btn danger full disconnect" onClick={onDeactivate}><Power /> Desconectar Player</button>
        </section>

        <section className="panel preview-config">
          <div className="preview-label">
            <span>PRÉ-VISUALIZAÇÃO · {orientation === "portrait" ? "9:16" : "16:9"}</span>
            <small>{rotationLabels[rotation]} · {playlists.find((p) => p.id === playlist)?.name || "Sem playlist"}</small>
          </div>
          <ScreenPreview settings={settings} orientation={orientation} />
          <div className="preview-note"><ShieldCheck /><span>A orientação define o formato lógico e a rotação corrige a montagem física da TV. A playlist continua sendo exibida integralmente.</span></div>
        </section>
      </div>
    </div>
  );
}

function Widget({ icon: Icon, label, checked, onClick }: { icon: typeof Clock3; label: string; checked?: boolean; onClick: () => void }) {
  return (
    <button className="widget-toggle" onClick={onClick}>
      <Icon /><span>{label}</span><i className={checked ? "switch on" : "switch"}><b /></i>
    </button>
  );
}

function ScreenPreview({ settings, orientation }: { settings: ScreenSettings; orientation: "landscape" | "portrait" }) {
  const style = {
    aspectRatio: orientation === "portrait" ? "9 / 16" : "16 / 9",
    width: orientation === "portrait" ? "min(100%, 360px)" : "100%",
    marginInline: "auto",
  } as const;
  if (settings.layout_mode === "fullscreen") return (
    <div className="frame-preview fullscreen-preview" style={style}>
      <div className="main-media"><Play /><b>Conteúdo da playlist</b><small>Vídeos · Imagens · Apps · YouTube</small></div>
    </div>
  );
  return (
    <div className={`frame-preview l-preview side-${settings.side_position} bar-${settings.bar_position}`} style={style}>
      <div className="main-media"><Play /><b>Conteúdo principal</b><small>Playlist PontoView</small></div>
      <aside className="frame-side">
        {settings.widgets.clock && <div className="clock-widget"><b>13:06</b><small>SEX · 28 AGO</small></div>}
        {settings.widgets.weather && <div className="weather-widget"><CloudSun /><span><b>26°</b><small>{String(settings.weather_location?.name || "Sua cidade")}</small></span></div>}
        {settings.widgets.business && <div className="business-widget"><Building2 /><small>Sua empresa</small></div>}
      </aside>
      <div className="frame-bar">
        {settings.widgets.news && <span><b>AGORA</b> Notícias e informações atualizadas</span>}
        {settings.widgets.messages && <span>• Mensagem programada da empresa</span>}
      </div>
    </div>
  );
}

function readPairError(message: string) {
  if (message.includes("CODE_NOT_FOUND")) return "Código inválido ou expirado. Gere um novo código no Player.";
  if (message.includes("SCREEN_LIMIT")) return "O limite de telas do plano foi atingido.";
  if (message.includes("SUBSCRIPTION")) return "A assinatura precisa estar ativa para conectar uma nova tela.";
  return message;
}
