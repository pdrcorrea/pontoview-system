import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeDollarSign,
  BookOpen,
  Calendar,
  CalendarClock,
  Check,
  ChevronRight,
  Cloud,
  Eye,
  HeartPulse,
  Image,
  Leaf,
  Lightbulb,
  ListVideo,
  MessageSquareText,
  Monitor,
  Newspaper,
  PanelRight,
  Search,
  Settings,
  Smile,
  Sparkles,
  Youtube,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { Modal, PageHead } from "../components/ui";
import { supabase } from "../lib/supabase";

type HelpGuide = {
  title: string;
  summary: string;
  intro: string;
  steps: string[];
  icon: LucideIcon;
};

const guides: HelpGuide[] = [
  {
    title: "Primeiros passos",
    summary: "O caminho mais curto entre a conta criada e a primeira TV no ar.",
    intro: "Para colocar a primeira tela em funcionamento, siga esta ordem:",
    steps: [
      "Em Conteúdo, adicione arquivos do Drive, vídeos do YouTube ou Painéis PontoView.",
      "Em Playlists, crie uma sequência e adicione os conteúdos na ordem desejada.",
      "Em Telas, conecte o Player usando o código mostrado na TV e escolha a playlist padrão.",
      "Depois, use Programação apenas quando precisar trocar a playlist automaticamente em determinados horários.",
    ],
    icon: BookOpen,
  },
  {
    title: "Adicionar conteúdo",
    summary: "Imagens, vídeos, páginas, YouTube e painéis prontos entram pela biblioteca.",
    intro: "A biblioteca guarda as referências dos conteúdos usados nas playlists.",
    steps: [
      "Abra Conteúdo e escolha a origem desejada.",
      "No Google Drive, selecione o arquivo sem precisar duplicá-lo dentro da PontoView.",
      "No YouTube, cole o link e revise início, fim, volume e controles.",
      "Para remover um conteúdo, arquive-o somente depois de confirmar que ele não é mais necessário nas playlists.",
    ],
    icon: Image,
  },
  {
    title: "Google Drive",
    summary: "Use os próprios arquivos da empresa sem criar uma segunda biblioteca de mídia.",
    intro: "A PontoView lê os arquivos autorizados no Drive e os prepara para o Player.",
    steps: [
      "Em Minha conta, conecte a conta Google que possui os arquivos.",
      "Em Conteúdo, escolha Google Drive e selecione a imagem ou vídeo.",
      "Evite apagar ou mover o arquivo no Drive enquanto ele estiver em uso.",
      "Se a conexão expirar, volte a Minha conta e reconecte o Google Drive.",
    ],
    icon: Cloud,
  },
  {
    title: "Vídeos do YouTube",
    summary: "Adicione vídeos por link e deixe o Player avançar automaticamente ao final.",
    intro: "Links comuns, youtu.be, Shorts e lives incorporáveis podem ser usados.",
    steps: [
      "Cole o endereço do vídeo em Conteúdo → YouTube.",
      "Defina início ou fim apenas se quiser reproduzir um trecho específico.",
      "O Player avança para o próximo item quando o vídeo realmente termina.",
      "Se o vídeo bloquear incorporação, escolha outro vídeo ou outra fonte de mídia.",
    ],
    icon: Youtube,
  },
  {
    title: "Painéis PontoView",
    summary: "Conteúdos automáticos de notícias, clima, cultura, economia e outras categorias.",
    intro: "Os painéis funcionam como páginas prontas para TV e podem entrar em qualquer playlist.",
    steps: [
      "Abra Painéis PontoView e visualize o painel antes de adicioná-lo.",
      "Clique em Adicionar uma única vez; o sistema evita duplicações na biblioteca.",
      "Depois, coloque o painel em uma playlist como qualquer outro conteúdo.",
      "Os painéis atualizam as informações automaticamente e não precisam de interação na TV.",
    ],
    icon: Sparkles,
  },
  {
    title: "Criar playlists",
    summary: "Organize a ordem de exibição e misture fontes diferentes na mesma sequência.",
    intro: "A playlist é a sequência que o Player percorre continuamente.",
    steps: [
      "Crie uma playlist com um nome fácil de identificar.",
      "Adicione imagens, vídeos, YouTube, páginas ou Painéis PontoView.",
      "Reordene os itens e ajuste a duração dos conteúdos temporizados quando necessário.",
      "Defina a playlist como padrão da tela ou use-a em uma programação.",
    ],
    icon: ListVideo,
  },
  {
    title: "Programação de conteúdo",
    summary: "Troque playlists automaticamente por dia, horário, tela ou grupo.",
    intro: "A programação sobrepõe temporariamente a playlist padrão da tela.",
    steps: [
      "Crie uma programação e selecione a playlist que deverá entrar no ar.",
      "Escolha os dias da semana e o intervalo de horário.",
      "Aponte a regra para uma tela específica ou para um grupo de telas.",
      "Ao fim do período, o Player volta automaticamente para a playlist padrão.",
    ],
    icon: CalendarClock,
  },
  {
    title: "Horário de funcionamento",
    summary: "Faça a tela entrar em repouso fora do período de operação.",
    intro: "O horário de funcionamento é diferente da programação de conteúdo.",
    steps: [
      "Abra Telas → Gerenciar tela.",
      "Ative o horário de funcionamento e selecione os dias em que a tela deve operar.",
      "Defina início e fim; intervalos que atravessam a meia-noite também são aceitos.",
      "Fora desse período o Player exibe preto total e volta sozinho no próximo horário configurado.",
    ],
    icon: Calendar,
  },
  {
    title: "Conectar uma tela",
    summary: "O Player da TV é pareado por código e não precisa de login da conta.",
    intro: "Cada dispositivo recebe uma identificação própria depois do pareamento.",
    steps: [
      "Abra a rota /player no navegador da TV ou mini PC.",
      "Na página Telas, clique em Conectar tela.",
      "Digite o código de 6 dígitos mostrado pelo Player e dê um nome ao dispositivo.",
      "Depois de conectado, o card deve ficar Online e atualizar a última comunicação periodicamente.",
    ],
    icon: Monitor,
  },
  {
    title: "Moldura em L",
    summary: "Exiba conteúdo principal com relógio, clima, notícias, mensagens e identidade da empresa.",
    intro: "A Moldura em L pertence à configuração da tela, não à playlist.",
    steps: [
      "Em Telas → Gerenciar tela, selecione Moldura em L.",
      "Escolha se a coluna ficará à esquerda ou à direita e se a faixa ficará em cima ou embaixo.",
      "Ative apenas os widgets úteis para aquele ambiente.",
      "Use a pré-visualização para conferir a composição antes de salvar.",
    ],
    icon: PanelRight,
  },
  {
    title: "Clima e previsão",
    summary: "Informe a cidade uma vez e deixe a PontoView resolver localização e previsão.",
    intro: "O widget usa a cidade configurada na tela e consulta dados meteorológicos com cache.",
    steps: [
      "Ative Clima nas configurações da Moldura em L.",
      "Informe a cidade no formato Cidade, UF, por exemplo: Colatina, ES.",
      "O Player mostra condição atual e previsão dos próximos dias.",
      "Os ícones mudam automaticamente conforme sol, nuvens, chuva, neblina ou tempestade.",
    ],
    icon: Cloud,
  },
  {
    title: "Notícias",
    summary: "Mostre manchetes com fonte identificada e atualização automática.",
    intro: "As notícias usam a central PontoView e respeitam as categorias escolhidas para a tela.",
    steps: [
      "Ative Notícias na Moldura em L.",
      "Selecione uma ou mais categorias, como Geral, Economia, Esportes, Tecnologia, Saúde ou Local.",
      "O rodapé alterna as manchetes e identifica a fonte com nome e ícone quando disponível.",
      "O cache reduz consultas repetidas e mantém conteúdo recente quando a fonte oscila.",
    ],
    icon: Newspaper,
  },
  {
    title: "Mensagens e avisos",
    summary: "Publique comunicados curtos na faixa informativa da tela.",
    intro: "Mensagens são úteis para avisos internos, orientações e comunicados temporários.",
    steps: [
      "Abra Mensagens e crie o comunicado.",
      "Defina dias e horários em que ele deve aparecer.",
      "Associe a mensagem às telas desejadas quando ela não for geral.",
      "O Player exibe a mensagem com badge de AVISO e retorna às notícias na rotação normal.",
    ],
    icon: MessageSquareText,
  },
  {
    title: "Logo da empresa",
    summary: "Use a identidade do estabelecimento na área informativa do Player.",
    intro: "A logo cadastrada substitui o nome textual da empresa na Moldura em L.",
    steps: [
      "Abra Minha conta → Dados da empresa.",
      "Envie uma imagem PNG, JPG ou WebP de até 2 MB.",
      "Prefira uma versão horizontal, limpa e com fundo transparente.",
      "Depois de salvar, aguarde a próxima sincronização do Player para a nova marca aparecer.",
    ],
    icon: Settings,
  },
  {
    title: "Operação offline",
    summary: "O Player preserva o que já foi sincronizado quando a internet cai.",
    intro: "Nem todo conteúdo consegue funcionar sem internet, mas o Player evita parar completamente.",
    steps: [
      "Arquivos já preparados e armazenados em cache podem continuar sendo exibidos.",
      "YouTube, páginas web e dados ao vivo dependem de conexão e podem ser pulados temporariamente.",
      "Quando a internet retorna, o Player sincroniza novamente sem exigir novo pareamento.",
      "Na página Telas, a última comunicação ajuda a identificar dispositivos realmente desconectados.",
    ],
    icon: Eye,
  },
];

