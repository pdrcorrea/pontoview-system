import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import "./player-readability.css";
import "./message-experience.css";
import "./player-critical-fixes.css";
import "./brand-logo-overrides.css";
import "./home-mobile-value-fix.css";

const queryClient = new QueryClient();
const rootElement = document.getElementById("root");
const PLAYER_HOSTS = new Set(["tv.pontoview.com.br"]);
const isDedicatedPlayer = PLAYER_HOSTS.has(window.location.hostname.toLowerCase());

function renderApp(node: React.ReactNode) {
  if (!rootElement) return;
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{node}</BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

function recoverPlayerBoot() {
  // A deploy can leave an Android browser holding an old HTML/module graph.
  // Retry once with a cache-busting URL while preserving localStorage, which
  // contains the screen pairing token.
  const recoveryKey = "pv_player_boot_recovery_v1";
  const now = Date.now();
  let previous = 0;
  try {
    previous = Number(sessionStorage.getItem(recoveryKey) || 0);
  } catch {
    // sessionStorage may be unavailable in hardened browser modes.
  }

  if (!previous || now - previous > 60_000) {
    try { sessionStorage.setItem(recoveryKey, String(now)); } catch { /* noop */ }
    const url = new URL(window.location.href);
    url.searchParams.set("pv_boot", String(now));
    window.location.replace(url.toString());
    return;
  }

  if (rootElement) {
    rootElement.innerHTML = '<div style="position:fixed;inset:0;background:#000;display:grid;place-items:center"><img src="/assets/icon.png" alt="" style="width:min(16vw,110px);height:min(16vw,110px);object-fit:contain;opacity:.9"></div>';
  }
}

if (isDedicatedPlayer) {
  import("./player/PlayerRoot")
    .then(({ default: PlayerRoot }) => renderApp(<PlayerRoot />))
    .catch(() => recoverPlayerBoot());
} else {
  import("./App")
    .then(({ default: App }) => renderApp(<App />))
    .catch(() => {
      if (rootElement) rootElement.textContent = "Não foi possível iniciar a PontoView.";
    });
}
