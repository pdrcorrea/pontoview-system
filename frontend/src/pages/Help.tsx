import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeDollarSign,
  BookOpen,
  Calendar,
  CalendarClock,
  Check,
  ChevronRight,
  Cloud,
  Clock3,
  Eye,
  HeartPulse,
  Leaf,
  Lightbulb,
  ListVideo,
  MessageSquareText,
  Monitor,
  Newspaper,
  PanelRight,
  Search,
  Smile,
  Sparkles,
  Youtube,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { Modal, PageHead } from "../components/ui";
import { supabase } from "../lib/supabase";

const guides: Array<[string, string, LucideIcon]> = [
  [
    "Primeiros passos",
    "Conta, conteúdo, playlist, programação e primeira tela.",
    BookOpen,
  ],
  [
    "Conectar uma tela",
    "Abra /player na TV e informe o código de 6 dígitos.",
    Monitor,
  ],
  [
    "Google Drive",
    "Autorize a conta e selecione arquivos sem criar cópias permanentes.",
    Cloud,
  ],
  [
    "Vídeos do YouTube",
    "Aceita watch, youtu.be, Shorts e live quando incorporável.",
    Youtube,
  ],
  [
    "Criar playlists",
    "Ordene itens, ajuste duração e misture diferentes fontes.",
    ListVideo,
  ],
  [
    "Programação automática",
    "Campanhas vencem horários, que vencem a playlist padrão.",
    CalendarClock,
  ],
  [
    "Moldura em L",
    "Configure coluna, faixa e widgets separadamente por tela.",
    PanelRight,
  ],
  [
    "Operação offline",
    "O Player conserva manifesto e arquivos já sincronizados.",
    Clock3,
  ],
];