export function HelpPage() {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const query = q.toLowerCase().trim();
    if (!query) return guides;
    return guides.filter((guide) =>
      [guide.title, guide.summary, guide.intro, ...guide.steps].join(" ").toLowerCase().includes(query),
    );
  }, [q]);
  return (
    <>
      <div className="help-hero">
        <small>CENTRAL DE AJUDA</small>
        <h1>Como podemos ajudar?</h1>
        <p>Instruções diretas para configurar, operar e resolver as situações mais comuns do PontoView Telas.</p>
        <label className="search">
          <Search />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por tela, playlist, clima, YouTube…" />
        </label>
      </div>
      <section className="how">
        <div className="section-head">
          <small>FLUXO PRINCIPAL</small>
          <h2>Conteúdo → playlist → tela.</h2>
          <p>Depois disso, programação e widgets entram apenas quando você precisar automatizar ou enriquecer a exibição.</p>
        </div>
        <div className="flow">
          <article><Cloud /><h3>Conecte</h3><p>Escolha suas fontes.</p></article>
          <ChevronRight />
          <article><ListVideo /><h3>Organize</h3><p>Monte playlists.</p></article>
          <ChevronRight />
          <article><CalendarClock /><h3>Programe</h3><p>Defina horários.</p></article>
          <ChevronRight />
          <article><Monitor /><h3>Exiba</h3><p>Pareie o Player.</p></article>
        </div>
      </section>
      <div className="help-grid help-topics">
        {filtered.map((guide) => {
          const Icon = guide.icon;
          return (
            <details className="help-card help-topic" key={guide.title}>
              <summary>
                <span><Icon /></span>
                <div><h2>{guide.title}</h2><p>{guide.summary}</p></div>
                <ChevronRight />
              </summary>
              <div className="help-topic-body">
                <p>{guide.intro}</p>
                <ol>{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol>
              </div>
            </details>
          );
        })}
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
  { key: "today", title: "Hoje", description: "Data, feriados, estação do ano e calendário em uma tela elegante.", slug: "hoje", icon: Calendar, duration: 25, category: "Utilidades" },
  { key: "greetings", title: "Saudações", description: "Bom dia, boa tarde, boa noite e boas-vindas com visual dinâmico.", slug: "saudacoes", icon: Smile, duration: 18, category: "Ambiente" },
  { key: "weather", title: "Previsão do Tempo", description: "Condição atual, sensação térmica e previsão para os próximos dias.", slug: "tempo", icon: Cloud, duration: 28, category: "Informação" },
  { key: "news", title: "Notícias", description: "Notícias com imagem, fonte e QR Code em layout próprio para TV.", slug: "noticias", icon: Newspaper, duration: 32, category: "Informação" },
  { key: "health", title: "Dicas de Saúde", description: "Conteúdo curto de saúde e bem-estar, renovado a cada atualização.", slug: "saude", icon: HeartPulse, duration: 28, category: "Bem-estar" },
  { key: "guidance", title: "Orientações", description: "Mensagens úteis de atendimento, segurança e boa convivência.", slug: "orientacoes", icon: MessageSquareText, duration: 24, category: "Ambiente" },
  { key: "curiosities", title: "Curiosidades", description: "Temas interessantes em páginas automáticas com tempo confortável de leitura.", slug: "curiosidades", icon: Lightbulb, duration: 76, category: "Editorial" },
  { key: "culture", title: "Cultura", description: "Arte, música, literatura e patrimônio em uma experiência editorial paginada.", slug: "cultura", icon: BookOpen, duration: 82, category: "Editorial" },
  { key: "economy", title: "Economia", description: "Dólar, euro, Bitcoin, Selic e IPCA com destaques visuais e indicadores.", slug: "economia", icon: BadgeDollarSign, duration: 30, category: "Indicadores" },
  { key: "sustainability", title: "Sustentabilidade", description: "Energia, renováveis, florestas e emissões apresentados de forma visual.", slug: "sustentabilidade", icon: Leaf, duration: 30, category: "Indicadores" },
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
    if (!organization) { setAddedKeys(new Set()); return; }
    let active = true;
    const urls = apps.map((app) => panelUrl(app.slug));
    void supabase.from("media").select("page_url,status").eq("organization_id", organization.id).eq("type", "webpage").in("page_url", urls).neq("status", "archived").then(({ data }) => {
      if (!active) return;
      const existingUrls = new Set((data || []).map((row) => String(row.page_url || "")));
      setAddedKeys(new Set(apps.filter((app) => existingUrls.has(panelUrl(app.slug))).map((app) => app.key)));
    });
    return () => { active = false; };
  }, [organization]);

  const add = async (app: PanelApp) => {
    if (!organization || !user || inFlight.current.has(app.key)) return;
    if (addedKeys.has(app.key)) { setMessage(`${app.title} já está na sua biblioteca.`); return; }
    inFlight.current.add(app.key);
    setBusyKey(app.key);
    setMessage(null);
    const url = panelUrl(app.slug);
    try {
      const activeResult = await supabase.from("media").select("id,status").eq("organization_id", organization.id).eq("type", "webpage").eq("page_url", url).neq("status", "archived").limit(1).maybeSingle();
      if (activeResult.error) throw activeResult.error;
      if (activeResult.data) {
        setAddedKeys((current) => new Set(current).add(app.key));
        setMessage(`${app.title} já está na sua biblioteca.`);
        return;
      }
      const archivedResult = await supabase.from("media").select("id").eq("organization_id", organization.id).eq("type", "webpage").eq("page_url", url).eq("status", "archived").order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (archivedResult.error) throw archivedResult.error;
      const payload = { organization_id: organization.id, type: "webpage" as const, name: app.title, page_url: url, duration_seconds: app.duration, online_required: false, status: "ready", created_by: user.id };
      const result = archivedResult.data?.id ? await supabase.from("media").update(payload).eq("id", archivedResult.data.id) : await supabase.from("media").insert(payload);
      if (result.error) throw result.error;
      setAddedKeys((current) => new Set(current).add(app.key));
      setMessage(`${app.title} adicionado à sua biblioteca.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Não foi possível adicionar este painel.");
    } finally {
      inFlight.current.delete(app.key);
      setBusyKey(null);
    }
  };

  return (
    <>
      <PageHead eyebrow="Conteúdo PontoView" title="Painéis Automáticos" text="Conteúdos prontos para TV, com atualização inteligente, leitura confortável e visual PontoView. Visualize antes de adicionar à biblioteca." />
      {message && <div className="form-message success">{message}</div>}
      <div className="apps-grid pv-panel-catalog">
        {apps.map((app) => {
          const Icon = app.icon;
          const isAdded = addedKeys.has(app.key);
          return (
            <article className="app-card pv-panel-card" key={app.key}>
              <div className="pv-panel-card-top"><span className="app-icon"><Icon /></span><small className="pv-panel-category">{app.category}</small></div>
              <h2>{app.title}</h2><p>{app.description}</p>
              <div className="pv-panel-meta"><span>{app.duration}s na playlist</span><span>Responsivo 16:9 / 9:16</span></div>
              <div className="pv-panel-actions">
                <button className="btn tertiary" onClick={() => setPreview(app)}><Eye />Visualizar</button>
                <button className="btn secondary" disabled={busyKey !== null || isAdded} onClick={() => void add(app)}>
                  {isAdded ? <Check /> : <Sparkles />}{isAdded ? "Adicionado" : busyKey === app.key ? "Adicionando…" : "Adicionar"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {preview && (
        <Modal eyebrow="PRÉ-VISUALIZAÇÃO DO PAINEL" title={preview.title} onClose={() => setPreview(null)}>
          <div className="pv-panel-preview"><iframe key={preview.key} src={panelUrl(preview.slug)} title={`Pré-visualização: ${preview.title}`} allow="fullscreen" /></div>
          <div className="pv-panel-preview-footer">
            <span>{preview.description}</span>
            <button className="btn primary" disabled={busyKey !== null || addedKeys.has(preview.key)} onClick={() => void add(preview)}>
              {addedKeys.has(preview.key) ? <Check /> : <Sparkles />}{addedKeys.has(preview.key) ? "Já adicionado" : busyKey === preview.key ? "Adicionando…" : "Adicionar à biblioteca"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
