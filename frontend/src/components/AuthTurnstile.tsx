import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (element: HTMLElement, options: {
    sitekey: string;
    theme: "auto";
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
  }) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window { turnstile?: TurnstileApi }
}

export const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim();
export const turnstileEnabled = Boolean(turnstileSiteKey);

let scriptPromise: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => window.turnstile ? resolve() : reject(new Error("Turnstile não inicializado"));
      script.onerror = () => reject(new Error("Falha ao carregar o Turnstile"));
      document.head.appendChild(script);
    }).catch((error) => {
      scriptPromise = null;
      throw error;
    });
  }
  return scriptPromise;
}

export function AuthTurnstile({ onToken, resetKey }: {
  onToken: (token: string | null) => void;
  resetKey: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!turnstileEnabled) return;
    let disposed = false;
    let widgetId: string | undefined;
    onTokenRef.current(null);
    loadTurnstile().then(() => {
      if (disposed || !containerRef.current || !window.turnstile) return;
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: turnstileSiteKey,
        theme: "auto",
        callback: (token) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(null),
        "error-callback": () => onTokenRef.current(null),
      });
    }).catch(() => {
      if (!disposed) onTokenRef.current(null);
    });
    return () => {
      disposed = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [resetKey]);

  if (!turnstileEnabled) return null;
  return <div ref={containerRef} aria-label="Verificação de segurança" style={{ minHeight: 65, maxWidth: "100%" }} />;
}
