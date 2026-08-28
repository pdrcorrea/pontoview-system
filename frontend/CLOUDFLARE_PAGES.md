# Publicação no Cloudflare Pages

Este frontend é um SPA React + Vite localizado em `frontend/`.

## Configuração recomendada no Cloudflare Pages

- Repositório: `pdrcorrea/pontoview-system`
- Branch de preview: `feat/pontoview-screens-foundation`
- Branch de produção: `main` somente após a validação comercial
- Diretório raiz (Root directory): `frontend`
- Framework preset: `Vite` (ou `None`, caso prefira preencher manualmente)
- Comando de build: `npm run build`
- Diretório de saída: `dist`

## Variáveis de ambiente

O frontend já aceita as seguintes variáveis quando o Supabase for conectado:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Essas são chaves públicas. Segredos do Google Drive e Mercado Pago ficam exclusivamente no Supabase.

## Rotas SPA

O arquivo `public/_redirects` contém:

```
/* /index.html 200
```

O Vite copia este arquivo para `dist/` no build. Isso permite abrir diretamente rotas como:

- `/dashboard`
- `/conteudo`
- `/telas`
- `/financeiro`
- `/player/:screenId`

sem retornar 404 no Cloudflare Pages.

## Node

O arquivo `.nvmrc` fixa Node 22 para os builds.

## Deploy automático

Com a integração Git do Cloudflare Pages, todo push na branch de produção gera novo build e deploy automaticamente.

Quando a branch de desenvolvimento for mesclada em `main`, altere a Production branch no Cloudflare para `main`.
