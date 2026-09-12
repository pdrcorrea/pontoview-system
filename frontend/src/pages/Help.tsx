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
  ShieldCheck,
  Settings,
  Smile,
  Sparkles,
  Youtube,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Modal, PageHead } from "../components/ui";
import { supabase } from "../lib/supabase";

type HelpGuide = {
  title: string;
  summary: string;
  intro: string;
  steps: string[];
  icon: LucideIcon;
  action?: { label: string; to: string };
  featured?: boolean;
};

const guides: HelpGuide[] = [
  {
    title: "Primeiros passos",
    summary: "O caminho mais curto entre a conta criada e a primeira TV no ar.",
    intro: "Para colocar a primeira tela em funcionamento, siga esta ordem:",
    steps: [
      "Se pretende usar arquivos próprios, conecte primeiro o Google Drive em Empresa.",
      "Em Conteúdo, adicione imagens, vídeos do Drive, YouTube ou Painéis PontoView.",
      "Em Playlists, crie uma sequência e coloque os conteúdos na ordem desejada.",
      "Abra tv.pontoview.com.br na TV ou use o aplicativo PontoView Telas para obter o código de conexão.",
      "Em Telas, clique em Conectar tela, informe o código e escolha a playlist padrão.",
      "Se quiser automatizar horários, abra Telas → Configurar esta tela → Programação.",
    ],
    icon: BookOpen,
    action: { label: "Ir para Conteúdo", to: "/conteudo" },
    featured: true,
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
    title: "Conectar e usar o Google Drive",
    summary: "Passo a passo completo, desde a autorização da conta até adicionar o primeiro arquivo.",
    intro: "A conexão é feita uma única vez por conta Google. Depois disso, você escolhe os arquivos diretamente na biblioteca da PontoView.",
    steps: [
      "Abra Empresa e localize a seção Google Drive.",
      "Clique em Conectar Google Drive. Uma janela do Google será aberta para você escolher a conta.",
      "Confirme a autorização solicitada pelo Google. A PontoView usa apenas o acesso necessário para trabalhar com os arquivos escolhidos pelo usuário.",
      "Ao voltar para a PontoView, confira se a conta aparece como Ativo na seção Google Drive.",
      "Abra Conteúdo e escolha Google Drive para abrir o seletor de arquivos.",
      "Navegue pelas pastas, escolha uma imagem ou vídeo e confirme a seleção.",
      "O item aparecerá na biblioteca. Depois, adicione-o a uma playlist normalmente.",
      "Se a conta aparecer como Atenção necessária, volte em Empresa e conecte novamente a mesma conta.",
    ],
    icon: Cloud,
    action: { label: "Conectar Google Drive", to: "/empresa#google-drive" },
    featured: true,
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
    summary: "Troque a playlist de uma tela automaticamente por dia e horário.",
    intro: "A programação fica dentro da própria tela para deixar o fluxo mais simples.",
    steps: [
      "Abra Telas e clique em Configurar esta tela.",
      "Entre na aba Programação e clique em Nova programação.",
      "Escolha a playlist, os dias e o intervalo de horário.",
      "Ao fim do período, o Player volta automaticamente para a playlist padrão.",
      "Para programar um grupo inteiro, abra Telas → Organizar telas em grupos → Programar grupos.",
    ],
    icon: CalendarClock,
  },
  {
    title: "Horário de funcionamento",
    summary: "Faça a tela entrar em repouso fora do período de operação.",
    intro: "O horário de funcionamento é diferente da programação de conteúdo.",
    steps: [
      "Abra Telas → Configurar esta tela → Programação.",
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
      "Abra tv.pontoview.com.br no navegador da TV ou mini PC.",
      "Na página Telas, clique em Conectar tela.",
      "Digite o código de 6 dígitos mostrado pelo Player e dê um nome ao dispositivo.",
      "Depois de conectado, o card deve ficar Online e atualizar a última comunicação periodicamente.",
    ],
    icon: Monitor,
  },
  {
    title: "Visual com informações",
    summary: "Exiba conteúdo principal com relógio, clima, notícias, mensagens e identidade da empresa.",
    intro: "Esse visual pertence à configuração da tela, não à playlist.",
    steps: [
      "Abra Telas → Configurar esta tela → Visual.",
      "Selecione Com informações.",
      "Escolha a posição da coluna e da faixa e ative apenas o que for útil.",
      "Use a pré-visualização para conferir a composição antes de salvar.",
    ],
    icon: PanelRight,
  },
  {
    title: "Clima e previsão",
    summary: "Informe a cidade uma vez e deixe a PontoView resolver localização e previsão.",
    intro: "O widget usa a cidade configurada na tela e consulta dados meteorológicos com cache.",
    steps: [
      "Abra Telas → Configurar esta tela → Visual, escolha Com informações e ative Clima.",
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
      "Abra Telas → Configurar esta tela → Visual, escolha Com informações e ative Notícias.",
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
      "Abra Mensagens e escreva o aviso.",
      "Escolha Faixa inferior ou Destaque lateral.",
      "Defina quando deve aparecer e em quais telas.",
      "Use Mais opções somente se precisar alterar prioridade, estilo ou duração.",
    ],
    icon: MessageSquareText,
  },
  {
    title: "Logo da empresa",
    summary: "Use a identidade do estabelecimento na área informativa do Player.",
    intro: "A logo cadastrada pode ser usada na área informativa das telas.",
    steps: [
      "Abra Empresa.",
      "Envie uma imagem PNG, JPG ou WebP de até 2 MB.",
      "Prefira uma versão horizontal, limpa e com fundo transparente.",
      "Depois de salvar, aguarde a próxima sincronização do Player para a nova marca aparecer.",
    ],
    icon: Settings,
  },
  {
    title: "Minha conta e privacidade",
    summary: "Edite seus dados e acompanhe solicitações de privacidade.",
    intro: "A área Minha conta reúne somente informações do seu usuário.",
    steps: [
      "Abra Minha conta para atualizar nome e telefone.",
      "Use Baixar meus dados para obter uma cópia das informações do seu usuário.",
      "Em Exercer um direito, registre pedidos de acesso, correção, portabilidade, exclusão ou informações sobre compartilhamento.",
      "Acompanhe o status das solicitações na própria página.",
    ],
    icon: ShieldCheck,
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
      <div className="help-quick-actions">
        <Link to="/empresa#google-drive"><Cloud /><span><b>Conectar Drive</b><small>Autorizar arquivos da empresa</small></span><ChevronRight /></Link>
        <Link to="/conteudo"><Image /><span><b>Adicionar conteúdo</b><small>Drive, YouTube e páginas</small></span><ChevronRight /></Link>
        <Link to="/telas?parear=1"><Monitor /><span><b>Conectar uma TV</b><small>Usar o código do Player</small></span><ChevronRight /></Link>
      </div>

      <section className="how">
        <div className="section-head">
          <small>FLUXO PRINCIPAL</small>
          <h2>Conteúdo → playlist → tela.</h2>
          <p>Depois disso, cada TV concentra visual, horários e automações em uma única configuração.</p>
        </div>
        <div className="flow">
          <article><Cloud /><h3>Conecte</h3><p>Escolha suas fontes.</p></article>
          <ChevronRight />
          <article><ListVideo /><h3>Organize</h3><p>Monte playlists.</p></article>
          <ChevronRight />
          <article><CalendarClock /><h3>Automatize</h3><p>Defina horários na própria tela.</p></article>
          <ChevronRight />
          <article><Monitor /><h3>Exiba</h3><p>Pareie o Player.</p></article>
        </div>
      </section>
      <div className="help-grid help-topics">
        {filtered.map((guide) => {
          const Icon = guide.icon;
          return (
            <details className={guide.featured ? "help-card help-topic featured" : "help-card help-topic"} key={guide.title}>
              <summary>
                <span><Icon /></span>
                <div><h2>{guide.title}</h2><p>{guide.summary}</p></div>
                <ChevronRight />
              </summary>
              <div className="help-topic-body">
                <p>{guide.intro}</p>
                <ol>{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                {guide.action && <Link className="btn secondary help-guide-action" to={guide.action.to}>{guide.action.label}<ChevronRight /></Link>}
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
