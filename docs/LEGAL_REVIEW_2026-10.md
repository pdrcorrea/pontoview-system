# Revisão jurídica operacional — PontoView

Data da revisão: 07/10/2026

> Este documento organiza riscos e requisitos jurídicos do produto. Não substitui parecer de advogado contratado, especialmente antes do início da comercialização pública.

## Base normativa considerada

- Código de Defesa do Consumidor — Lei nº 8.078/1990, especialmente informação clara, conhecimento prévio do contrato, cláusulas abusivas e direito de arrependimento quando aplicável.
- Decreto nº 7.962/2013 — comércio eletrônico, identificação do fornecedor, informações claras, atendimento facilitado e direito de arrependimento.
- Lei Geral de Proteção de Dados — Lei nº 13.709/2018, incluindo transparência, direitos do titular, bases legais, segurança, registros de tratamento e encarregado/canal de contato.
- Marco Civil da Internet — Lei nº 12.965/2014, especialmente proteção de dados, informações contratuais claras e guarda de registros de acesso a aplicações quando aplicável.
- Resoluções da ANPD sobre agentes de tratamento de pequeno porte, encarregado e transferências internacionais.

## O que já foi ajustado

### Assinatura e inadimplência

- regra de cobrança por telas vinculadas descrita em documento específico;
- período de tolerância de 5 dias corridos registrado de forma explícita;
- consequência da inadimplência informada: suspensão e desvinculação das telas após o prazo;
- esclarecimento de que desvinculação da TV não significa exclusão automática de conta, playlists ou conteúdos;
- regularização exige novo pareamento por segurança;
- cancelamento e contestação de cobrança ganharam seções próprias;
- alterações materiais de preço ou regras devem ser comunicadas antes de produzir efeitos quando juridicamente necessário.

### Termos de Uso

- escopo da plataforma;
- autorização do usuário que representa uma organização;
- segurança de conta e dispositivos;
- responsabilidade por conteúdo inserido pelo cliente;
- licença técnica limitada para processar e exibir conteúdo do cliente;
- tratamento de conteúdo editorial e fontes;
- integrações de terceiros;
- cobrança, cancelamento e arrependimento quando aplicável;
- regras de uso aceitável e suspensão por segurança;
- disponibilidade sem exclusão de direitos legais;
- propriedade intelectual;
- privacidade, encerramento e retenção;
- lei brasileira e foro sem afastar regras protetivas do consumidor.

### Privacidade e LGPD

- categorias de dados pessoais mapeadas em nível de política;
- finalidades e bases legais descritas;
- pagamentos e integrações de terceiros separados;
- compartilhamento por categoria de fornecedor;
- transferências internacionais reconhecidas;
- retenção vinculada à finalidade e obrigação legal;
- direitos do titular descritos;
- canal interno de privacidade já existente no produto;
- regra sobre encarregado compatível com possível enquadramento como agente de pequeno porte;
- segurança, incidentes e dados de menores tratados de forma específica;
- cookies e armazenamento local essenciais mencionados.

## Pendências obrigatórias antes da comercialização pública

### 1. Identificação completa do fornecedor

O ambiente de contratação precisa exibir, em local destacado e de fácil visualização, os dados cadastrais exigidos para comércio eletrônico. Antes do lançamento comercial, preencher e publicar:

- nome empresarial ou nome civil do fornecedor responsável;
- CPF ou CNPJ aplicável;
- endereço físico e eletrônico;
- canais de atendimento.

Esses dados não foram inventados nesta revisão porque ainda não estão formalmente definidos no projeto.

### 2. Canal público de privacidade

Garantir que exista um canal público e funcional para titulares e, quando aplicável, para a ANPD. A área autenticada de privacidade é útil, mas não deve ser o único canal se o titular não conseguir acessar a conta.

### 3. Encarregado

Definir formalmente se a operação se enquadra como agente de tratamento de pequeno porte nos termos da regulamentação da ANPD. Se houver dispensa de encarregado, manter canal de comunicação. Se não houver dispensa, nomear e publicar identidade e contato do encarregado.

### 4. Contratos com fornecedores

Formalizar ou revisar os contratos e termos aplicáveis a fornecedores que tratem dados ou sejam essenciais à operação, incluindo, conforme o uso real:

- Supabase;
- Cloudflare;
- Mercado Pago;
- Google/Google Drive;
- demais provedores de mídia, comunicação, analytics ou suporte.

Mapear papéis de controlador, operador e suboperador.

### 5. Transferência internacional

Mapear quais fornecedores efetivamente processam dados fora do Brasil e documentar o mecanismo jurídico correspondente, de acordo com a LGPD e regulamentação da ANPD.

### 6. Retenção e descarte

Criar tabela interna por categoria de dado contendo:

- dado tratado;
- finalidade;
- base legal;
- local de armazenamento;
- prazo de retenção;
- motivo do prazo;
- método de descarte/anonimização.

### 7. Cookies e analytics

Se forem introduzidos cookies ou trackers não essenciais, criar mecanismo de transparência e consentimento quando juridicamente necessário. Não usar banner genérico apenas por estética: ele deve refletir o que realmente é coletado.

### 8. Direito de arrependimento

O checkout e o atendimento devem prever procedimento para exercício do direito de arrependimento quando a relação for de consumo e a hipótese legal estiver presente. O sistema deve guardar registro da solicitação e do tratamento dado.

### 9. Cancelamento

O fluxo de cancelamento deve ser simples e coerente com a contratação. Evitar impedir cancelamento por existência de débito. Valores anteriores eventualmente devidos podem continuar sendo cobrados sem obrigar o usuário a manter a assinatura ativa.

### 10. Evidência de aceite

Antes do checkout, registrar de forma auditável:

- versão dos Termos de Uso;
- versão das Condições de Assinatura;
- versão da Política de Privacidade quando pertinente;
- data/hora do aceite;
- usuário que realizou a contratação;
- organização vinculada;
- preço e regra comercial apresentados no momento do aceite.

Não usar caixas pré-marcadas para consentimentos que dependam de manifestação ativa.

## Recomendação de interface para o checkout

Antes de confirmar a assinatura, mostrar de forma curta e destacada:

> R$ 29 por tela/mês, com cobrança proporcional aos dias em que cada tela permanecer vinculada. Em caso de pagamento pendente, há 5 dias corridos para regularização. Após esse prazo, as telas podem ser desvinculadas. Ao continuar, você concorda com os Termos de Uso e as Condições de Assinatura.

O texto completo deve permanecer acessível por links próximos ao botão de contratação.

## Risco que merece atenção

A regra de 5 dias é uma condição comercial do PontoView, não uma regra geral prevista em lei para todo serviço digital. Por isso, sua validade prática depende especialmente de transparência prévia, comunicação adequada e ausência de cláusula abusiva no caso concreto. Setores regulados, como telecomunicações, podem ter prazos próprios e não devem ser usados como analogia automática para o PontoView.

## Revisão técnica relacionada

- manter cobrança e identidade do dispositivo como conceitos separados durante o prazo de tolerância;
- ao fim do prazo, executar desvinculação no backend e invalidar token do dispositivo;
- contas com `billing_exempt = true` não podem gerar cobrança, entrar em inadimplência ou ser desligadas pela rotina financeira;
- registrar eventos relevantes de cobrança, aceite, cancelamento e desvinculação para auditoria.
