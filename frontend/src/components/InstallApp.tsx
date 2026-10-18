import { useEffect, useState } from "react";
import { Download, Share2, PlusSquare, CheckCircle2, Smartphone, X } from "lucide-react";
import "./InstallApp.css";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallApp() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setShowHelp(false);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (!promptEvent) {
      setShowHelp(true);
      return;
    }
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch {
      setShowHelp(true);
    } finally {
      setPromptEvent(null);
    }
  }

  return (
    <section className="pv-install" aria-label="Instalar PontoView Telas">
      <button type="button" className="pv-install-trigger" onClick={install}>
        <Smartphone size={19} aria-hidden="true" />
        <span>Instalar aplicativo</span>
        <Download size={17} aria-hidden="true" />
      </button>
      {showHelp && (
        <div className="pv-install-help">
          <div className="pv-install-heading">
            <strong>Adicionar à tela inicial</strong>
            <button type="button" aria-label="Fechar instruções" onClick={() => setShowHelp(false)}>
              <X size={18} />
            </button>
          </div>
          {isIOS ? (
            <ol>
              <li>Abra este endereço no <strong>Safari</strong>.</li>
              <li>Toque em <Share2 size={15} aria-label="Compartilhar" /> <strong>Compartilhar</strong>.</li>
              <li>Selecione <PlusSquare size={15} aria-label="Adicionar" /> <strong>Adicionar à Tela de Início</strong>.</li>
              <li>Mantenha <strong>Abrir como app Web</strong> ativado e toque em Adicionar.</li>
            </ol>
          ) : (
            <ol>
              <li>Abra o PontoView Telas no <strong>Chrome</strong> do Android.</li>
              <li>No menu do navegador, escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
              <li>Confirme a instalação para abrir pelo ícone.</li>
            </ol>
          )}
          <p><CheckCircle2 size={15} /> Depois de instalado, acesse com um toque.</p>
        </div>
      )}
    </section>
  );
}
