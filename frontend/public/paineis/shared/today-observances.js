(() => {
  const items = [
    { month: 1, day: 24, name: "Dia Internacional da Educação", description: "Educação amplia oportunidades e transforma realidades.", source: "ONU" },
    { month: 1, day: 26, name: "Dia Internacional da Energia Limpa", description: "Energia limpa e acessível contribui para um futuro mais sustentável.", source: "ONU" },

    { month: 2, day: 2, name: "Dia Mundial das Zonas Úmidas", description: "Áreas úmidas são essenciais para a biodiversidade, a água e o equilíbrio ambiental.", source: "ONU" },
    { month: 2, day: 11, name: "Dia Internacional das Mulheres e Meninas na Ciência", description: "Mais participação feminina fortalece a ciência e amplia perspectivas.", source: "ONU" },
    { month: 2, day: 20, name: "Dia Mundial da Justiça Social", description: "Igualdade de oportunidades, dignidade e inclusão fazem parte de uma sociedade mais justa.", source: "ONU" },
    { month: 2, day: 21, name: "Dia Internacional da Língua Materna", description: "Línguas preservam histórias, identidades e diversidade cultural.", source: "ONU" },

    { month: 3, day: 3, name: "Dia Mundial da Audição", description: "Prevenção, identificação precoce e cuidado ajudam a preservar a saúde auditiva.", source: "OMS" },
    { month: 3, day: 20, name: "Dia Internacional da Felicidade", description: "Bem-estar e qualidade de vida também fazem parte do desenvolvimento humano.", source: "ONU" },
    { month: 3, day: 21, name: "Dia Mundial da Síndrome de Down", description: "Inclusão começa com respeito, participação e oportunidades para todas as pessoas.", source: "ONU" },
    { month: 3, day: 22, name: "Dia Mundial da Água", description: "Água é essencial à vida. Uso consciente e preservação fazem diferença.", source: "ONU" },
    { month: 3, day: 24, name: "Dia Mundial da Tuberculose", description: "Informação, diagnóstico e tratamento são fundamentais para enfrentar a tuberculose.", source: "OMS" },

    { month: 4, day: 7, name: "Dia Mundial da Saúde", description: "Saúde envolve prevenção, cuidado, qualidade de vida e acesso à informação.", source: "OMS" },
    { month: 4, day: 19, name: "Dia dos Povos Indígenas", description: "Uma data de valorização das culturas, histórias e direitos dos povos indígenas do Brasil.", source: "Governo Federal" },
    { month: 4, day: 22, name: "Dia Internacional da Mãe Terra", description: "Cuidar do planeta é proteger os recursos e as condições que sustentam a vida.", source: "ONU" },
    { month: 4, day: 28, name: "Dia Mundial da Segurança e Saúde no Trabalho", description: "Prevenção e ambientes seguros protegem a saúde de quem trabalha.", source: "OIT" },

    { month: 5, day: 5, name: "Dia Mundial da Higiene das Mãos", description: "Higienizar as mãos corretamente é uma medida simples e essencial para prevenir infecções.", source: "OMS / Anvisa" },
    { month: 5, day: 12, name: "Dia Internacional da Enfermagem", description: "Reconhecimento a profissionais que unem conhecimento técnico, atenção e cuidado.", source: "Calendário da Saúde" },
    { month: 5, day: 15, name: "Dia Internacional das Famílias", description: "Famílias assumem diferentes formas e têm papel importante no cuidado e na convivência.", source: "ONU" },
    { month: 5, day: 17, name: "Dia Mundial da Hipertensão Arterial", description: "Aferição, acompanhamento e hábitos saudáveis ajudam no cuidado com a pressão arterial.", source: "Ministério da Saúde" },
    { month: 5, day: 31, name: "Dia Mundial sem Tabaco", description: "Evitar o tabaco e buscar apoio para parar de fumar protege a saúde.", source: "OMS" },

    { month: 6, day: 5, name: "Dia Mundial do Meio Ambiente", description: "Preservar o ambiente é uma responsabilidade compartilhada e cotidiana.", source: "ONU" },
    { month: 6, day: 7, name: "Dia Mundial da Segurança dos Alimentos", description: "Alimentos seguros ajudam a prevenir doenças e proteger a saúde.", source: "OMS / FAO" },
    { month: 6, day: 14, name: "Dia Mundial do Doador de Sangue", description: "A doação voluntária ajuda a manter estoques disponíveis para quem precisa.", source: "OMS" },
    { month: 6, day: 15, name: "Dia Mundial de Conscientização da Violência contra a Pessoa Idosa", description: "Respeito, proteção e atenção ajudam a enfrentar a violência contra pessoas idosas.", source: "ONU" },
    { month: 6, day: 20, name: "Dia Mundial do Refugiado", description: "A data chama atenção para as histórias, direitos e proteção de pessoas refugiadas.", source: "ONU" },

    { month: 7, day: 11, name: "Dia Mundial da População", description: "População, direitos e desenvolvimento estão conectados às escolhas do presente.", source: "ONU" },

    { month: 8, day: 12, name: "Dia Internacional da Juventude", description: "Juventudes participam da construção de comunidades mais criativas e inclusivas.", source: "ONU" },
    { month: 8, day: 19, name: "Dia Mundial Humanitário", description: "Uma data de reconhecimento às pessoas que atuam em ações humanitárias.", source: "ONU" },
    { month: 8, day: 22, name: "Dia do Folclore", description: "Lendas, festas, saberes e tradições ajudam a contar a diversidade cultural brasileira.", source: "Governo Federal" },

    { month: 9, day: 8, name: "Dia Internacional da Alfabetização", description: "Alfabetização amplia autonomia, participação social e acesso ao conhecimento.", source: "UNESCO" },
    { month: 9, day: 17, name: "Dia Mundial da Segurança do Paciente", description: "Cuidado seguro depende de processos confiáveis, participação e aprendizado contínuo.", source: "OMS" },
    { month: 9, day: 21, name: "Dia Internacional da Paz", description: "Diálogo, respeito e cooperação ajudam a construir relações mais pacíficas.", source: "ONU" },
    { month: 9, day: 29, name: "Dia Mundial do Coração", description: "Hábitos saudáveis e acompanhamento adequado ajudam a proteger a saúde cardiovascular.", source: "Calendário da Saúde" },

    { month: 10, day: 1, name: "Dia Internacional das Pessoas Idosas", description: "Envelhecer com autonomia, respeito e participação é um direito.", source: "ONU" },
    { month: 10, day: 10, name: "Dia Mundial da Saúde Mental", description: "Falar sobre saúde mental também é uma forma de cuidado e prevenção.", source: "OMS" },
    { month: 10, day: 16, name: "Dia Mundial da Alimentação", description: "Alimentação adequada, segura e acessível é parte essencial da saúde.", source: "FAO / ONU" },
    { month: 10, day: 24, name: "Dia das Nações Unidas", description: "Cooperação internacional ajuda a enfrentar desafios que atravessam fronteiras.", source: "ONU" },

    { month: 11, day: 14, name: "Dia Mundial do Diabetes", description: "Informação, acompanhamento e hábitos saudáveis ajudam no cuidado com o diabetes.", source: "OMS" },
    { month: 11, day: 16, name: "Dia Internacional da Tolerância", description: "Respeitar diferenças fortalece convivência, diálogo e inclusão.", source: "ONU" },
    { month: 11, day: 25, name: "Dia Internacional pela Eliminação da Violência contra as Mulheres", description: "Informação, proteção e uma rede de apoio são fundamentais para enfrentar a violência.", source: "ONU" },

    { month: 12, day: 3, name: "Dia Internacional das Pessoas com Deficiência", description: "Acessibilidade e inclusão ampliam autonomia e participação para todas as pessoas.", source: "ONU" },
    { month: 12, day: 5, name: "Dia Internacional do Voluntário", description: "O voluntariado conecta pessoas e fortalece ações em benefício da comunidade.", source: "ONU" },
    { month: 12, day: 10, name: "Dia dos Direitos Humanos", description: "Dignidade, igualdade e respeito são direitos de todas as pessoas.", source: "ONU" },
    { month: 12, day: 18, name: "Dia Internacional dos Migrantes", description: "A data reforça a importância de dignidade, direitos e respeito às pessoas migrantes.", source: "ONU" },
  ];

  function forDate(date = new Date()) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return items.filter((item) => item.month === month && item.day === day);
  }

  window.PV_TODAY_OBSERVANCES = {
    items,
    forDate,
  };
})();
