import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  Building2,
  Check,
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
  Save,
  ShieldCheck,
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
import { supabase } from "../lib/supabase";
import type { Playlist, Screen, ScreenSettings, ScreenStatus } from "../types";

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
};

export function ScreensPage() {
  const { organization } = useAuth();
  const [params, setParams] = useSearchParams();
  const [screens, setScreens] = useState<Screen[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selected, setSelected] = useState<Screen | null>(null);
  const [pairing, setPairing] = useState(params.get("parear") === "1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!organization) return;
    const [s, p] = await Promise.all([
      supabase
        .from("screens")
        .select(
          "id,organization_id,name,slug,orientation,default_playlist_id,is_active,settings_revision,screen_status(last_seen,current_media_id,current_playlist_id,player_version,screenshot_url,screenshot_at),screen_settings(*)",
        )
        .eq("organization_id", organization.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("playlists")
        .select("*")
        .eq("organization_id", organization.id)
        .order("name"),
    ]);
    if (s.error) setError(s.error.message);
    else setScreens((s.data || []) as unknown as Screen[]);
    if (p.data) setPlaylists(p.data as Playlist[]);
  }, [organization]);
  useEffect(() => {
    void load();
    if (!organization) return;
    const channel = supabase
      .channel(`screens:${organization.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "screen_status",
          filter: `organization_id=eq.${organization.id}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
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
    else {
      closePair();
      await load();
    }
  };
  const deactivate = async (screen: Screen) => {
    if (
      !confirm(
        `Desconectar “${screen.name}”? O Player precisará ser pareado novamente.`,
      )
    )
      return;
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
          onSaved={async () => {
            setSelected(null);
            await load();
          }}
          onDeactivate={() => void deactivate(selected)}
        />
      ) : screens.length ? (
        <div className="device-grid">
          {screens.map((screen) => (
            <ScreenCard
              key={screen.id}
              screen={screen}
              onManage={() => setSelected(screen)}
            />
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
      {pairing && (
        <Modal
          eyebrow="PAREAR PLAYER"
          title="Conectar uma tela"
          onClose={closePair}
        >
          <form className="youtube-form pairing-form" onSubmit={pair}>
            <div className="pair-help">
              <Monitor />
              <span>
                <b>Abra {window.location.origin}/player na TV</b>
                <small>
                  O Player mostrará um código temporário de 6 dígitos.
                </small>
              </span>
            </div>
            <label>
              Código da TV
              <input
                name="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                className="pair-code"
                placeholder="000000"
              />
            </label>
            <label>
              Nome da tela
              <input
                name="name"
                required
                placeholder="Ex.: Recepção principal"
              />
            </label>
            <FormMessage error={error} />
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={closePair}
              >
                Cancelar
              </button>
              <AsyncButton busy={busy} className="btn primary">
                Conectar tela
              </AsyncButton>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function ScreenCard({
  screen,
  onManage,
}: {
  screen: Screen;
  onManage: () => void;
}) {
  const rawStatus = screen.screen_status;
  const status = (
    Array.isArray(rawStatus) ? rawStatus[0] : rawStatus
  ) as ScreenStatus | null;
  const rawSettings = screen.screen_settings;
  const settings = (
    Array.isArray(rawSettings) ? rawSettings[0] : rawSettings
  ) as ScreenSettings | undefined;
  const online = Boolean(
    status?.last_seen &&
      Date.now() - new Date(status.last_seen).getTime() < 90000,
  );
  return (
    <article className="device-card">
      <div className="tv-preview detailed">
        {status?.screenshot_url ? (
          <img
            src={status.screenshot_url}
            alt={`Última captura de ${screen.name}`}
          />
        ) : settings?.layout_mode === "lframe" ? (
          <div className="tiny-layout">
            <div className="tiny-content" />
            <div className="tiny-side" />
            <div className="tiny-ticker" />
          </div>
        ) : (
          <div className="tiny-full">
            <Play />
          </div>
        )}
      </div>
      <div className="device-head">
        <div>
          <h2>{screen.name}</h2>
          <p>
            {settings?.layout_mode === "lframe" ? "Moldura em L" : "Tela cheia"}
          </p>
        </div>
        <span className={online ? "status active" : "status offline-status"}>
          {online ? <Wifi /> : <WifiOff />}
          {online ? " Online" : " Offline"}
        </span>
      </div>
      <dl>
        <div>
          <dt>Última comunicação</dt>
          <dd>{timeAgo(status?.last_seen)}</dd>
        </div>
        <div>
          <dt>Player</dt>
          <dd>{status?.player_version || "—"}</dd>
        </div>
      </dl>
      <button className="btn secondary full" onClick={onManage}>
        Gerenciar tela
      </button>
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
  const initial = (Array.isArray(raw) ? raw[0] : raw) as
    | ScreenSettings
    | undefined;
  const [settings, setSettings] = useState<ScreenSettings>({
    ...defaultSettings,
    ...initial,
    widgets: { ...defaultSettings.widgets, ...initial?.widgets },
  });
  const [name, setName] = useState(screen.name);
  const [playlist, setPlaylist] = useState(screen.default_playlist_id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (key: string) =>
    setSettings((s) => ({
      ...s,
      widgets: { ...s.widgets, [key]: !s.widgets[key] },
    }));
  const setWeatherField = (
    key: "name" | "latitude" | "longitude",
    value: string,
  ) =>
    setSettings((current) => ({
      ...current,
      weather_location: {
        ...(current.weather_location || {}),
        [key]: key === "name" ? value : value === "" ? null : Number(value),
      },
    }));
  const toggleNewsCategory = (category: string) =>
    setSettings((current) => ({
      ...current,
      news_categories: current.news_categories.includes(category)
        ? current.news_categories.filter((item) => item !== category)
        : [...current.news_categories, category],
    }));
  const save = async () => {
    setBusy(true);
    setError(null);
    const [a, b] = await Promise.all([
      supabase
        .from("screen_settings")
        .update({
          layout_mode: settings.layout_mode,
          side_position: settings.side_position,
          bar_position: settings.bar_position,
          widgets: settings.widgets,
          weather_location: settings.weather_location,
          news_categories: settings.news_categories,
          transition: settings.transition,
          image_duration_seconds: settings.image_duration_seconds,
        })
        .eq("screen_id", screen.id),
      supabase
        .from("screens")
        .update({
          name,
          default_playlist_id: playlist || null,
          settings_revision: screen.settings_revision + 1,
        })
        .eq("id", screen.id),
    ]);
    setBusy(false);
    if (a.error || b.error)
      setError(
        a.error?.message || b.error?.message || "Não foi possível salvar.",
      );
    else onSaved();
  };
  return (
    <div className="screen-config">
      <div className="config-top">
        <button className="btn secondary" onClick={onBack}>
          ← Voltar
        </button>
        <div>
          <small>CONFIGURAÇÃO DA TELA</small>
          <h2>{screen.name}</h2>
        </div>
        <AsyncButton
          busy={busy}
          className="btn primary"
          onClick={() => void save()}
        >
          <Save />
          Salvar configuração
        </AsyncButton>
      </div>
      <FormMessage error={error} />
      <div className="config-grid">
        <section className="panel config-controls">
          <label>
            Nome da tela
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Playlist padrão
            <select
              value={playlist}
              onChange={(e) => setPlaylist(e.target.value)}
            >
              <option value="">Sem playlist</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <h3>Modo de exibição</h3>
          <div className="layout-choice">
            <button
              className={
                settings.layout_mode === "fullscreen"
                  ? "layout-option active-option"
                  : "layout-option"
              }
              onClick={() =>
                setSettings((s) => ({ ...s, layout_mode: "fullscreen" }))
              }
            >
              <Monitor />
              <b>Tela cheia</b>
              <small>Conteúdo ocupa toda a tela.</small>
            </button>
            <button
              className={
                settings.layout_mode === "lframe"
                  ? "layout-option active-option"
                  : "layout-option"
              }
              onClick={() =>
                setSettings((s) => ({ ...s, layout_mode: "lframe" }))
              }
            >
              <PanelRight />
              <b>Moldura em L</b>
              <small>Conteúdo com áreas informativas.</small>
            </button>
          </div>
          {settings.layout_mode === "lframe" && (
            <>
              <h3>Posição</h3>
              <div className="segmented">
                <button
                  className={
                    settings.side_position === "left" ? "selected" : ""
                  }
                  onClick={() =>
                    setSettings((s) => ({ ...s, side_position: "left" }))
                  }
                >
                  Coluna esquerda
                </button>
                <button
                  className={
                    settings.side_position === "right" ? "selected" : ""
                  }
                  onClick={() =>
                    setSettings((s) => ({ ...s, side_position: "right" }))
                  }
                >
                  Coluna direita
                </button>
              </div>
              <div className="segmented">
                <button
                  className={settings.bar_position === "top" ? "selected" : ""}
                  onClick={() =>
                    setSettings((s) => ({ ...s, bar_position: "top" }))
                  }
                >
                  <PanelTop /> Faixa superior
                </button>
                <button
                  className={
                    settings.bar_position === "bottom" ? "selected" : ""
                  }
                  onClick={() =>
                    setSettings((s) => ({ ...s, bar_position: "bottom" }))
                  }
                >
                  <PanelBottom /> Faixa inferior
                </button>
              </div>
              <h3>Widgets</h3>
              <div className="widget-list">
                <Widget
                  icon={Clock3}
                  label="Relógio e data"
                  checked={settings.widgets.clock}
                  onClick={() => toggle("clock")}
                />
                <Widget
                  icon={CloudSun}
                  label="Clima"
                  checked={settings.widgets.weather}
                  onClick={() => toggle("weather")}
                />
                <Widget
                  icon={Newspaper}
                  label="Notícias"
                  checked={settings.widgets.news}
                  onClick={() => toggle("news")}
                />
                <Widget
                  icon={MessageSquareText}
                  label="Mensagens programadas"
                  checked={settings.widgets.messages}
                  onClick={() => toggle("messages")}
                />
                <Widget
                  icon={Building2}
                  label="Informações do estabelecimento"
                  checked={settings.widgets.business}
                  onClick={() => toggle("business")}
                />
              </div>
              {settings.widgets.weather && (
                <div className="widget-config">
                  <label>
                    Cidade do clima
                    <input
                      value={String(settings.weather_location?.name || "")}
                      onChange={(event) =>
                        setWeatherField("name", event.target.value)
                      }
                      placeholder="Ex.: Colatina · ES"
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      Latitude
                      <input
                        type="number"
                        step="0.0001"
                        value={String(
                          settings.weather_location?.latitude ?? "",
                        )}
                        onChange={(event) =>
                          setWeatherField("latitude", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Longitude
                      <input
                        type="number"
                        step="0.0001"
                        value={String(
                          settings.weather_location?.longitude ?? "",
                        )}
                        onChange={(event) =>
                          setWeatherField("longitude", event.target.value)
                        }
                      />
                    </label>
                  </div>
                </div>
              )}
              {settings.widgets.news && (
                <div className="widget-config">
                  <small>CATEGORIAS DE NOTÍCIAS</small>
                  <div className="weekday-picker">
                    {[
                      ["general", "Geral"],
                      ["economy", "Economia"],
                      ["sports", "Esportes"],
                      ["technology", "Tecnologia"],
                      ["health", "Saúde"],
                      ["local", "Local"],
                    ].map(([id, label]) => (
                      <label key={id}>
                        <input
                          type="checkbox"
                          checked={settings.news_categories.includes(id)}
                          onChange={() => toggleNewsCategory(id)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <button className="btn danger full disconnect" onClick={onDeactivate}>
            <Power />
            Desconectar Player
          </button>
        </section>
        <section className="panel preview-config">
          <div className="preview-label">
            <span>PRÉ-VISUALIZAÇÃO · 16:9</span>
            <small>
              {playlists.find((p) => p.id === playlist)?.name || "Sem playlist"}
            </small>
          </div>
          <ScreenPreview settings={settings} />
          <div className="preview-note">
            <ShieldCheck />
            <span>
              A moldura pertence à tela e não duplica a playlist. O conteúdo
              principal permanece íntegro.
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
function Widget({
  icon: Icon,
  label,
  checked,
  onClick,
}: {
  icon: typeof Clock3;
  label: string;
  checked?: boolean;
  onClick: () => void;
}) {
  return (
    <button className="widget-toggle" onClick={onClick}>
      <Icon />
      <span>{label}</span>
      <i className={checked ? "switch on" : "switch"}>
        <b />
      </i>
    </button>
  );
}
function ScreenPreview({ settings }: { settings: ScreenSettings }) {
  if (settings.layout_mode === "fullscreen")
    return (
      <div className="frame-preview fullscreen-preview">
        <div className="main-media">
          <Play />
          <b>Conteúdo da playlist</b>
          <small>Vídeos · Imagens · Apps · YouTube</small>
        </div>
      </div>
    );
  return (
    <div
      className={`frame-preview l-preview side-${settings.side_position} bar-${settings.bar_position}`}
    >
      <div className="main-media">
        <Play />
        <b>Conteúdo principal</b>
        <small>Playlist PontoView</small>
      </div>
      <aside className="frame-side">
        {settings.widgets.clock && (
          <div className="clock-widget">
            <b>13:06</b>
            <small>SEX · 28 AGO</small>
          </div>
        )}
        {settings.widgets.weather && (
          <div className="weather-widget">
            <CloudSun />
            <span>
              <b>26°</b>
              <small>Colatina · ES</small>
            </span>
          </div>
        )}
        {settings.widgets.business && (
          <div className="business-widget">
            <Building2 />
            <small>Sua empresa</small>
          </div>
        )}
      </aside>
      <div className="frame-bar">
        {settings.widgets.news && (
          <span>
            <b>AGORA</b> Notícias e informações atualizadas
          </span>
        )}
        {settings.widgets.messages && (
          <span>• Mensagem programada da empresa</span>
        )}
      </div>
    </div>
  );
}
function readPairError(message: string) {
  if (message.includes("CODE_NOT_FOUND"))
    return "Código inválido ou expirado. Gere um novo código no Player.";
  if (message.includes("SCREEN_LIMIT"))
    return "O limite de telas do plano foi atingido.";
  if (message.includes("SUBSCRIPTION"))
    return "A assinatura precisa estar ativa para conectar uma nova tela.";
  return message;
}
