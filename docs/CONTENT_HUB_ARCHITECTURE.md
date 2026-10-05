# PontoView Central de Conteúdo

## Objetivo

A Central de Conteúdo será a camada editorial única do ecossistema PontoView. Ela deve receber conteúdo de fontes externas ou internas, normalizar, classificar, revisar e publicar itens para dois destinos principais:

1. Players PontoView, que exibem conteúdo já aprovado e pronto para uso.
2. Portal público PontoView Conteúdo, que apresenta os itens em páginas próprias, com fonte, autoria/origem e link de referência.

O player não deve fazer trabalho editorial, buscar feeds externos diretamente ou decidir em tempo de exibição se um conteúdo é adequado. A regra é: ingestão e curadoria acontecem na Central; distribuição acontece depois.

## Princípios

- Fonte explícita em todo conteúdo externo.
- URL original preservada para rastreabilidade.
- Conteúdo armazenado de forma normalizada e independente do layout do player.
- Publicação desacoplada da ingestão.
- Revisão editorial antes da publicação no MVP.
- Cache e consultas enxutas para evitar chamadas repetitivas no player.
- Histórico de alterações e status editorial.
- RLS em tabelas expostas pela Data API.
- Nenhuma chave privilegiada no frontend.
- O player consome somente itens publicados e vigentes.

## Fluxo editorial

`Fonte -> Ingestão -> Normalização -> Classificação -> Fila editorial -> Aprovação -> Publicação -> Player / Portal público`

Estados iniciais sugeridos:

- `draft`: criado manualmente e ainda não enviado para revisão.
- `imported`: importado de uma fonte externa.
- `review`: aguardando revisão editorial.
- `approved`: aprovado, mas ainda não publicado.
- `published`: disponível para distribuição.
- `rejected`: descartado editorialmente.
- `expired`: conteúdo vencido.
- `archived`: mantido apenas para histórico.

## Tipos de conteúdo

O modelo deve permitir expansão sem criar uma tabela diferente para cada formato.

Tipos iniciais:

- `news`
- `curiosity`
- `culture`
- `health`
- `institutional`

Categorias de notícias permanecem independentes do tipo, por exemplo:

- geral
- local
- economia
- tecnologia
- esportes
- saúde

## Modelo de dados inicial

### content_sources

Cadastro das origens de conteúdo.

Campos principais:

- `id`
- `name`
- `slug`
- `source_type` (`rss`, `api`, `manual`, `partner`)
- `site_url`
- `feed_url`
- `default_content_type`
- `default_category`
- `is_active`
- `requires_review`
- `trust_level`
- `attribution_label`
- `license_notes`
- `created_at`
- `updated_at`

### content_items

Registro editorial normalizado.

Campos principais:

- `id`
- `source_id`
- `content_type`
- `category`
- `slug`
- `title`
- `summary`
- `body`
- `image_url`
- `source_url`
- `source_author`
- `source_published_at`
- `status`
- `editorial_flags`
- `review_notes`
- `imported_at`
- `reviewed_at`
- `published_at`
- `expires_at`
- `created_at`
- `updated_at`

Restrições importantes:

- URL original deve ser preservada.
- Itens importados devem ter prevenção de duplicidade por fonte + URL ou hash editorial.
- Itens publicados precisam de título, fonte, tipo e data de publicação.

### content_revisions

Histórico de alterações editoriais relevantes.

Campos principais:

- `id`
- `content_item_id`
- `changed_by`
- `change_type`
- `snapshot`
- `created_at`

### content_tags / content_item_tags

Tags flexíveis para filtros e descoberta no portal público.

## Camada de distribuição

A Central deve expor conteúdo publicado por meio de uma interface enxuta, preferencialmente uma função/RPC própria de leitura.

O player não deve consultar a tabela editorial completa. Deve receber somente os campos necessários para exibição, por exemplo:

- id
- type
- category
- title
- summary
- image_url
- public_url
- source_name
- published_at
- expires_at

Isso reduz payload, protege metadados internos e facilita cache.

## Portal público

Domínio sugerido: `conteudo.pontoview.com.br`.

Estrutura inicial:

- Home com destaques e blocos por categoria.
- Busca.
- Página de categoria.
- Página individual do conteúdo.
- Identificação clara da fonte/origem.
- Link para a publicação original quando aplicável.
- QR Code dos players apontando para a página PontoView do item, não diretamente para a fonte externa.

A página individual deve separar claramente o que é texto editorial da PontoView do que é informação atribuída a terceiros.

## Integração com o player existente

O endpoint atual `screens-news` já possui normalização, filtro editorial e cache de notícias. Esse código deve ser tratado como uma ponte temporária.

Migração proposta:

1. Manter `screens-news` funcionando durante a construção da Central.
2. Criar ingestão independente para a Central.
3. Publicar notícias aprovadas em `content_items`.
4. Criar endpoint de leitura da Central.
5. Alterar `screens-news` para ler a Central em vez do provedor externo.
6. Remover gradualmente a lógica editorial de `screens-news`.
7. Desativar o cache legado somente após validação do novo fluxo.

Isso evita uma troca brusca e reduz risco de regressão no player.

## Política inicial de publicação

No MVP, todo conteúdo externo deve passar por revisão humana antes da publicação.

Depois que o fluxo estiver estável, fontes específicas podem receber automação controlada, desde que:

- estejam em lista autorizada;
- tenham comportamento previsível;
- possuam filtros editoriais adequados;
- mantenham rastreabilidade;
- possam ser desativadas rapidamente.

Conteúdo de saúde deve permanecer com regras mais restritivas e fontes previamente aprovadas.

## Performance

Para evitar repetir o histórico de excesso de chamadas ao Supabase:

- Players não fazem polling de feeds externos.
- Ingestão roda no backend em intervalos controlados.
- O endpoint de distribuição deve aceitar versão/revisão de conteúdo e cache HTTP quando aplicável.
- Consultas do player devem retornar somente conteúdo vigente.
- O player deve manter cache local e atualizar apenas quando necessário.
- Não criar uma requisição por card ou por item.

## Fases de implementação

### Fase 1 - Fundação

- Criar tabelas editoriais.
- Criar RLS e permissões.
- Criar catálogo de fontes.
- Criar endpoint de leitura de conteúdo publicado.
- Criar documentação do contrato de dados.

### Fase 2 - Notícias

- Mover ingestão de notícias para a Central.
- Adaptar filtros existentes para o processo de ingestão.
- Criar fila de revisão.
- Publicar itens aprovados.
- Alterar `screens-news` para consumir a Central.

### Fase 3 - Painel editorial

- Dashboard da Central.
- Fila de revisão.
- Edição de título, resumo, imagem e categoria.
- Aprovar, rejeitar, agendar, expirar e arquivar.
- Gestão de fontes.

### Fase 4 - Portal público

- Home.
- Categorias.
- Página individual.
- Busca.
- URLs permanentes e QR Codes.
- SEO e metadados sociais.

### Fase 5 - Novos conteúdos

- Curiosidades.
- Cultura.
- Saúde.
- Conteúdo institucional.
- Parceiros e fontes adicionais.

## Primeira entrega recomendada

A primeira entrega funcional deve permitir:

1. cadastrar uma fonte;
2. importar notícias para uma fila;
3. revisar e aprovar manualmente;
4. publicar;
5. consultar um feed público enxuto;
6. manter o player atual funcionando sem alterações até o novo fluxo ser validado.

Essa abordagem cria a espinha dorsal da Central sem colocar o Telas em risco durante a implantação.
