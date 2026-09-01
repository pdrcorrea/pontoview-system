const PANEL_EMOJIS: Array<[RegExp, string]> = [
  [/\b(clima|tempo|previsao do tempo)\b/i, "🌤️"],
  [/\b(hora|relogio)\b/i, "🕒"],
  [/\b(hoje|data|calendario)\b/i, "📅"],
  [/\b(noticias|noticias do dia)\b/i, "📰"],
  [/\b(economia|mercado)\b/i, "📈"],
  [/\b(cultura)\b/i, "🎭"],
  [/\b(curiosidades)\b/i, "💡"],
  [/\b(saude)\b/i, "❤️‍🩹"],
  [/\b(saudacoes|saudacao)\b/i, "👋"],
  [/\b(orientacoes|orientacao)\b/i, "📌"],
  [/\b(sustentabilidade)\b/i, "🌱"],
  [/\b(menu board|cardapio)\b/i, "🍽️"],
  [/\b(mensagens|comunicados)\b/i, "💬"],
  [/\b(busboard|onibus|rodoviaria)\b/i, "🚌"],
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function findEmoji(name: string) {
  const normalized = normalize(name);
  for (const [pattern, emoji] of PANEL_EMOJIS) {
    if (pattern.test(normalized)) return emoji;
  }
  return null;
}

function decoratePanelThumbs() {
  document.querySelectorAll<HTMLElement>(".media-card").forEach((card) => {
    const name = card.querySelector<HTMLElement>(".media-info > b")?.textContent?.trim() || "";
    const type = card.querySelector<HTMLElement>(".media-info > span")?.textContent?.trim() || "";
    const isPontoViewContent = type === "App PontoView" || type === "Página web";
    if (!isPontoViewContent) return;

    const emoji = findEmoji(name);
    if (!emoji) return;

    const thumb = card.querySelector<HTMLElement>(".media-thumb");
    if (!thumb) return;
    thumb.classList.add("pv-panel-thumb");

    let badge = thumb.querySelector<HTMLElement>(".pv-panel-emoji");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "pv-panel-emoji";
      badge.setAttribute("aria-hidden", "true");
      thumb.prepend(badge);
    }
    badge.textContent = emoji;
  });
}

if (typeof document !== "undefined") {
  const start = () => {
    decoratePanelThumbs();
    const observer = new MutationObserver(decoratePanelThumbs);
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}
