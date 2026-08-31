# PontoView Telas

O **PontoView Telas** é a plataforma de mídia indoor da PontoView para organizar, programar e exibir conteúdos em TVs.

Este repositório é a evolução do protótipo `conteudo-para-telas`. A implementação nova mantém os painéis automáticos como recurso nativo do produto e prepara a base para telas, playlists, mídias, Google Drive, YouTube e assinatura.

## Estrutura atual

```text
pontoview-system/
├── frontend/
│   ├── index.html              # Login / cadastro
│   ├── dashboard.html          # Entrada da área do cliente
│   └── paineis/
│       ├── index.html          # Biblioteca de painéis automáticos
│       ├── shared/
│       │   ├── pontoview.css
│       │   └── pv.js
│       ├── hoje/
│       ├── saudacoes/
│       ├── hora/
│       ├── tempo/
│       ├── noticias/
│       ├── saude/
│       ├── orientacoes/
│       ├── curiosidades/
│       ├── cultura/
│       ├── economia/
│       └── sustentabilidade/
└── workers/
    └── conteudos/
        ├── src/index.js
        └── wrangler.json
```

## Painéis automáticos

- **Hoje**: data, feriados, estação e calendário.
- **Saudações**: bom dia, boa tarde, boa noite e boas-vindas.
- **Hora Exata**: relógio, data e localização aproximada.
- **Previsão do Tempo**: condição atual e próximos dias.
- **Notícias**: notícias RSS com imagem, fonte e QR Code.
- **Dicas de Saúde**: mensagens rotativas de saúde e bem-estar.
- **Orientações**: mensagens de convivência e atendimento.
- **Curiosidades**: conteúdo editorial com paginação automática.
- **Cultura**: conteúdo cultural com leitura paginada.
- **Economia**: dólar, euro, Bitcoin, Selic e IPCA.
- **Sustentabilidade**: energia solar, renováveis, florestas e emissões.

## Política de atualização

Os painéis foram desenhados para players que recarregam URLs periodicamente.

- Conteúdos rotativos escolhem um item diferente a cada refresh quando possível.
- Cultura e Curiosidades mantêm o mesmo tema durante a exibição e paginam o texto automaticamente para permitir leitura confortável.
- Clima, Hoje e indicadores consultam dados na abertura e usam cache para reduzir chamadas repetidas.
- Relógios continuam atualizando localmente, sem novas consultas de API.

## Cache

Existem duas camadas previstas:

1. `frontend/paineis/shared/pv.js` usa `localStorage` para reaproveitar respostas no próprio player.
2. `workers/conteudos` usa a Cloudflare Cache API para compartilhar respostas entre players e reduzir consultas às fontes externas.

TTLs do Worker:

| Conteúdo | TTL |
| --- | ---: |
| Notícias | 5 min |
| Tempo | 10 min |
| Economia | 3 min |
| Hoje | 1 h |
| Curiosidades | 6 h |
| Cultura | 12 h |
| Sustentabilidade | 6 h |
| Saúde | 6 h |

## Worker de conteúdos

O Worker está em `workers/conteudos` e expõe:

```text
/api/hoje
/api/curiosidades
/api/cultura
/api/economia
/api/sustentabilidade
/api/noticias
/api/saude
/api/tempo
/health
```

Publicação com Wrangler:

```bash
cd workers/conteudos
npx wrangler deploy
```

Depois de publicado, a URL do Worker pode ser informada aos painéis por `?api=`.

Exemplo:

```text
/paineis/economia/?api=https://SEU-WORKER.workers.dev
```

Sem `api=`, os módulos que possuem fonte pública direta continuam funcionando com seus fallbacks e cache local.

## Parâmetros úteis

### Clima

```text
/paineis/tempo/?cidade=Colatina&uf=ES&lat=-19.5394&lon=-40.6306
```

### Sustentabilidade

```text
/paineis/sustentabilidade/?cidade=Colatina&lat=-19.5394&lon=-40.6306
```

### Saudações

```text
/paineis/saudacoes/?nome=Minha%20Empresa
```

## Próximas etapas do PontoView Telas

A base atual já contém a Biblioteca de Painéis. Os próximos módulos previstos são:

- cadastro e gestão de telas;
- playlists;
- mídias do cliente;
- Google Drive;
- vídeos do YouTube;
- player de playlists;
- assinatura e pagamentos.

## Produto

**PontoView Telas** é o nome comercial. `pontoview-system` permanece como nome técnico do repositório.
