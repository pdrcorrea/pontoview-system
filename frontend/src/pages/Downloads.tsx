import { useEffect } from "react";
import { ArrowLeft, ArrowUpRight, Download, Globe2, MonitorDown, ShieldCheck, Smartphone, Tv } from "lucide-react";
import { Link } from "react-router-dom";
import "./Downloads.css";

// URLs verificadas no repositório oficial PontoView.
// O Windows permanece como artifact de CI para teste: GitHub exige login e não oferece URL pública permanente.
const WEB_PLAYER = "https://tv.pontoview.com.br/";
const WINDOWS_BETA = "https://github.com/pdrcorrea/pontoview-system/actions/runs/41302855220";
const ANDROID_APK = "https://github.com/pdrcorrea/pontoview-system/releases/download/android-v3.0.0-beta4/PontoView-Telas-v3.0.0-beta4.apk";
const ANDROID_SHA256 = "https://github.com/pdrcorrea/pontoview-system/releases/download/android-v3.0.0-beta4/PontoView-Telas-v3.0.0-beta4.sha256";

export function DownloadsPage() {
  useEffect(() => {
    const title = document.title;
    document.title = "Baixar PontoView Player | PontoView Telas";
    return () => { document.title = title; };
  }, []);

  return (
    <div className="pv-downloads">
      <div className="pv-downloads-bg" aria-hidden="true" />
      <header className="pv-downloads-header">
        <Link to="/" className="pv-downloads-logo" aria-label="Voltar ao PontoView Telas">
          <img src="/assets/TelasIconBranco.png" alt="" />
          <span><strong>PontoView</strong><small>Telas</small></span>
        </Link>
        <Link to="/" className="pv-downloads-back"><ArrowLeft size={17} /> Voltar ao site</Link>
      </header>
      <main className="pv-downloads-content">
        <div className="pv-downloads-intro">
          <div className="pv-downloads-eyebrow"><span className="pv-downloads-pulse" /> PontoView Player</div>
          <h1>Seu conteúdo. <span>Em qualquer tela.</span></h1>
          <p>Escolha como reproduzir suas playlists e painéis. Use diretamente no navegador ou instale o aplicativo no seu dispositivo.</p>
        </div>

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
            <div className="pv-downloads-meta">WINDOWS · BETA 2</div>
            <h2>Windows</h2>
            <p>Aplicativo para computador com execução em tela cheia, início automático no login e recuperação de falhas.</p>
            <div className="pv-downloads-spacer"/>
            <a className="pv-downloads-button" href={WINDOWS_BETA} target="_blank" rel="noopener noreferrer">
              Acessar instalador de testes <ArrowUpRight size={18} />
            </a>
            <small>Disponível em Artifacts no GitHub, requer login. Beta sem assinatura digital.</small>
          </article>

          <article className="pv-downloads-card">
            <span className="pv-downloads-icon"><Tv size={28} strokeWidth={1.8}/></span>
            <div className="pv-downloads-meta">ANDROID TV · BETA 4</div>
            <h2>Android TV</h2>
            <p>APK otimizado para TVs e dispositivos Android compatíveis, com reprodução em tela cheia e cache local de mídias.</p>
            <div className="pv-downloads-spacer"/>
            <a className="pv-downloads-button" href={ANDROID_APK} rel="noopener noreferrer">
              <Download size={18} /> Baixar APK
            </a>
            <small>Versão 3.0.0 beta 4 · <a className="pv-downloads-inline-link" href={ANDROID_SHA256} rel="noopener noreferrer">Verificar SHA-256</a></small>
          </article>
        </div>

        <div className="pv-downloads-notes">
          <div><ShieldCheck size={21}/><span><strong>Vinculação simples</strong><small>Ao abrir o player, use o código na seção Telas do seu painel de controle.</small></span></div>
          <div><Smartphone size={21}/><span><strong>Instale com segurança</strong><small>Utilize apenas arquivos oficiais. As versões beta ainda exigem testes de compatibilidade.</small></span></div>
        </div>
      </main>
      <footer className="pv-downloads-footer"><span>© 2026 PontoView · Telas</span><a href="https://pontoview.com.br/legal/privacidade/">Privacidade</a><a href="https://pontoview.com.br/suporte/">Suporte</a></footer>
    </div>
  );
}
