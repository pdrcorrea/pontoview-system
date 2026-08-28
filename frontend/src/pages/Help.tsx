import { useMemo, useState } from "react";
import {
  BookOpen,
  CalendarClock,
  ChevronRight,
  Cloud,
  Clock3,
  ListVideo,
  MenuSquare,
  MessageSquareText,
  Monitor,
  Newspaper,
  PanelRight,
  Search,
  Sparkles,
  Youtube,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { PageHead } from "../components/ui";
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

const apps = [
  ["clock", "Relógio", "Hora e data com leitura rápida.", Clock3, false],
  [
    "weather",
    "Previsão do tempo",
    "Clima com cache centralizado.",
    Cloud,
    false,
  ],
  ["news", "Notícias", "Conteúdo normalizado por categoria.", Newspaper, true],
  [
    "menu_board",
    "Menu Board",
    "Cardápios digitais responsivos.",
    MenuSquare,
    false,
  ],
  [
    "messages",
    "Comunicados",
    "Avisos internos e mensagens.",
    MessageSquareText,
    false,
  ],
  ["busboard", "BusBoard", "Horários de partidas e chegadas.", Monitor, true],
] as const;
export function AppsPage() {
  const { organization, user } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const add = async (app: (typeof apps)[number]) => {
    if (!organization || !user) return;
    const result = await supabase
      .from("media")
      .insert({
        organization_id: organization.id,
        type: "app",
        name: app[1],
        app_key: app[0],
        duration_seconds: 30,
        online_required: app[4],
        created_by: user.id,
      });
    setMessage(
      result.error
        ? result.error.message
        : `${app[1]} adicionado à biblioteca.`,
    );
  };
  return (
    <>
      <PageHead
        eyebrow="Conteúdo dinâmico"
        title="Apps PontoView"
        text="Painéis prontos para playlists ou para as áreas da Moldura em L."
      />
      {message && <div className="form-message success">{message}</div>}
      <div className="apps-grid">
        {apps.map((app) => {
          const Icon = app[3];
          return (
            <article className="app-card" key={app[0]}>
              <span className="app-icon">
                <Icon />
              </span>
              <h2>{app[1]}</h2>
              <p>{app[2]}</p>
              <button
                className="btn secondary full"
                onClick={() => void add(app)}
              >
                <Sparkles />
                Adicionar à biblioteca
              </button>
            </article>
          );
        })}
      </div>
    </>
  );
}
