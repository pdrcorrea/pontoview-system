import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Cloud,
  CloudSun,
  Clock3,
  Code2,
  Clapperboard,
  Image,
  Lightbulb,
  Megaphone,
  Newspaper,
  QrCode,
  TrendingUp,
  Images,
  LayoutDashboard,
  Menu,
  MonitorPlay,
  Play,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Unplug,
  X,
  Youtube,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import "../home.css";
import "../home-refinements.css";

const contentTypes = [
  { icon: Image, label: "Imagens" },
  { icon: Clapperboard, label: "Vídeos" },
  { icon: Youtube, label: "YouTube" },
  { icon: Cloud, label: "Google Drive" },
  { icon: Newspaper, label: "Notícias" },
  { icon: CloudSun, label: "Previsão do tempo" },
  { icon: TrendingUp, label: "Economia" },
  { icon: Clock3, label: "Relógio" },
  { icon: Megaphone, label: "Campanhas" },
  { icon: Lightbulb, label: "Curiosidades" },
  { icon: Code2, label: "Páginas HTML" },
  { icon: QrCode, label: "QR Code" },
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 36);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "PontoView Telas | Comunicação em TVs";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const primaryTarget = user ? "/dashboard" : "/cadastro";
  const primaryLabel = user ? "Abrir meu painel" : "Criar conta";

  return (
    <div className="pv-home">
      <header className={`pv-home-header${scrolled ? " is-compact" : ""}`}>
        <Link className="pv-home-brand" to="/" aria-label="PontoView Telas">
          <span className="pv-home-brandmark">
            <img className="pv-home-brand-icon" src="/assets/IconeBranco.png" alt="" />
          </span>
          <span className="pv-home-brandname">
            <strong><b>Ponto</b><span>View</span></strong>
            <small>Telas</small>
          </span>
        </Link>

        <nav className="pv-home-nav" aria-label="Navegação principal">
          <a href="#como-funciona">Como funciona</a>
          <a href="#recursos">Recursos</a>
          <a href="#aplicacoes">Aplicações</a>
          <Link to="/downloads">Baixar player</Link>
        </nav>

        <div className="pv-home-header-actions">
          {!user && (
            <Link className="pv-home-header-login" to="/login">
              Entrar
            </Link>
          )}
          <Link className="pv-home-header-cta" to={primaryTarget}>
            {primaryLabel}
            <ArrowRight />
          </Link>
        </div>

        <button
          className="pv-home-menu-button"
          type="button"
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      <div
        className={`pv-home-menu-overlay${menuOpen ? " open" : ""}`}
        aria-hidden={!menuOpen}
        onClick={() => setMenuOpen(false)}
      >
        <div className="pv-home-menu-panel" onClick={(event) => event.stopPropagation()}>
          <div className="pv-home-menu-head">
            <span>PontoView Telas</span>
            <button type="button" aria-label="Fechar menu" onClick={() => setMenuOpen(false)}><X /></button>
          </div>
          <div className="pv-home-menu-actions">
            <Link className="pv-home-menu-login" to="/downloads" onClick={() => setMenuOpen(false)}>Baixar o player</Link>
            {!user && (
              <Link className="pv-home-menu-login" to="/login" onClick={() => setMenuOpen(false)}>
                Entrar
              </Link>
            )}
            <Link className="pv-home-menu-primary" to={primaryTarget} onClick={() => setMenuOpen(false)}>
              {primaryLabel}
              <ArrowRight />
            </Link>
          </div>
          <div className="pv-home-menu-grid">
            <a href="https://pontoview.com.br" onClick={() => setMenuOpen(false)}>
              <strong>Ecossistema PontoView</strong>
              <span>Conhecer os demais produtos</span>
            </a>
            <a href="https://pontoview.com.br/legal/" onClick={() => setMenuOpen(false)}>
              <strong>Privacidade e segurança</strong>
              <span>Dados, termos e transparência</span>
            </a>
            <a href="#como-funciona" onClick={() => setMenuOpen(false)}>
              <strong>Como funciona</strong>
              <span>Entender o fluxo do Telas</span>
            </a>
            <a href="#recursos" onClick={() => setMenuOpen(false)}>
              <strong>Recursos</strong>
              <span>Conhecer as principais ferramentas</span>
            </a>
          </div>
        </div>
      </div>

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
                {user ? "Abrir meu painel" : "Começar agora"}
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
                    <img src="/assets/TelasIconAzul.png?v=20261016-4" alt="" />
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

        <section className="pv-home-section pv-home-content-section" id="recursos" aria-labelledby="pv-home-content-heading">
          <div className="pv-home-content-heading">
            <span className="pv-home-section-label">CONTEÚDOS</span>
            <h2 id="pv-home-content-heading">Tudo o que você precisa, na sua tela.</h2>
            <p>De imagens e vídeos a painéis informativos que se atualizam automaticamente.</p>
          </div>
          <div className="pv-home-content-grid">
            {contentTypes.map(({ icon: Icon, label }) => (
              <div className="pv-home-content-item" key={label}>
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </div>
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
            {user ? "Abrir meu painel" : "Começar agora"}
            <ArrowRight />
          </Link>
        </section>
      </main>

      <footer className="pv-home-footer">
        <Link className="pv-home-brand pv-home-footer-brand" to="/">
          <span className="pv-home-brandmark">
            <img className="pv-home-brand-icon" src="/assets/TelasIconAzul.png?v=20261016-4" alt="" />
          </span>
          <span className="pv-home-brandname"><strong>PontoView</strong><small>Telas</small></span>
        </Link>
        <p>PontoView Telas · um produto PontoView</p>
        <nav aria-label="Links institucionais">
          <a href="https://pontoview.com.br">Ecossistema</a>
          <a href="https://pontoview.com.br/legal/privacidade/">Privacidade</a>
          <Link to="/login">Entrar</Link>
        </nav>
      </footer>
    </div>
  );
}