export function HelpPage() {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () =>
      guides.filter(([a, b]) =>
        (a + " " + b).toLowerCase().includes(q.toLowerCase()),
      ),
    [q],
  );
  return (
    <>
      <div className="help-hero">
        <small>CENTRAL DE AJUDA</small>
        <h1>Como podemos ajudar?</h1>
        <p>Guias rápidos, sem termos técnicos desnecessários.</p>
        <label className="search">
          <Search />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar na ajuda…"
          />
        </label>
      </div>
      <section className="how">
        <div className="section-head">
          <small>COMO FUNCIONA</small>
          <h2>Do seu Drive ou YouTube para qualquer tela.</h2>
        </div>
        <div className="flow">
          <article>
            <Cloud />
            <h3>Conecte</h3>
            <p>Escolha suas fontes.</p>
          </article>
          <ChevronRight />
          <article>
            <ListVideo />
            <h3>Organize</h3>
            <p>Monte playlists.</p>
          </article>
          <ChevronRight />
          <article>
            <CalendarClock />
            <h3>Programe</h3>
            <p>Defina horários.</p>
          </article>
          <ChevronRight />
          <article>
            <Monitor />
            <h3>Exiba</h3>
            <p>Pareie o Player.</p>
          </article>
        </div>
      </section>
      <div className="help-grid">
        {filtered.map(([title, text, Icon]) => (
          <article className="help-card" key={title}>
            <span>
              <Icon />
            </span>
            <div>
              <h2>{title}</h2>
              <p>{text}</p>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

type PanelApp = {
  key: string;
  title: string;
  description: string;
  slug: string;
  icon: LucideIcon;
  duration: number;
  category: string;
};

const apps: PanelApp[] = [
  {
    key: "today",
    title: "Hoje",
    description: "Data, feriados, estação do ano e calendário em uma tela elegante.",
    slug: "hoje",
    icon: Calendar,
    duration: 25,
    category: "Utilidades",
  },
  {
    key: "greetings",
    title: "Saudações",
    description: "Bom dia, boa tarde, boa noite e boas-vindas com visual dinâmico.",
    slug: "saudacoes",
    icon: Smile,
    duration: 18,
    category: "Ambiente",
  },
  {
    key: "clock",
    title: "Hora Exata",
    description: "Relógio em destaque, data e localização aproximada.",
    slug: "hora",
    icon: Clock3,
    duration: 20,
    category: "Utilidades",
  },
  {
    key: "weather",
    title: "Previsão do Tempo",
    description: "Condição atual, sensação térmica e previsão para os próximos dias.",
    slug: "tempo",
    icon: Cloud,
    duration: 28,
    category: "Informação",
  },
  {
    key: "news",
    title: "Notícias",
    description: "Notícias com imagem, fonte e QR Code em layout próprio para TV.",
    slug: "noticias",
    icon: Newspaper,
    duration: 32,
    category: "Informação",
  },
  {
    key: "health",
    title: "Dicas de Saúde",
    description: "Conteúdo curto de saúde e bem-estar, renovado a cada atualização.",
    slug: "saude",
    icon: HeartPulse,
    duration: 28,
    category: "Bem-estar",
  },
  {
    key: "guidance",
    title: "Orientações",
    description: "Mensagens úteis de atendimento, segurança e boa convivência.",
    slug: "orientacoes",
    icon: MessageSquareText,
    duration: 24,
    category: "Ambiente",
  },
  {
    key: "curiosities",
    title: "Curiosidades",
    description: "Temas interessantes em páginas automáticas com tempo confortável de leitura.",
    slug: "curiosidades",
    icon: Lightbulb,
    duration: 76,
    category: "Editorial",
  },
  {
    key: "culture",
    title: "Cultura",
    description: "Arte, música, literatura e patrimônio em uma experiência editorial paginada.",
    slug: "cultura",
    icon: BookOpen,
    duration: 82,
    category: "Editorial",
  },
  {
    key: "economy",
    title: "Economia",
    description: "Dólar, euro, Bitcoin, Selic e IPCA com destaques visuais e indicadores.",
    slug: "economia",
    icon: BadgeDollarSign,
    duration: 30,
    category: "Indicadores",
  },
  {
    key: "sustainability",
    title: "Sustentabilidade",
    description: "Energia, renováveis, florestas e emissões apresentados de forma visual.",
    slug: "sustentabilidade",
    icon: Leaf,
    duration: 30,
    category: "Indicadores",
  },
];

function panelUrl(slug: string) {
  return `${window.location.origin}/paineis/${slug}/`;
}

export function AppsPage() {
  const { organization, user } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<PanelApp | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(() => new Set());
  const inFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!organization) {
      setAddedKeys(new Set());
      return;
    }
    let active = true;
    const urls = apps.map((app) => panelUrl(app.slug));
    void supabase
      .from("media")
      .select("page_url,status")
      .eq("organization_id", organization.id)
      .eq("type", "webpage")
      .in("page_url", urls)
      .neq("status", "archived")
      .then(({ data }) => {
        if (!active) return;
        const existingUrls = new Set(
          (data || []).map((row) => String(row.page_url || "")),
        );
        setAddedKeys(
          new Set(
            apps
              .filter((app) => existingUrls.has(panelUrl(app.slug)))
              .map((app) => app.key),
          ),
        );
      });
    return () => {
      active = false;
    };
  }, [organization]);

  const add = async (app: PanelApp) => {
    if (!organization || !user || inFlight.current.has(app.key)) return;
    if (addedKeys.has(app.key)) {
      setMessage(`${app.title} já está na sua biblioteca.`);
      return;
    }

    inFlight.current.add(app.key);
    setBusyKey(app.key);
    setMessage(null);
    const url = panelUrl(app.slug);

    try {
      const activeResult = await supabase
        .from("media")
        .select("id,status")
        .eq("organization_id", organization.id)
        .eq("type", "webpage")
        .eq("page_url", url)
        .neq("status", "archived")
        .limit(1)
        .maybeSingle();
      if (activeResult.error) throw activeResult.error;

      if (activeResult.data) {
        setAddedKeys((current) => new Set(current).add(app.key));
        setMessage(`${app.title} já está na sua biblioteca.`);
        return;
      }

      const archivedResult = await supabase
        .from("media")
        .select("id")
        .eq("organization_id", organization.id)
        .eq("type", "webpage")
        .eq("page_url", url)
        .eq("status", "archived")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (archivedResult.error) throw archivedResult.error;

      const payload = {
        organization_id: organization.id,
        type: "webpage" as const,
        name: app.title,
        page_url: url,
        duration_seconds: app.duration,
        online_required: false,
        status: "ready",
        created_by: user.id,
      };

      const result = archivedResult.data?.id
        ? await supabase
            .from("media")
            .update(payload)
            .eq("id", archivedResult.data.id)
        : await supabase.from("media").insert(payload);
      if (result.error) throw result.error;

      setAddedKeys((current) => new Set(current).add(app.key));
      setMessage(`${app.title} adicionado à sua biblioteca.`);
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Não foi possível adicionar este painel.",
      );
    } finally {
      inFlight.current.delete(app.key);
      setBusyKey(null);
    }
  };

  return (
    <>
      <PageHead
        eyebrow="Conteúdo PontoView"
        title="Painéis Automáticos"
        text="Conteúdos prontos para TV, com atualização inteligente, leitura confortável e visual PontoView. Visualize antes de adicionar à biblioteca."
      />
      {message && <div className="form-message success">{message}</div>}
      <div className="apps-grid pv-panel-catalog">
        {apps.map((app) => {
          const Icon = app.icon;
          const isAdded = addedKeys.has(app.key);
          return (
            <article className="app-card pv-panel-card" key={app.key}>
              <div className="pv-panel-card-top">
                <span className="app-icon">
                  <Icon />
                </span>
                <small className="pv-panel-category">{app.category}</small>
              </div>
              <h2>{app.title}</h2>
              <p>{app.description}</p>
              <div className="pv-panel-meta">
                <span>{app.duration}s na playlist</span>
                <span>Responsivo 16:9 / 9:16</span>
              </div>
              <div className="pv-panel-actions">
                <button
                  className="btn tertiary"
                  onClick={() => setPreview(app)}
                >
                  <Eye />
                  Visualizar
                </button>
                <button
                  className="btn secondary"
                  disabled={busyKey !== null || isAdded}
                  onClick={() => void add(app)}
                >
                  {isAdded ? <Check /> : <Sparkles />}
                  {isAdded
                    ? "Adicionado"
                    : busyKey === app.key
                      ? "Adicionando…"
                      : "Adicionar"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {preview && (
        <Modal
          eyebrow="PRÉ-VISUALIZAÇÃO DO PAINEL"
          title={preview.title}
          onClose={() => setPreview(null)}
        >
          <div className="pv-panel-preview">
            <iframe
              key={preview.key}
              src={panelUrl(preview.slug)}
              title={`Pré-visualização: ${preview.title}`}
              allow="fullscreen"
            />
          </div>
          <div className="pv-panel-preview-footer">
            <span>{preview.description}</span>
            <button
              className="btn primary"
              disabled={busyKey !== null || addedKeys.has(preview.key)}
              onClick={() => void add(preview)}
            >
              {addedKeys.has(preview.key) ? <Check /> : <Sparkles />}
              {addedKeys.has(preview.key)
                ? "Já adicionado"
                : busyKey === preview.key
                  ? "Adicionando…"
                  : "Adicionar à biblioteca"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}