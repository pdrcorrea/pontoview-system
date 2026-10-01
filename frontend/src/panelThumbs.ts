const PANEL_EMOJIS: Array<[RegExp, string]> = [
  [/\b(clima|tempo|previsao do tempo)\b/i, "🌤️"],
  [/\b(hora|relogio)\b/i, "🕒"],
  [/\b(hoje|data|calendario)\b/i, "📅"],
  [/\b(noticias|noticias do dia)\b/i, "📰"],
  [/\b(economia|mercado)\b/i, "📈"],
  [/\b(cultura)\b/i, "🎭"],
  [/\b(curiosidades)\b/i, "💡"],
  [/\b(saude)\b/i, "❤️‍🩹"],
  [/\b(dia de reis)\b/i, "👑"],
  [/\b(carnaval)\b/i, "🎭"],
  [/\b(dia da mulher|dia internacional da mulher)\b/i, "🌷"],
  [/\b(sexta-feira santa|sexta feira santa)\b/i, "✝️"],
  [/\b(pascoa)\b/i, "🕊️"],
  [/\b(tiradentes)\b/i, "🔺"],
  [/\b(dia do trabalho)\b/i, "🛠️"],
  [/\b(dia das maes)\b/i, "🌷"],
  [/\b(corpus christi)\b/i, "🕊️"],
  [/\b(dia dos namorados)\b/i, "💞"],
  [/\b(festas juninas)\b/i, "🔥"],
  [/\b(dia dos avos)\b/i, "💛"],
  [/\b(dia dos pais)\b/i, "💙"],
  [/\b(independencia do brasil)\b/i, "🇧🇷"],
  [/\b(nossa senhora aparecida)\b/i, "🙏"],
  [/\b(dia das criancas)\b/i, "🎈"],
  [/\b(halloween|dia do saci)\b/i, "🎃"],
  [/\b(dia dos professores)\b/i, "📚"],
  [/\b(finados)\b/i, "🕯️"],
  [/\b(proclamacao da republica)\b/i, "🇧🇷"],
  [/\b(consciencia negra)\b/i, "🖤"],
  [/\b(janeiro branco)\b/i, "🤍"],
  [/\b(janeiro roxo)\b/i, "💜"],
  [/\b(dia mundial do cancer)\b/i, "🎗️"],
  [/\b(marco lilas)\b/i, "💜"],
  [/\b(abril azul)\b/i, "💙"],
  [/\b(abril verde)\b/i, "💚"],
  [/\b(junho vermelho)\b/i, "🩸"],
  [/\b(julho amarelo)\b/i, "💛"],
  [/\b(agosto dourado)\b/i, "🟡"],
  [/\b(agosto lilas)\b/i, "💜"],
  [/\b(combate ao fumo)\b/i, "🚭"],
  [/\b(dezembro vermelho)\b/i, "🔴"],
  [/\b(dezembro laranja)\b/i, "🟠"],
  [/\b(mes do orgulho|orgulho)\b/i, "🌈"],
  [/\b(setembro amarelo)\b/i, "🎗️"],
  [/\b(outubro rosa)\b/i, "🎀"],
  [/\b(novembro azul)\b/i, "🔵"],
  [/\b(dia mundial da aids|aids)\b/i, "🎗️"],
  [/\b(natal)\b/i, "🎄"],
  [/\b(ano novo)\b/i, "✨"],
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
    const isPontoViewContent = type === "App PontoView" || type === "Campanha sazonal" || type === "Página web";
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
    if (badge.textContent !== emoji) badge.textContent = emoji;
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
