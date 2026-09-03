import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Cloud,
  Gauge,
  Images,
  LayoutDashboard,
  MonitorPlay,
  Play,
  PanelsTopLeft,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Unplug,
  Youtube,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import "../home.css";
import "../home-refinements.css";

const features = [
  {
    icon: Cloud,
    title: "Google Drive integrado",
    text: "Use os arquivos que já estão no seu Drive. O PontoView organiza o que será exibido sem transformar sua operação em um depósito de uploads.",
  },
  {
    icon: Youtube,
    title: "Vídeos do YouTube",
    text: "Adicione links à programação e combine vídeos online com os demais conteúdos da sua playlist.",
  },
  {
    icon: PanelsTopLeft,
    title: "Painéis automáticos",
    text: "Inclua conteúdos prontos para clima, notícias, economia, mensagens e outros formatos pensados para exibição em TV.",
  },
  {
    icon: CalendarClock,
    title: "Programações",
    text: "Defina quando cada playlist deve aparecer e organize a comunicação ao longo do dia sem depender de troca manual.",
  },
  {
    icon: MonitorPlay,
    title: "Telas sob controle",
    text: "Cadastre e acompanhe suas TVs em uma única área, com uma experiência criada para gerenciamento remoto.",
  },
  {
    icon: Gauge,
    title: "Feito para leitura à distância",
    text: "Layouts e painéis priorizam hierarquia, legibilidade e informação objetiva para ambientes onde a tela precisa ser entendida rapidamente.",
  },
];

const useCases = [
  "Clínicas e recepções",
  "Academias",
  "Restaurantes e áreas de espera",
  "Empresas e comunicação interna",
  "Comércios e pontos de atendimento",
  "Ambientes com TVs informativas",
];

