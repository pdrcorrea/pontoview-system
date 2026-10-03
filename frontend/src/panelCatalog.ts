export type PanelCatalogItem = {
  key: string;
  title: string;
  description: string;
  slug: string;
  duration: number;
  category: string;
  emoji: string;
};

export const PANEL_CATALOG: PanelCatalogItem[] = [
  { key: "today", title: "Hoje", description: "Data, feriados, estação do ano e calendário em uma tela elegante.", slug: "hoje", duration: 25, category: "Utilidades", emoji: "📅" },
  { key: "greetings", title: "Saudações", description: "Bom dia, boa tarde, boa noite e boas-vindas com visual dinâmico.", slug: "saudacoes", duration: 18, category: "Ambiente", emoji: "👋" },
  { key: "weather", title: "Previsão do Tempo", description: "Condição atual, sensação térmica e previsão para os próximos dias.", slug: "tempo", duration: 28, category: "Informação", emoji: "🌤️" },
  { key: "news", title: "Notícias", description: "Notícias com imagem, fonte e QR Code em layout próprio para TV.", slug: "noticias", duration: 32, category: "Informação", emoji: "📰" },
  { key: "health", title: "Dicas de Saúde", description: "Conteúdo curto de saúde e bem-estar, renovado a cada atualização.", slug: "saude", duration: 28, category: "Bem-estar", emoji: "❤️‍🩹" },
  { key: "guidance", title: "Orientações", description: "Mensagens úteis de atendimento, segurança e boa convivência.", slug: "orientacoes", duration: 24, category: "Ambiente", emoji: "📌" },
  { key: "curiosities", title: "Curiosidades", description: "Temas interessantes em páginas automáticas com tempo confortável de leitura.", slug: "curiosidades", duration: 76, category: "Editorial", emoji: "💡" },
  { key: "culture", title: "Cultura", description: "Arte, música, literatura e patrimônio em uma experiência editorial paginada.", slug: "cultura", duration: 82, category: "Editorial", emoji: "🎭" },
  { key: "economy", title: "Economia", description: "Dólar, euro, Bitcoin, Selic e IPCA com destaques visuais e indicadores.", slug: "economia", duration: 30, category: "Indicadores", emoji: "📈" },
  { key: "sustainability", title: "Sustentabilidade", description: "Energia, renováveis, florestas e emissões apresentados de forma visual.", slug: "sustentabilidade", duration: 30, category: "Indicadores", emoji: "🌱" },
];

export function panelPath(slug: string) {
  return `/paineis/${slug}/`;
}

export function panelUrl(slug: string) {
  return `${window.location.origin}${panelPath(slug)}`;
}
