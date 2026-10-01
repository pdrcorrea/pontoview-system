export type SeasonalCampaignCategory = "Saúde" | "Cidadania" | "Comemorativa";

export type SeasonalCampaign = {
  key: string;
  name: string;
  description: string;
  start: [number, number];
  end: [number, number];
  periodLabel: string;
  emoji: string;
  durationSeconds: number;
  route: string;
  category: SeasonalCampaignCategory;
};

export const SEASONAL_CAMPAIGNS: SeasonalCampaign[] = [
  {
    key: "janeiro_branco",
    name: "Janeiro Branco",
    description: "Saúde mental, bem-estar emocional e incentivo ao cuidado.",
    start: [1, 1],
    end: [1, 31],
    periodLabel: "Janeiro",
    emoji: "🤍",
    durationSeconds: 30,
    route: "/paineis/janeiro-branco/",
    category: "Saúde",
  },
  {
    key: "janeiro_roxo",
    name: "Janeiro Roxo",
    description: "Conscientização, prevenção e combate ao estigma relacionado à hanseníase.",
    start: [1, 1],
    end: [1, 31],
    periodLabel: "Janeiro",
    emoji: "💜",
    durationSeconds: 30,
    route: "/paineis/janeiro-roxo/",
    category: "Saúde",
  },
  {
    key: "dia_mundial_cancer",
    name: "Dia Mundial do Câncer",
    description: "Conscientização sobre prevenção, diagnóstico e cuidado relacionado ao câncer.",
    start: [1, 28],
    end: [2, 11],
    periodLabel: "28 de janeiro a 11 de fevereiro",
    emoji: "🎗️",
    durationSeconds: 30,
    route: "/paineis/dia-mundial-cancer/",
    category: "Saúde",
  },
  {
    key: "marco_lilas",
    name: "Março Lilás",
    description: "Conscientização sobre prevenção e detecção do câncer do colo do útero.",
    start: [3, 1],
    end: [3, 31],
    periodLabel: "Março",
    emoji: "💜",
    durationSeconds: 30,
    route: "/paineis/marco-lilas/",
    category: "Saúde",
  },
  {
    key: "abril_azul",
    name: "Abril Azul",
    description: "Conscientização sobre autismo, respeito às diferenças e inclusão.",
    start: [4, 1],
    end: [4, 30],
    periodLabel: "Abril",
    emoji: "💙",
    durationSeconds: 30,
    route: "/paineis/abril-azul/",
    category: "Cidadania",
  },
  {
    key: "abril_verde",
    name: "Abril Verde",
    description: "Prevenção de acidentes e doenças relacionadas ao trabalho.",
    start: [4, 1],
    end: [4, 30],
    periodLabel: "Abril",
    emoji: "💚",
    durationSeconds: 30,
    route: "/paineis/abril-verde/",
    category: "Saúde",
  },
  {
    key: "orgulho",
    name: "Mês do Orgulho",
    description: "Diversidade, respeito, cidadania e visibilidade LGBTQIA+.",
    start: [6, 1],
    end: [6, 30],
    periodLabel: "Junho",
    emoji: "🌈",
    durationSeconds: 30,
    route: "/paineis/orgulho/",
    category: "Cidadania",
  },
  {
    key: "junho_vermelho",
    name: "Junho Vermelho",
    description: "Conscientização sobre a importância da doação de sangue.",
    start: [6, 1],
    end: [6, 30],
    periodLabel: "Junho",
    emoji: "🩸",
    durationSeconds: 30,
    route: "/paineis/junho-vermelho/",
    category: "Saúde",
  },
  {
    key: "julho_amarelo",
    name: "Julho Amarelo",
    description: "Prevenção, diagnóstico e conscientização sobre hepatites virais.",
    start: [7, 1],
    end: [7, 31],
    periodLabel: "Julho",
    emoji: "💛",
    durationSeconds: 30,
    route: "/paineis/julho-amarelo/",
    category: "Saúde",
  },
  {
    key: "agosto_dourado",
    name: "Agosto Dourado",
    description: "Promoção, proteção e apoio ao aleitamento materno.",
    start: [8, 1],
    end: [8, 31],
    periodLabel: "Agosto",
    emoji: "🟡",
    durationSeconds: 30,
    route: "/paineis/agosto-dourado/",
    category: "Saúde",
  },
  {
    key: "agosto_lilas",
    name: "Agosto Lilás",
    description: "Prevenção e enfrentamento à violência contra as mulheres.",
    start: [8, 1],
    end: [8, 31],
    periodLabel: "Agosto",
    emoji: "💜",
    durationSeconds: 30,
    route: "/paineis/agosto-lilas/",
    category: "Cidadania",
  },
  {
    key: "combate_fumo",
    name: "Dia Nacional de Combate ao Fumo",
    description: "Conscientização sobre os danos do tabagismo e da nicotina.",
    start: [8, 22],
    end: [9, 5],
    periodLabel: "22 de agosto a 5 de setembro",
    emoji: "🚭",
    durationSeconds: 30,
    route: "/paineis/combate-fumo/",
    category: "Saúde",
  },
  {
    key: "setembro_amarelo",
    name: "Setembro Amarelo",
    description: "Prevenção do suicídio, acolhimento e incentivo à busca de ajuda.",
    start: [9, 1],
    end: [9, 30],
    periodLabel: "Setembro",
    emoji: "🎗️",
    durationSeconds: 30,
    route: "/paineis/setembro-amarelo/",
    category: "Saúde",
  },
  {
    key: "outubro_rosa",
    name: "Outubro Rosa",
    description: "Conscientização sobre câncer de mama com orientação breve e acesso ao conteúdo oficial do INCA.",
    start: [10, 1],
    end: [10, 31],
    periodLabel: "Outubro",
    emoji: "🎀",
    durationSeconds: 30,
    route: "/paineis/outubro-rosa/",
    category: "Saúde",
  },
  {
    key: "novembro_azul",
    name: "Novembro Azul",
    description: "Saúde do homem e informação confiável sobre câncer de próstata.",
    start: [11, 1],
    end: [11, 30],
    periodLabel: "Novembro",
    emoji: "🔵",
    durationSeconds: 30,
    route: "/paineis/novembro-azul/",
    category: "Saúde",
  },
  {
    key: "dia_mundial_aids",
    name: "Dia Mundial da Aids",
    description: "Informação, prevenção, testagem, tratamento e enfrentamento ao estigma.",
    start: [11, 24],
    end: [12, 8],
    periodLabel: "24 de novembro a 8 de dezembro",
    emoji: "🎗️",
    durationSeconds: 30,
    route: "/paineis/dia-mundial-aids/",
    category: "Saúde",
  },
  {
    key: "dezembro_vermelho",
    name: "Dezembro Vermelho",
    description: "Prevenção ao HIV, aids e outras infecções sexualmente transmissíveis.",
    start: [12, 1],
    end: [12, 31],
    periodLabel: "Dezembro",
    emoji: "🔴",
    durationSeconds: 30,
    route: "/paineis/dezembro-vermelho/",
    category: "Saúde",
  },
  {
    key: "dezembro_laranja",
    name: "Dezembro Laranja",
    description: "Conscientização sobre câncer de pele e proteção contra exposição solar excessiva.",
    start: [12, 1],
    end: [12, 31],
    periodLabel: "Dezembro",
    emoji: "🟠",
    durationSeconds: 30,
    route: "/paineis/dezembro-laranja/",
    category: "Saúde",
  },
  {
    key: "natal",
    name: "Natal",
    description: "Mensagem de boas festas para ambientes de atendimento, espera e convivência.",
    start: [12, 1],
    end: [12, 25],
    periodLabel: "1 a 25 de dezembro",
    emoji: "🎄",
    durationSeconds: 25,
    route: "/paineis/natal/",
    category: "Comemorativa",
  },
  {
    key: "ano_novo",
    name: "Ano Novo",
    description: "Mensagem de virada de ano com visual comemorativo e ano atualizado automaticamente.",
    start: [12, 26],
    end: [1, 6],
    periodLabel: "26 de dezembro a 6 de janeiro",
    emoji: "✨",
    durationSeconds: 25,
    route: "/paineis/ano-novo/",
    category: "Comemorativa",
  },
];

export function seasonalDateCode(date: Date, timezone?: string) {
  if (!timezone) return (date.getMonth() + 1) * 100 + date.getDate();

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const month = Number(
      parts.find((part) => part.type === "month")?.value || date.getMonth() + 1,
    );
    const day = Number(
      parts.find((part) => part.type === "day")?.value || date.getDate(),
    );
    return month * 100 + day;
  } catch {
    return (date.getMonth() + 1) * 100 + date.getDate();
  }
}

export function isSeasonalCampaignActive(
  campaign: Pick<SeasonalCampaign, "start" | "end">,
  now = new Date(),
  timezone?: string,
) {
  const current = seasonalDateCode(now, timezone);
  const start = campaign.start[0] * 100 + campaign.start[1];
  const end = campaign.end[0] * 100 + campaign.end[1];

  return start <= end
    ? current >= start && current <= end
    : current >= start || current <= end;
}

export function seasonalCampaignByKey(key: string | null | undefined) {
  if (!key) return null;
  return SEASONAL_CAMPAIGNS.find((campaign) => campaign.key === key) || null;
}

export function seasonalCampaignRoute(key: string | null | undefined) {
  return seasonalCampaignByKey(key)?.route || null;
}