export function HomePage() {
  const { user } = useAuth();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "PontoView Telas | Comunicação em TVs";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const primaryTarget = user ? "/dashboard" : "/cadastro";
  const primaryLabel = user ? "Abrir meu painel" : "Começar agora";

  return (
    <div className="pv-home">
      <header className="pv-home-header">
        <Link className="pv-home-brand" to="/" aria-label="PontoView Telas">
          <span className="pv-home-brandmark">
            <img src="/assets/icon.png" alt="" />
          </span>
          <span className="pv-home-brandname">
            <strong>PontoView</strong>
            <small>Telas</small>
          </span>
        </Link>

        <nav className="pv-home-nav" aria-label="Navegação principal">
          <a href="#como-funciona">Como funciona</a>
          <a href="#recursos">Recursos</a>
          <a href="#aplicacoes">Aplicações</a>
          <a href="https://pontoview.com.br">Ecossistema PontoView</a>
        </nav>

        <div className="pv-home-actions">
          {!user && (
            <Link className="pv-home-link" to="/login">
              Entrar
            </Link>
          )}
          <Link className="pv-home-button pv-home-button-small" to={primaryTarget}>
            {primaryLabel}
            <ArrowRight />
          </Link>
        </div>
      </header>

      <main>
        <section className="pv-home-hero">
          <div className="pv-home-hero-copy">
            <span className="pv-home-kicker">
              <Sparkles /> PontoView Telas · um produto PontoView
            </span>
            <h1>Transforme TVs em canais de comunicação.</h1>
            <p>
              Crie playlists, conecte conteúdos do Google Drive, adicione vídeos do
              YouTube e use painéis automáticos. Tudo organizado pela web para a
              informação chegar à tela certa.
            </p>

            <div className="pv-home-hero-actions">
              <Link className="pv-home-button" to={primaryTarget}>
                {primaryLabel}
                <ArrowRight />
              </Link>
              <a className="pv-home-button pv-home-button-secondary" href="#como-funciona">
                Ver como funciona
              </a>
            </div>

            <div className="pv-home-proof" aria-label="Principais recursos">
              <span><Check /> Google Drive</span>
              <span><Check /> YouTube</span>
              <span><Check /> Painéis automáticos</span>
              <span><Check /> Programações</span>
            </div>
          </div>

          <div className="pv-home-visual" aria-label="Prévia do PontoView Telas">
            <div className="pv-home-browser">
              <div className="pv-home-browserbar">
                <span className="pv-home-dots"><i /><i /><i /></span>
                <span>telas.pontoview.com.br</span>
              </div>
              <div className="pv-home-app-preview">
                <aside>
                  <div className="pv-home-mini-brand">
                    <img src="/assets/icon.png" alt="" />
                    <span>PontoView</span>
                  </div>
                  <i className="active" />
                  <i />
                  <i />
                  <i />
                  <i />
                </aside>
                <div className="pv-home-app-main">
                  <div className="pv-home-app-top">
                    <span>Visão geral</span>
                    <b>Central de exibição</b>
                  </div>
                  <div className="pv-home-preview-stats">
                    <span><small>Telas</small><strong>03</strong></span>
                    <span><small>Playlists</small><strong>06</strong></span>
                    <span><small>Conteúdos</small><strong>24</strong></span>
                  </div>
                  <div className="pv-home-preview-grid">
                    <div className="pv-home-preview-tv">
                      <div className="pv-home-tv-content">
                        <span>INFORMAÇÃO EM TELA</span>
                        <strong>Conteúdo organizado para ser visto.</strong>
                        <small>Playlist Institucional</small>
                      </div>
                    </div>
                    <div className="pv-home-playlist-card">
                      <small>NO AR</small>
                      <strong>Playlist Institucional</strong>
                      <div><i /><span>Vídeo institucional</span></div>
                      <div><i /><span>Painel automático</span></div>
                      <div><i /><span>Conteúdo do Drive</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pv-home-floating-card pv-home-floating-drive">
              <Cloud />
              <span><small>CONTEÚDO</small><strong>Drive conectado</strong></span>
              <Check />
            </div>
            <div className="pv-home-floating-card pv-home-floating-screen">
              <MonitorPlay />
              <span><small>TELA</small><strong>Online agora</strong></span>
              <span className="pv-home-online-dot" />
            </div>
          </div>
        </section>

        <section className="pv-home-strip pv-home-value-strip" aria-label="Proposta PontoView Telas">
          <article>
            <span className="pv-home-value-icon"><Unplug /></span>
            <div><small>ATUALIZAÇÃO</small><strong>Menos pendrive.</strong></div>
          </article>
          <article>
            <span className="pv-home-value-icon"><SlidersHorizontal /></span>
            <div><small>GESTÃO</small><strong>Mais controle.</strong></div>
          </article>
          <article>
            <span className="pv-home-value-icon"><RefreshCw /></span>
            <div><small>ROTINA</small><strong>Comunicação que acompanha sua rotina.</strong></div>
          </article>
        </section>

        <section className="pv-home-section" id="como-funciona">
          <div className="pv-home-section-head">
            <span>COMO FUNCIONA</span>
            <h2>Da sua biblioteca para a TV, do seu jeito.</h2>
            <p>
              O PontoView Telas organiza a operação em três etapas claras. Você
              prepara a programação, conecta a tela e deixa o player fazer o resto.
            </p>
          </div>

          <div className="pv-home-steps">
            <article>
              <span className="pv-home-step-number">01</span>
              <div className="pv-home-step-icon"><Images /></div>
              <h3>Monte seu conteúdo</h3>
              <p>Combine arquivos do Drive, YouTube, mensagens e painéis PontoView.</p>
            </article>
            <article>
              <span className="pv-home-step-number">02</span>
              <div className="pv-home-step-icon"><LayoutDashboard /></div>
              <h3>Crie a programação</h3>
              <p>Organize playlists, horários e o que cada tela precisa exibir.</p>
            </article>
            <article>
              <span className="pv-home-step-number">03</span>
              <div className="pv-home-step-icon"><Play /></div>
              <h3>Coloque no ar</h3>
              <p>Vincule a TV ao PontoView e mantenha a comunicação atualizada pela web.</p>
            </article>
          </div>
        </section>

        <section className="pv-home-section pv-home-section-soft" id="recursos">
          <div className="pv-home-section-head pv-home-section-head-left">
            <span>RECURSOS</span>
            <h2>Uma central de comunicação para suas TVs.</h2>
            <p>
              O necessário para sair da lógica de arquivos soltos e transformar a TV
              em um ponto de informação administrável.
            </p>
          </div>

          <div className="pv-home-feature-grid">
            {features.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <span className="pv-home-feature-icon"><Icon /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="pv-home-section pv-home-control-section">
          <div className="pv-home-control-copy">
            <span className="pv-home-section-label">PENSADO PARA OPERAÇÃO REAL</span>
            <h2>A TV fica na parede. O controle fica com você.</h2>
            <p>
              Atualize a programação sem precisar ir até cada aparelho. O PontoView
              Telas separa a gestão do conteúdo da reprodução para tornar a rotina
              mais simples e previsível.
            </p>
            <div className="pv-home-control-list">
              <span><ShieldCheck /> Conta e acesso organizados pelo ecossistema PontoView</span>
              <span><Cloud /> Conteúdo conectado às fontes que você já utiliza</span>
              <span><MonitorPlay /> Player dedicado para exibição contínua em TV</span>
            </div>
          </div>

          <div className="pv-home-screen-demo">
            <div className="pv-home-screen-frame">
              <div className="pv-home-screen-content">
                <span>PONTOVIEW TELAS</span>
                <strong>Bom conteúdo também precisa de uma boa tela.</strong>
                <p>Informação clara, organizada e pronta para o ambiente.</p>
              </div>
            </div>
            <div className="pv-home-screen-stand" />
          </div>
        </section>

        <section className="pv-home-section" id="aplicacoes">
          <div className="pv-home-section-head">
            <span>ONDE USAR</span>
            <h2>Quando existe uma TV e algo importante para comunicar.</h2>
            <p>
              O mesmo sistema pode atender diferentes rotinas sem obrigar sua empresa
              a trabalhar como uma emissora de televisão.
            </p>
          </div>

          <div className="pv-home-usecases">
            {useCases.map((item) => (
              <span key={item}><Check /> {item}</span>
            ))}
          </div>
        </section>

        <section className="pv-home-final">
          <div>
            <span>PONTOVIEW TELAS</span>
            <h2>Sua próxima atualização pode acontecer pela web, não por pendrive.</h2>
            <p>Crie sua Conta PontoView e comece a organizar suas telas em um só lugar.</p>
          </div>
          <Link className="pv-home-button pv-home-button-light" to={primaryTarget}>
            {primaryLabel}
            <ArrowRight />
          </Link>
        </section>
      </main>

      <footer className="pv-home-footer">
        <Link className="pv-home-brand pv-home-footer-brand" to="/">
          <span className="pv-home-brandmark"><img src="/assets/icon.png" alt="" /></span>
          <span className="pv-home-brandname"><strong>PontoView</strong><small>Telas</small></span>
        </Link>
        <p>PontoView Telas · um produto PontoView</p>
        <nav aria-label="Links institucionais">
          <a href="https://pontoview.com.br">Ecossistema</a>
          <a href="https://pontoview.com.br/privacidade">Privacidade</a>
          <Link to="/login">Entrar</Link>
        </nav>
      </footer>
    </div>
  );
}
