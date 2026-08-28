# PontoView Screens 1.0

Sistema multiempresa de mídia indoor com React, Vite, TypeScript e Supabase. O frontend controla biblioteca, playlists, programação, telas, layout, assinatura e suporte. O Player público usa pareamento por código e token próprio; a TV não recebe uma sessão de usuário.

## O que está implementado

- Cadastro, login, logout, recuperação e redefinição de senha com sessão persistente.
- Criação automática da organização, usuário `owner`, playlist principal e trial.
- Dashboard real, biblioteca, YouTube, Google Drive, playlists ordenáveis, programação e grupos no modelo de dados.
- Pareamento com código de seis dígitos, token de dispositivo armazenado como hash, heartbeat e telemetria.
- Player para Drive, YouTube, URL, Apps e comunicados, com cache local do manifesto e de arquivos do Drive.
- Configuração independente Fullscreen ou Moldura em L.
- Planos e assinatura recorrente via Mercado Pago, confirmada por webhook assinado.
- RLS, funções validadoras e chaves estrangeiras compostas por organização.

## Desenvolvimento local

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Preencha apenas as variáveis públicas abaixo no frontend:

```env
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Nunca use `service_role`, segredo do Google ou access token do Mercado Pago em uma variável `VITE_*`.

## Verificação

```bash
npm run typecheck
npm run build
```

## Edge Functions e segredos

As funções estão em `supabase/functions`. Configure estes segredos no projeto Supabase:

| Variável | Finalidade |
| --- | --- |
| `APP_ORIGIN` | URL canônica do frontend, sem barra final |
| `GOOGLE_CLIENT_ID` | Cliente OAuth Web do Google Cloud |
| `GOOGLE_CLIENT_SECRET` | Segredo do cliente OAuth |
| `GOOGLE_REDIRECT_URI` | Callback exato da Edge Function |
| `OAUTH_STATE_SECRET` | Valor aleatório longo para assinar o `state` OAuth |
| `DRIVE_TOKEN_ENCRYPTION_KEY` | Valor aleatório independente para AES-GCM |
| `YOUTUBE_API_KEY` | Opcional; obtém duração e valida `embeddable` |
| `NEWS_API_URL` | Endpoint do provedor de notícias compatível |
| `NEWS_API_KEY` | Chave do provedor de notícias com licença comercial |
| `MP_ACCESS_TOKEN` | Access token de produção do Mercado Pago |
| `MP_WEBHOOK_SECRET` | Assinatura secreta configurada no webhook |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidas pelo ambiente das Edge Functions. O `service_role` fica somente no backend.

Callback do Google:

```text
https://PROJECT_REF.supabase.co/functions/v1/drive-oauth-callback
```

Webhook do Mercado Pago:

```text
https://PROJECT_REF.supabase.co/functions/v1/screens-mercadopago-webhook
```

Habilite no webhook os eventos `subscription_preapproval` e `subscription_authorized_payment`.

## Supabase Auth

Adicione às URLs permitidas:

- `https://SEU_DOMINIO/auth/callback`
- `https://SEU_DOMINIO/redefinir-senha`
- a URL de preview usada durante a validação

## Cloudflare Pages

- Root directory: `frontend`
- Build command: `npm run build`
- Build output: `dist`
- Node: `22`
- Variáveis: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`

O arquivo `public/_redirects` implementa o fallback do React Router. O arquivo `public/_headers` adiciona cabeçalhos de segurança e cache para os assets versionados.

Use a branch de desenvolvimento para o preview. Só altere a branch de produção do Cloudflare para `main` depois de validar cadastro, pareamento, Player e webhook no ambiente final.
