import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Monitor, Smartphone, Share2, Tv, CheckCircle2, ExternalLink } from "lucide-react";
import "../install.css";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const releasesUrl = "https://github.com/pdrcorrea/pontoview-system/releases";
export function InstallPage() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [apk, setApk] = useState<string | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  useEffect(() => {
    document.title = "Instalar | PontoView Telas";
    const listener = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    window.addEventListener("beforeinstallprompt", listener);
    const media = window.matchMedia("(display-mode: standalone)");
    setIsInstalled(media.matches || Boolean((navigator as Navigator & {standalone?: boolean}).standalone));
    const controller = new AbortController();
    fetch("https://api.github.com/repos/pdrcorrea/pontoview-system/releases/latest", { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const asset = data?.assets?.find((item: {name: string; browser_download_url: string}) =>
          /^pontoview-telas.*\.apk$/i.test(item.name));
        if (asset?.browser_download_url) setApk(asset.browser_download_url);
      }).catch(() => {});
    return () => { controller.abort(); window.removeEventListener("beforeinstallprompt", listener); };
  }, []);
  const install = async () => { if (prompt) { await prompt.prompt(); await prompt.userChoice; setPrompt(null); } };
  return <div className="pv-install">
    <header className="pv-install-header"><Link to="/"><ArrowLeft size={19}/> Voltar ao início</Link><span><img src="/assets/IconeAzul.png" alt=""/> <strong>Ponto</strong>View <small>Telas</small></span></header>
    <main className="pv-install-main">
      <div className="pv-install-intro"><span>INSTALAÇÃO</span><h1>PontoView onde você precisar.</h1><p>Escolha seu dispositivo e siga alguns passos. Sem complicação.</p></div>
      <div className="pv-install-grid">
        <section className="pv-install-card"><span className="pv-install-icon"><Smartphone size={29}/></span><h2>No celular ou computador</h2><p>Acesse o painel com um ícone na tela inicial, como um aplicativo.</p>
          {isInstalled ? <div className="pv-install-ok"><CheckCircle2 size={19}/> Já está aberto como aplicativo</div>
           : prompt ? <button className="pv-install-button" onClick={install}><Download size={18}/> Instalar aplicativo</button>
           : <Link className="pv-install-button" to="/login">Abrir PontoView Telas</Link>}
          <div className="pv-install-instructions"><h3>Como instalar</h3>
          <div><span>Android</span><p>No Chrome, abra o menu de três pontinhos e escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</p></div>
          <div><span>iPhone e iPad</span><p>Abra no Safari, toque em <strong>Compartilhar</strong> <Share2 size={14}/> e escolha <strong>Adicionar à Tela de Início</strong>.</p></div>
          <div><span>Computador</span><p>No Chrome ou Edge, procure a opção de instalar na barra de endereço ou no menu do navegador.</p></div></div>
        </section>
        <section className="pv-install-card"><span className="pv-install-icon"><Tv size={30}/></span><h2>Na Android TV</h2><p>Instale o player na TV para exibir suas playlists e painéis em tela cheia.</p>
          {apk ? <a className="pv-install-button" href={apk} rel="noopener noreferrer"><Download size={18}/> Baixar aplicativo para TV</a>
          : <div className="pv-install-unavailable">O instalador da TV ainda não está disponível para download.</div>}
          <div className="pv-install-instructions"><h3>Como colocar na TV</h3>
            <ol><li>Baixe o aplicativo usando o botão acima, quando disponível.</li><li>Envie o arquivo para a TV com um pendrive ou aplicativo de envio de arquivos.</li><li>Na TV, abra o arquivo e escolha <strong>Instalar</strong>. Se a TV pedir autorização, permita a instalação pelo aplicativo que abriu o arquivo.</li><li>Abra o <strong>PontoView Telas</strong>, veja o código na televisão e vincule a tela pelo painel da sua conta.</li></ol>
            <p className="pv-install-note">A instalação funciona em TVs e aparelhos com Android TV compatíveis. O menu pode variar conforme o modelo. Não é necessário instalar o aplicativo no celular para controlar as telas.</p>
          </div><a className="pv-install-releases" href={releasesUrl} target="_blank" rel="noopener noreferrer">Ver versões disponíveis <ExternalLink size={15}/></a>
        </section>
      </div><div className="pv-install-footer"><Monitor size={19}/> Também é possível abrir o player direto no navegador da TV em <strong>tv.pontoview.com.br</strong>.</div>
    </main>
  </div>;
}
