# Deploy do PontoView Telas no Cloudflare Pages

O frontend do PontoView Telas é estático. O build existe apenas para preparar a pasta `dist` usada pelo Cloudflare Pages.

## Configuração do projeto Pages

Use estas opções no Cloudflare:

- **Root directory:** `frontend`
- **Build command:** `npm run build`
- **Build output directory:** `dist`

O comando executa `frontend/build.mjs`, que copia para `frontend/dist`:

- `index.html`
- `dashboard.html`
- `paineis/`

Nenhuma dependência npm adicional é necessária.

## Worker de conteúdos

O Worker de cache/API não faz parte do build do Pages. Ele deve ser publicado separadamente a partir de:

```text
workers/conteudos/
```

O fato de o log do Pages mostrar `No Wrangler configuration file found` é esperado quando o Root directory está definido como `frontend`.
