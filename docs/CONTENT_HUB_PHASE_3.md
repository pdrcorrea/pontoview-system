# Central de Conteúdo PontoView — Fase 3

## Objetivo

A Fase 3 transforma a estrutura editorial criada nas fases anteriores em uma área operacional da PontoView. O foco é permitir que uma equipe editorial acompanhe fontes, revise notícias, faça ajustes, aprove, publique, agende, encerre e arquive conteúdos sem acesso direto às tabelas do Supabase.

## Acesso

A rota do painel é `/central-conteudo`.

O acesso é independente do papel que o usuário possui dentro de uma organização do PontoView Telas. A autorização editorial usa somente `app_metadata.content_hub_role`, definido no backend/administrativo do Supabase.

Papéis aceitos:

- `editor`: acessa a Central, revisa e publica conteúdos e consulta as fontes.
- `admin`: possui todas as permissões de editor e também cria, edita, ativa e pausa fontes.

Exemplo conceitual de metadado:

```json
{
  "content_hub_role": "admin"
}
```

Nunca usar `user_metadata` para esta autorização, pois esse conjunto de metadados pode ser alterado pelo próprio usuário.

Usuários sem um dos papéis acima não veem o atalho da Central na navegação e são redirecionados ao dashboard caso tentem acessar a rota diretamente.

## Interface

### Visão geral

Apresenta:

- quantidade de notícias aguardando revisão;
- notícias aprovadas e prontas para publicação;
- notícias publicadas;
- publicações agendadas;
- atividade editorial recente;
- quantidade e saúde das fontes cadastradas;
- última coleta e quantidade de novos registros por fonte.

A tela não faz polling contínuo. A atualização ocorre na abertura, por ações editoriais ou quando o usuário solicita atualização.

### Fila editorial

A fila possui os estados:

- Revisão;
- Aprovadas;
- Publicadas;
- Rejeitadas;
- Expiradas;
- Arquivadas.

É possível filtrar por categoria e pesquisar por manchete ou fonte.

Ao selecionar uma notícia, o editor lateral permite alterar:

- manchete;
- resumo;
- categoria;
- autor original;
- imagem;
- data de expiração;
- notas editoriais internas.

Também mostra a origem, link da publicação original e eventuais alertas produzidos durante a ingestão.

### Ações editoriais

Dependendo do estado do conteúdo, a interface permite:

- aprovar;
- aprovar e publicar;
- rejeitar;
- publicar imediatamente;
- agendar publicação futura;
- encerrar uma publicação;
- arquivar;
- restaurar conteúdo para revisão.

Publicações agendadas utilizam `published_at` no futuro. Tanto `content-feed` quanto `screens-news` exigem `published_at <= agora`, portanto uma notícia agendada não aparece no portal/feed nem nos players antes do horário definido.

## Fontes

A área Fontes apresenta:

- nome e tipo da fonte;
- nível de confiança editorial;
- estado ativo/pausado;
- obrigatoriedade de revisão humana;
- última coleta;
- resultado da coleta;
- quantidade de itens novos;
- último erro de ingestão, quando houver.

Administradores podem criar, editar, ativar e pausar fontes.

A coleta manual pelo painel utiliza a sessão autenticada do editor/administrador. O segredo `CONTENT_HUB_INGEST_SECRET` continua reservado para execuções automatizadas como cron e nunca é enviado ao navegador.

Nesta etapa, a ingestão automática implementada pelo coletor suporta fontes `api` e `partner` compatíveis com o formato normalizado atual. Tipos `rss` e `manual` já podem ser cadastrados no catálogo, mas sua ingestão específica será ampliada em etapa posterior.

## Auditoria

Toda ação feita pela Edge Function `content-editorial` grava uma entrada em `content_revisions` contendo:

- usuário autenticado;
- ação executada;
- estado anterior;
- estado resultante;
- patch aplicado.

A migration da Fase 3 ajusta o trigger genérico de revisões para ignorar atualizações realizadas via service role. Isso evita uma revisão duplicada com `changed_by = null`, pois a Edge Function já registra explicitamente o usuário responsável.

## Performance

O painel editorial é uma área administrativa e não participa do loop dos players.

Regras mantidas:

- players nunca iniciam ingestão;
- busca de fonte ocorre em lote;
- nenhuma requisição individual por card/notícia;
- player consulta apenas conteúdo publicado e vigente;
- conteúdo agendado não é retornado antes do horário;
- `news_cache` permanece somente como fallback temporário durante a migração;
- não há polling contínuo na Central de Conteúdo.

## Ordem segura de implantação

1. Aplicar a migration da Fase 2, caso ainda não esteja aplicada.
2. Aplicar `20261005123000_content_hub_phase_3.sql`.
3. Implantar `_shared/news-editorial.ts` e as Edge Functions da Central.
4. Implantar `content-editorial`.
5. Implantar `content-news-ingest`.
6. Implantar `content-feed`.
7. Configurar `CONTENT_HUB_INGEST_SECRET` para a ingestão automatizada.
8. Definir `app_metadata.content_hub_role` somente para usuários autorizados.
9. Realizar a primeira ingestão.
10. Revisar e publicar um conjunto pequeno de notícias.
11. Validar o feed da Central.
12. Implantar a nova versão de `screens-news`.
13. Validar player horizontal e vertical antes de ampliar o volume de conteúdo.
14. Implantar o frontend com a rota `/central-conteudo`.

## Testes manuais prioritários

### Permissões

- usuário comum não vê a Central;
- acesso direto de usuário comum a `/central-conteudo` redireciona;
- editor acessa fila e ações editoriais;
- editor não altera configuração de fontes;
- administrador gerencia fontes.

### Fluxo editorial

- importação cria itens em revisão;
- aprovação não publica automaticamente;
- aprovar e publicar disponibiliza imediatamente;
- rejeição remove item do fluxo de distribuição;
- agendamento futuro não aparece antes do horário;
- publicação aparece após o horário programado;
- expiração deixa de distribuir o item;
- arquivamento mantém histórico;
- restauração retorna o item à revisão.

### Player

- player continua funcionando quando a Central não possui itens suficientes;
- fallback legado complementa o conteúdo durante a transição;
- com seis ou mais notícias válidas da Central, o player não depende do `news_cache`;
- nenhuma chamada ao provedor externo é originada pelo player.

## Fora do escopo desta fase

- portal público de conteúdo;
- páginas permanentes e QR Code por conteúdo;
- SEO;
- ingestão RSS específica;
- curiosidades, cultura, saúde e conteúdo institucional;
- automação editorial sem revisão para fontes de alta confiança.

Esses pontos permanecem para as fases seguintes da Central de Conteúdo.
