export type SeasonalCampaignCategory =
  | "Saúde"
  | "Cidadania"
  | "Comemorativa"
  | "Familiar"
  | "Religiosa"
  | "Cívica"
  | "Cultural";

export type SeasonalCampaignRule =
  | { kind: "fixed_day"; month: number; day: number; windowDays: number }
  | { kind: "nth_weekday"; month: number; weekday: number; occurrence: number; windowDays: number }
  | { kind: "easter_offset"; offsetDays: number; windowDays: number }
  | { kind: "easter_range"; startOffset: number; endOffset: number };

export type SeasonalCampaign = {
  key: string;
  name: string;
  description: string;
  start?: [number, number];
  end?: [number, number];
  rule?: SeasonalCampaignRule;
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
    key: "dia_reis",
    name: "Dia de Reis",
    description: "Celebração tradicional do encerramento do ciclo natalino.",
    rule: { kind: "fixed_day", month: 1, day: 6, windowDays: 7 },
    periodLabel: "6 de janeiro · ± 7 dias",
    emoji: "👑",
    durationSeconds: 25,
    route: "/paineis/dia-reis/",
    category: "Religiosa",
  },
  {
    key: "carnaval",
    name: "Carnaval",
    description: "Painel festivo para o período de Carnaval, com cores e movimento.",
    rule: { kind: "easter_range", startOffset: -50, endOffset: -46 },
    periodLabel: "Período do Carnaval · data móvel",
    emoji: "🎭",
    durationSeconds: 25,
    route: "/paineis/carnaval/",
    category: "Cultural",
  },
  {
    key: "dia_mulher",
    name: "Dia Internacional da Mulher",
    description: "Mensagem de respeito, reconhecimento e valorização das mulheres.",
    rule: { kind: "fixed_day", month: 3, day: 8, windowDays: 7 },
    periodLabel: "8 de março · ± 7 dias",
    emoji: "🌷",
    durationSeconds: 25,
    route: "/paineis/dia-mulher/",
    category: "Cidadania",
  },
  {
    key: "sexta_feira_santa",
    name: "Sexta-feira Santa",
    description: "Mensagem respeitosa para a celebração cristã da Paixão de Cristo.",
    rule: { kind: "easter_offset", offsetDays: -2, windowDays: 7 },
    periodLabel: "Sexta-feira antes da Páscoa · ± 7 dias",
    emoji: "✝️",
    durationSeconds: 25,
    route: "/paineis/sexta-feira-santa/",
    category: "Religiosa",
  },
  {
    key: "pascoa",
    name: "Páscoa",
    description: "Mensagem de renovação, esperança e união para o período pascal.",
    rule: { kind: "easter_offset", offsetDays: 0, windowDays: 7 },
    periodLabel: "Domingo de Páscoa · ± 7 dias",
    emoji: "🕊️",
    durationSeconds: 25,
    route: "/paineis/pascoa/",
    category: "Religiosa",
  },
  {
    key: "tiradentes",
    name: "Tiradentes",
    description: "Data cívica nacional em memória de Joaquim José da Silva Xavier.",
    rule: { kind: "fixed_day", month: 4, day: 21, windowDays: 7 },
    periodLabel: "21 de abril · ± 7 dias",
    emoji: "⭐",
    durationSeconds: 25,
    route: "/paineis/tiradentes/",
    category: "Cívica",
  },
  {
    key: "dia_trabalho",
    name: "Dia do Trabalho",
    description: "Mensagem de reconhecimento a quem contribui diariamente com seu trabalho.",
    rule: { kind: "fixed_day", month: 5, day: 1, windowDays: 7 },
    periodLabel: "1º de maio · ± 7 dias",
    emoji: "🛠️",
    durationSeconds: 25,
    route: "/paineis/dia-trabalho/",
    category: "Comemorativa",
  },
  {
    key: "dia_maes",
    name: "Dia das Mães",
    description: "Mensagem afetiva para o segundo domingo de maio.",
    rule: { kind: "nth_weekday", month: 5, weekday: 0, occurrence: 2, windowDays: 7 },
    periodLabel: "2º domingo de maio · ± 7 dias",
    emoji: "🌷",
    durationSeconds: 25,
    route: "/paineis/dia-maes/",
    category: "Familiar",
  },
  {
    key: "corpus_christi",
    name: "Corpus Christi",
    description: "Painel respeitoso para a celebração cristã de Corpus Christi.",
    rule: { kind: "easter_offset", offsetDays: 60, windowDays: 7 },
    periodLabel: "60 dias após a Páscoa · ± 7 dias",
    emoji: "🕊️",
    durationSeconds: 25,
    route: "/paineis/corpus-christi/",
    category: "Religiosa",
  },
  {
    key: "dia_namorados",
    name: "Dia dos Namorados",
    description: "Mensagem leve e afetiva para celebrar vínculos e companheirismo.",
    rule: { kind: "fixed_day", month: 6, day: 12, windowDays: 7 },
    periodLabel: "12 de junho · ± 7 dias",
    emoji: "💞",
    durationSeconds: 25,
    route: "/paineis/dia-namorados/",
    category: "Familiar",
  },
  {
    key: "festas_juninas",
    name: "Festas Juninas",
    description: "Ambientação de junho inspirada nas tradições populares das festas juninas.",
    start: [6, 1],
    end: [6, 30],
    periodLabel: "Junho",
    emoji: "🔥",
    durationSeconds: 25,
    route: "/paineis/festas-juninas/",
    category: "Cultural",
  },
  {
    key: "dia_avos",
    name: "Dia dos Avós",
    description: "Mensagem de carinho e reconhecimento às avós e aos avôs.",
    rule: { kind: "fixed_day", month: 7, day: 26, windowDays: 7 },
    periodLabel: "26 de julho · ± 7 dias",
    emoji: "💛",
    durationSeconds: 25,
    route: "/paineis/dia-avos/",
    category: "Familiar",
  },
  {
    key: "dia_pais",
    name: "Dia dos Pais",
    description: "Mensagem afetiva para o segundo domingo de agosto.",
    rule: { kind: "nth_weekday", month: 8, weekday: 0, occurrence: 2, windowDays: 7 },
    periodLabel: "2º domingo de agosto · ± 7 dias",
    emoji: "💙",
    durationSeconds: 25,
    route: "/paineis/dia-pais/",
    category: "Familiar",
  },
  {
    key: "independencia",
    name: "Independência do Brasil",
    description: "Painel cívico para a data nacional de 7 de setembro.",
    rule: { kind: "fixed_day", month: 9, day: 7, windowDays: 7 },
    periodLabel: "7 de setembro · ± 7 dias",
    emoji: "🇧🇷",
    durationSeconds: 25,
    route: "/paineis/independencia/",
    category: "Cívica",
  },
  {
    key: "nossa_senhora_aparecida",
    name: "Nossa Senhora Aparecida",
    description: "Painel respeitoso para a celebração da Padroeira do Brasil.",
    rule: { kind: "fixed_day", month: 10, day: 12, windowDays: 7 },
    periodLabel: "12 de outubro · ± 7 dias",
    emoji: "🙏",
    durationSeconds: 25,
    route: "/paineis/nossa-senhora-aparecida/",
    category: "Religiosa",
  },
  {
    key: "dia_criancas",
    name: "Dia das Crianças",
    description: "Mensagem alegre sobre infância, brincadeira, cuidado e imaginação.",
    rule: { kind: "fixed_day", month: 10, day: 12, windowDays: 7 },
    periodLabel: "12 de outubro · ± 7 dias",
    emoji: "🎈",
    durationSeconds: 25,
    route: "/paineis/dia-criancas/",
    category: "Familiar",
  },
  {
    key: "dia_professores",
    name: "Dia dos Professores",
    description: "Mensagem de reconhecimento a quem ensina, orienta e transforma.",
    rule: { kind: "fixed_day", month: 10, day: 15, windowDays: 7 },
    periodLabel: "15 de outubro · ± 7 dias",
    emoji: "📚",
    durationSeconds: 25,
    route: "/paineis/dia-professores/",
    category: "Comemorativa",
  },
  {
    key: "finados",
    name: "Finados",
    description: "Mensagem sóbria de memória, saudade e respeito.",
    rule: { kind: "fixed_day", month: 11, day: 2, windowDays: 7 },
    periodLabel: "2 de novembro · ± 7 dias",
    emoji: "🕯️",
    durationSeconds: 25,
    route: "/paineis/finados/",
    category: "Religiosa",
  },
  {
    key: "proclamacao_republica",
    name: "Proclamação da República",
    description: "Painel cívico para a data nacional de 15 de novembro.",
    rule: { kind: "fixed_day", month: 11, day: 15, windowDays: 7 },
    periodLabel: "15 de novembro · ± 7 dias",
    emoji: "🇧🇷",
    durationSeconds: 25,
    route: "/paineis/proclamacao-republica/",
    category: "Cívica",
  },
  {
    key: "consciencia_negra",
    name: "Dia da Consciência Negra",
    description: "Data de reflexão sobre igualdade, respeito e valorização da cultura afro-brasileira.",
    rule: { kind: "fixed_day", month: 11, day: 20, windowDays: 7 },
    periodLabel: "20 de novembro · ± 7 dias",
    emoji: "🖤",
    durationSeconds: 25,
    route: "/paineis/consciencia-negra/",
    category: "Cidadania",
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

function localDateParts(date: Date, timezone?: string) {
  if (!timezone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    return {
      year: Number(parts.find((part) => part.type === "year")?.value || date.getFullYear()),
      month: Number(parts.find((part) => part.type === "month")?.value || date.getMonth() + 1),
      day: Number(parts.find((part) => part.type === "day")?.value || date.getDate()),
    };
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }
}

function dateUtc(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function easterSundayUtc(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return dateUtc(year, month, day);
}

function nthWeekdayUtc(year: number, month: number, weekday: number, occurrence: number) {
  const first = dateUtc(year, month, 1);
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return dateUtc(year, month, 1 + offset + (occurrence - 1) * 7);
}

function withinDays(current: Date, target: Date, windowDays: number) {
  const diff = Math.abs(current.getTime() - target.getTime());
  return diff <= windowDays * 86_400_000;
}

function matchesDynamicRule(rule: SeasonalCampaignRule, current: Date, year: number) {
  if (rule.kind === "fixed_day") {
    return withinDays(current, dateUtc(year, rule.month, rule.day), rule.windowDays);
  }

  if (rule.kind === "nth_weekday") {
    return withinDays(
      current,
      nthWeekdayUtc(year, rule.month, rule.weekday, rule.occurrence),
      rule.windowDays,
    );
  }

  if (rule.kind === "easter_offset") {
    return withinDays(
      current,
      addUtcDays(easterSundayUtc(year), rule.offsetDays),
      rule.windowDays,
    );
  }

  const easter = easterSundayUtc(year);
  const start = addUtcDays(easter, rule.startOffset);
  const end = addUtcDays(easter, rule.endOffset);
  return current >= start && current <= end;
}

export function seasonalDateCode(date: Date, timezone?: string) {
  const parts = localDateParts(date, timezone);
  return parts.month * 100 + parts.day;
}

export function isSeasonalCampaignActive(
  campaign: Pick<SeasonalCampaign, "start" | "end" | "rule">,
  now = new Date(),
  timezone?: string,
) {
  const parts = localDateParts(now, timezone);
  const currentDate = dateUtc(parts.year, parts.month, parts.day);

  if (campaign.rule) {
    return [parts.year - 1, parts.year, parts.year + 1].some((year) =>
      matchesDynamicRule(campaign.rule as SeasonalCampaignRule, currentDate, year),
    );
  }

  if (!campaign.start || !campaign.end) return true;

  const current = parts.month * 100 + parts.day;
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
