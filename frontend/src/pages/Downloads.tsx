import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Download, Globe2, Menu, MonitorDown, ShieldCheck, Smartphone, Sparkles, Tv, X } from "lucide-react";
import { Link } from "react-router-dom";
import "../home.css";
import "../home-refinements.css";
import "./Downloads.css";

// Download direto do executável de testes publicado como asset público de uma prerelease.
// O arquivo permanece sem assinatura digital Authenticode.
const WEB_PLAYER = "https://tv.pontoview.com.br/";
const WINDOWS_BETA = "https://github.com/pdrcorrea/pontoview-system/releases/download/windows-v1.0.0-beta.2-unsigned/PontoView-Player-Windows-1.0.0-beta.2-Setup.exe";
const ANDROID_APK = "https://github.com/pdrcorrea/pontoview-system/releases/download/android-v3.0.0-beta5/PontoView-Telas-v3.0.0-beta5.apk";
const ANDROID_SHA256 = "https://github.com/pdrcorrea/pontoview-system/releases/download/android-v3.0.0-beta5/PontoView-Telas-v3.0.0-beta5.sha256";

export function DownloadsPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Baixar PontoView Player | PontoView Telas";
    return () => { document.title = previousTitle; };
  }, []);
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  return (
    <div className="pv-home pv-downloads">
      <header className="pv-home-header">
        <Link className="pv-home-brand" to="/" aria-label="PontoView Telas, página inicial">
          <span className="pv-home-brandmark">
            <img className="pv-home-brand-icon" src="/assets/TelasIconAzul.png?v=20261016-4" alt="" />
          </span>
          <span className="pv-home-brandname"><strong>PontoView</strong><small>Telas</small></span>
        </Link>
        <nav className="pv-home-nav" aria-label="Navegação principal">
          <Link to="/">Início</Link>
          <Link to="/#como-funciona">Como funciona</Link>
          <Link to="/#recursos">Recursos</Link>
          <Link to="/downloads" aria-current="page">Baixar player</Link>
        </nav>
        <div className="pv-home-header-actions">
          <Link className="pv-home-header-login" to="/login">Entrar</Link>
          <Link className="pv-home-header-cta" to="/cadastro">Criar conta <ArrowRight /></Link>
        </div>
        <button className="pv-home-menu-button" type="button" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}>
          {menuOpen ? <X/> : <Menu/>}
        </button>
      </header>
      <div className={`pv-home-menu-overlay${menuOpen ? " open" : ""}`} aria-hidden={!menuOpen} onClick={() => setMenuOpen(false)}>
        <div className="pv-home-menu-panel" onClick={event => event.stopPropagation()}>
          <div className="pv-home-menu-head"><span>PontoView Telas</span><button type="button" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X /></button></div>
          <div className="pv-home-menu-actions">
            <Link className="pv-home-menu-login" to="/login" onClick={() => setMenuOpen(false)}>Entrar</Link>
            <Link className="pv-home-menu-primary" to="/cadastro" onClick={() => setMenuOpen(false)}>Criar conta <ArrowRight /></Link>
          </div>
          <div className="pv-home-menu-grid">
            <Link to="/" onClick={() => setMenuOpen(false)}><strong>Página inicial</strong><span>Conheça o PontoView Telas</span></Link>
            <Link to="/downloads" onClick={() => setMenuOpen(false)}><strong>Baixar player</strong><span>Windows, Android TV e navegador</span></Link>
            <a href="https://pontoview.com.br/legal/" onClick={() => setMenuOpen(false)}><strong>Privacidade e segurança</strong><span>Dados, termos e transparência</span></a>
            <a href="https://pontoview.com.br/suporte/" onClick={() => setMenuOpen(false)}><strong>Suporte</strong><span>Precisa de ajuda?</span></a>
          </div>
        </div>
      </div>

      <main className="pv-downloads-content">
        <section className="pv-downloads-intro">
          <span className="pv-home-kicker"><Sparkles /> PontoView Telas · Player</span>
          <h1>Suas telas prontas <span>para reproduzir.</span></h1>
          <p>Escolha a melhor forma de exibir seus conteúdos. Abra o player no navegador ou instale o aplicativo no Windows e no Android TV.</p>
        </section>
                <div className="pv-downloads-grid">
          <article className="pv-downloads-card">
            <span className="pv-downloads-icon"><Globe2 size={28} strokeWidth={1.8}/></span>
            <div className="pv-downloads-meta">SEM INSTALAÇÃO</div>
            <h2>Navegador</h2>
            <p>Abra o player em uma aba do navegador e vincule sua tela com o código exibido.</p>
            <div className="pv-downloads-spacer"/>
            <a className="pv-downloads-button pv-downloads-primary" href={WEB_PLAYER} target="_blank" rel="noopener noreferrer">
              Abrir player <ArrowUpRight size={18} />
            </a>
            <small>Chrome, Edge ou navegador compatível</small>
          </article>

          <article className="pv-downloads-card">
            <span className="pv-downloads-icon"><MonitorDown size={28} strokeWidth={1.8}/></span>
            <div className="pv-downloads-meta">WINDOWS</div>
            <h2>Windows</h2>
            <p>Aplicativo para computador com execução em tela cheia, início automático no login e recuperação de falhas.</p>
            <div className="pv-downloads-spacer"/>
            <a className="pv-downloads-button" href={WINDOWS_BETA} target="_blank" rel="noopener noreferrer">
              <Download size={18} /> Baixar para Windows
            </a>
            <small>Download direto do instalador para Windows.</small>
          </article>

          <article className="pv-downloads-card">
            <span className="pv-downloads-icon"><Tv size={28} strokeWidth={1.8}/></span>
            <div className="pv-downloads-meta">ANDROID TV</div>
            <h2>Android TV</h2>
            <p>APK otimizado para TVs e dispositivos Android compatíveis, com reprodução em tela cheia e cache local de mídias.</p>
            <div className="pv-downloads-spacer"/>
            <a className="pv-downloads-button" href={ANDROID_APK} rel="noopener noreferrer">
              <Download size={18} /> Baixar APK
            </a>
            <small><a className="pv-downloads-inline-link" href={ANDROID_SHA256} rel="noopener noreferrer">Verificar integridade do arquivo</a></small>
          </article>
        </div>


        <div className="pv-downloads-notes">
          <div><ShieldCheck size={21}/><span><strong>Vinculação simples</strong><small>Ao abrir o player, use o código na seção Telas do painel de controle.</small></span></div>
          <div><Smartphone size={21}/><span><strong>Instalação segura</strong><small>Utilize os instaladores disponibilizados oficialmente pelo PontoView.</small></span></div>
        </div>
      </main>

      <footer className="pv-home-footer">
        <Link className="pv-home-brand pv-home-footer-brand" to="/">
          <span className="pv-home-brandmark"><img className="pv-home-brand-icon" src="/assets/TelasIconAzul.png?v=20261016-4" alt="" /></span>
          <span className="pv-home-brandname"><strong>PontoView</strong><small>Telas</small></span>
        </Link>
        <p>PontoView Telas · um produto PontoView</p>
        <nav aria-label="Links institucionais">
          <a href="https://pontoview.com.br">Ecossistema</a>
          <a href="https://pontoview.com.br/legal/privacidade/">Privacidade</a>
          <a href="https://pontoview.com.br/suporte/">Suporte</a>
        </nav>
      </footer>
    </div>
  );
}
