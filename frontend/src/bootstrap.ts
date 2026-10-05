declare global {
  interface Window {
    __PONTOVIEW_CONFIG__?: {
      supabaseUrl?: string;
      supabaseKey?: string;
    };
  }
}

async function loadRuntimeConfig() {
  if (import.meta.env.VITE_SUPABASE_URL && (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)) return;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch("https://fpdojntvnhiszagczfqr.supabase.co/functions/v1/frontend-config", {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return;
    const config = await response.json();
    if (config?.supabaseUrl && config?.supabaseKey) {
      window.__PONTOVIEW_CONFIG__ = {
        supabaseUrl: String(config.supabaseUrl),
        supabaseKey: String(config.supabaseKey),
      };
    }
  } catch {
    // A aplicação ainda inicia. As áreas que dependem do backend exibem erro controlado.
  } finally {
    window.clearTimeout(timeout);
  }
}

async function start() {
  await loadRuntimeConfig();
  await import("./main.tsx");
}

void start();

export {};
