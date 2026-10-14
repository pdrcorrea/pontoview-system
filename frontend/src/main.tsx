import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import PlayerRoot from "./player/PlayerRoot";
import "./player-readability.css";
import "./message-experience.css";
import "./player-critical-fixes.css";
import "./brand-logo-overrides.css";
import "./home-mobile-value-fix.css";

const rootElement = document.getElementById("root");
const PLAYER_HOSTS = new Set(["tv.pontoview.com.br"]);
const isDedicatedPlayer = PLAYER_HOSTS.has(window.location.hostname.toLowerCase());

function render(node: React.ReactNode) {
  if (!rootElement) return;
  ReactDOM.createRoot(rootElement).render(node);
}

function recoverPlayerBoot() {
  const recoveryKey = "pv_player_boot_recovery_v2";
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
    rootElement.innerHTML = '<div style="position:fixed;inset:0;background:#071a2d;color:#fff;display:grid;place-items:center;font-family:Arial,sans-serif"><div style="display:grid;gap:18px;place-items:center"><img src="/assets/icon.png" alt="" style="width:min(18vw,110px);height:min(18vw,110px);object-fit:contain"><div style="font-size:clamp(16px,2vw,28px);font-weight:700">Reiniciando PontoView…</div></div></div>';
  }
}

if (isDedicatedPlayer) {
  try {
    render(
      <React.StrictMode>
        <BrowserRouter>
          <PlayerRoot />
        </BrowserRouter>
      </React.StrictMode>,
    );

    window.setTimeout(() => {
      if (!document.querySelector(".pv-player-runtime, .activation-screen, .player-boot, .player-standby")) {
        recoverPlayerBoot();
      }
    }, 8_000);

    window.setTimeout(() => {
      void import("./player/rotationController");
      void import("./player/orientationController");
      void import("./player/internalPanelSizing");
    }, 1_500);
  } catch {
    recoverPlayerBoot();
  }
} else {
  import("./AdminRoot")
    .then(({ default: AdminRoot }) => render(<AdminRoot />))
    .catch(() => {
      if (rootElement) rootElement.textContent = "Não foi possível iniciar a PontoView.";
    });
}
