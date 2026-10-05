# Central de Conteúdo — Fase 2: Notícias

## Escopo implementado

A Fase 2 move a responsabilidade editorial de notícias para a Central de Conteúdo sem interromper o player atual.

### Banco

A migration `20261005105500_content_hub_phase_2.sql` cria:

- `content_sources`: catálogo e saúde das fontes de ingestão;
- `content_items`: fila editorial normalizada;
- `content_revisions`: histórico de ações editoriais;
- índices para fila e distribuição;
- RLS nas tabelas editoriais;
- remoção de acesso direto de `anon` e `authenticated`;
- acesso das Edge Functions por `service_role`;
- fonte técnica inicial `pontoview-news-provider`.

### Ingestão

`content-news-ingest` substitui a busca de notícias feita pelo player.

Responsabilidades:

1. busca o provedor uma única vez por execução;
2. normaliza os dados;
3. aplica os filtros editoriais herdados do fluxo anterior;
4. classifica notícias;
5. evita duplicidade por `source_id + source_url`;
6. envia itens aprováveis para `review`;
7. registra itens barrados como `rejected` com motivo em `editorial_flags`;
8. registra a saúde da última ingestão em `content_sources`.

A função é idempotente: itens existentes não são rebaixados nem sobrescritos em nova coleta.

### Fila editorial

`content-editorial` fornece a API protegida que será usada pelo painel da Fase 3.

Acesso:

- JWT válido;
- `app_metadata.content_hub_role` igual a `admin` ou `editor`.

Não utilizar `user_metadata` para autorização.

Operações implementadas:

- listar fila por status;
- aprovar;
- rejeitar;
- publicar;
- aprovar e publicar em uma única ação;
- registrar revisão com o usuário responsável.

### Feed publicado

`content-feed` expõe somente conteúdo `published` e vigente, sem campos editoriais internos.

O endpoint possui cache HTTP curto para reduzir consultas repetitivas.

### Player

`screens-news` não consulta mais o provedor externo.

Fluxo:

1. autentica a tela normalmente;
2. busca notícias publicadas em `content_items`;
3. aplica apenas personalização de distribuição, como categoria local da organização;
4. retorna até 16 notícias;
5. durante a transição, complementa com `news_cache` em modo somente leitura quando a Central ainda não possuir volume suficiente.

O cache legado não recebe novos itens pelo `screens-news` e pode ser removido depois que a Central estiver estável.

## Segurança

- tabelas editoriais com RLS habilitado;
- `anon` e `authenticated` sem acesso direto às tabelas;
- nenhuma chave privilegiada no frontend;
- ações editoriais autorizadas por `app_metadata`;
- ingestão protegida por `CONTENT_HUB_INGEST_SECRET`;
- feed público seleciona somente campos próprios para distribuição;
- URL e nome da fonte original são preservados.

## Ativação segura

Não alterar a ordem abaixo.

1. Aplicar a migration da Central.
2. Configurar `CONTENT_HUB_INGEST_SECRET` nos secrets do projeto Supabase.
3. Implantar `_shared/news-editorial.ts` com as Edge Functions dependentes.
4. Implantar `content-news-ingest`.
5. Implantar `content-editorial`.
6. Implantar `content-feed`.
7. Executar uma ingestão manual e confirmar itens em `review` e `rejected`.
8. Atribuir `app_metadata.content_hub_role` apenas aos usuários editoriais autorizados.
9. Aprovar/publicar um pequeno conjunto de notícias.
10. Validar `content-feed`.
11. Somente então implantar a nova versão de `screens-news`.
12. Validar players horizontal e vertical sem alterar polling, manifest ou estado do player.

## Agendamento recomendado

Após a validação manual, agendar `content-news-ingest` em intervalo controlado, inicialmente a cada 15 minutos. O agendamento deve existir uma única vez no backend. Players nunca devem iniciar ingestões.

O Supabase Cron/pg_cron pode invocar uma Edge Function em intervalos definidos. O segredo usado para a chamada deve ficar em mecanismo seguro de secrets/Vault, nunca em SQL versionado ou no frontend.

## Testes prioritários

### Ingestão

- executar duas vezes e confirmar ausência de duplicatas;
- confirmar que item publicado não volta a `review`;
- simular indisponibilidade do provedor e conferir `last_ingest_status = error`;
- conferir motivos editoriais nos itens rejeitados;
- conferir preservação de `source_url`, `source_name` e `source_published_at`.

### Editorial

- usuário sem `content_hub_role` recebe 403;
- editor consegue listar `review`;
- não é possível publicar item sem aprovação, exceto pela ação explícita `approve_and_publish`;
- revisão registra `changed_by`;
- conteúdo rejeitado não aparece no feed.

### Distribuição

- somente `published` aparece em `content-feed`;
- itens expirados não aparecem;
- categorias são respeitadas;
- o payload não contém `review_notes` nem `editorial_flags`.

### Player

- Central com >= 6 itens: usa apenas a Central;
- Central com 1–5 itens: complementa com cache legado;
- Central vazia: mantém cache legado;
- nenhum request do player chega ao provedor externo;
- não há aumento de frequência de chamadas ao Supabase;
- notícias locais continuam sendo identificadas conforme a configuração da organização.

## Critério para desligar o legado

Remover a leitura de `news_cache` somente depois de:

- pelo menos alguns dias de ingestões estáveis;
- fila editorial funcionando;
- volume suficiente de conteúdo publicado;
- ausência de regressões nos players;
- consumo do Supabase dentro do esperado.
