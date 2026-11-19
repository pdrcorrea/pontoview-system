import { useEffect, useState } from "react";
import { ArrowRight, Check, Download, ExternalLink, Globe2, Menu, MonitorDown, ShieldCheck, Smartphone, Tv, X } from "lucide-react";
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
            <img className="pv-home-brand-icon" src="/assets/IconeBranco.png" alt="" />
          </span>
          <span className="pv-home-brandname"><strong><b>Ponto</b><span>View</span></strong><small>Telas</small></span>
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
        <section className="pv-downloads-intro" aria-labelledby="downloads-title">
          <span className="pv-home-section-label">PLAYER PONTOVIEW TELAS</span>
          <h1 id="downloads-title">Escolha onde colocar sua tela no ar.</h1>
          <p>Use o navegador ou instale um player dedicado. A vinculação é feita com o código exibido na TV ou no computador.</p>
        </section>

        <section className="pv-downloads-options" aria-label="Opções de instalação">
          <div className="pv-downloads-grid">
            <article className="pv-downloads-card">
              <span className="pv-downloads-icon"><Globe2 aria-hidden="true" /></span>
              <div className="pv-downloads-meta">SEM INSTALAÇÃO</div>
              <h2>Navegador</h2>
              <p>Abra o player diretamente no navegador compatível.</p>
              <div className="pv-downloads-spacer" />
              <a className="pv-downloads-button" href={WEB_PLAYER} target="_blank" rel="noopener noreferrer">
                Abrir player <ExternalLink size={17} aria-hidden="true" />
              </a>
            </article>
            <article className="pv-downloads-card">
              <span className="pv-downloads-icon"><MonitorDown aria-hidden="true" /></span>
              <div className="pv-downloads-meta">COMPUTADOR</div>
              <h2>Windows</h2>
              <p>Player para execução em tela cheia, com inicialização automática.</p>
              <div className="pv-downloads-spacer" />
              <a className="pv-downloads-button" href={WINDOWS_BETA} target="_blank" rel="noopener noreferrer">
                <Download size={17} aria-hidden="true" /> Baixar para Windows
              </a>
              <small>Versão beta, sem assinatura digital.</small>
            </article>
            <article className="pv-downloads-card pv-downloads-card-tv">
              <span className="pv-downloads-icon"><Tv aria-hidden="true" /></span>
              <div className="pv-downloads-meta">TELEVISÃO</div>
              <h2>Android TV</h2>
              <p>Aplicativo para TVs e dispositivos Android compatíveis.</p>
              <div className="pv-downloads-spacer" />
              <a className="pv-downloads-button" href={ANDROID_APK} rel="noopener noreferrer">
                <Download size={17} aria-hidden="true" /> Baixar APK
              </a>
              <small><a className="pv-downloads-inline-link" href={ANDROID_SHA256} rel="noopener noreferrer">Verificar integridade (SHA-256)</a></small>
            </article>
          </div>
        </section>

        <section className="pv-downloads-guide" aria-labelledby="downloads-guide-title">
          <div className="pv-home-section-head pv-home-section-head-left">
            <span>ANDROID TV</span>
            <h2 id="downloads-guide-title">Instale diretamente na sua TV.</h2>
            <p>Use o aplicativo Downloader para baixar a APK oficial do PontoView Telas, sem precisar transferir arquivos de outro dispositivo.</p>
          </div>
          <div className="pv-downloads-guide-layout">
            <ol className="pv-downloads-steps">
              <li><span className="pv-downloads-step-number">01</span><div><h3>Abra o Downloader</h3><p>Instale o aplicativo <strong>Downloader</strong> pela loja de apps da sua Android TV e abra-o.</p></div></li>
              <li><span className="pv-downloads-step-number">02</span><div><h3>Acesse esta página</h3><p>No campo de endereço do Downloader, digite:</p><code>telas.pontoview.com.br/downloads</code></div></li>
              <li><span className="pv-downloads-step-number">03</span><div><h3>Baixe e instale</h3><p>Selecione <strong>Baixar APK</strong>. Quando o download terminar, escolha <strong>Instalar</strong>.</p></div></li>
              <li><span className="pv-downloads-step-number">04</span><div><h3>Vincule sua tela</h3><p>Abra o PontoView Telas e informe no painel administrativo o código exibido na TV.</p></div></li>
            </ol>
            <aside className="pv-downloads-help">
              <div className="pv-downloads-help-icon"><ShieldCheck aria-hidden="true" /></div>
              <h3>Permissão de instalação</h3>
              <p>Se o Android solicitar, permita a instalação de aplicativos desconhecidos <strong>somente para o Downloader</strong> e volte à instalação.</p>
              <p>O nome e o caminho da configuração podem variar conforme a TV. Após instalar, você pode desativar essa permissão.</p>
              <div className="pv-downloads-help-tip"><Check aria-hidden="true" /><span>Baixe sempre pelo endereço oficial do PontoView.</span></div>
            </aside>
          </div>
        </section>

        <div className="pv-downloads-notes">
          <div><ShieldCheck size={21}/><span><strong>Vinculação simples</strong><small>O código exibido pelo player conecta o dispositivo à sua conta.</small></span></div>
          <div><Smartphone size={21}/><span><strong>Instaladores oficiais</strong><small>Utilize os links desta página para obter os arquivos do PontoView.</small></span></div>
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
