# PontoView Player Update Manager

## Objetivo

Permitir que o aplicativo PontoView Telas descubra, baixe e instale versões novas com segurança, sem exigir download manual de APK em cada atualização.

## Fluxo

1. O Player consulta o feed `android-updates` no GitHub Releases.
2. O canal configurado para a tela define qual versão é considerada: `stable` ou `beta`.
3. O APK compara o `versionCode` remoto com o instalado.
4. Quando necessário, baixa o APK em segundo plano.
5. Confere SHA-256.
6. Confere o package name e, em builds de produção, a assinatura criptográfica.
7. A instalação é solicitada somente em um ponto seguro entre conteúdos.
8. Se o Android exigir permissão para instalar aplicativos, a configuração do sistema é aberta.
9. Após a instalação, o Player abre novamente e reutiliza o banco, o pareamento e a biblioteca local.

## Feed

O feed é publicado como um asset chamado `update-manifest.json` na release fixa `android-updates`.

Exemplo:

```json
{
  "schema": 1,
  "stable": {
    "versionCode": 30010,
    "versionName": "3.0.0",
    "url": "https://github.com/.../PontoView-Telas-v3.0.0.apk",
    "sha256": "...",
    "required": false,
    "publishedAt": "2026-09-13T12:00:00Z"
  },
  "beta": {
    "versionCode": 30011,
    "versionName": "3.1.0-beta1",
    "url": "https://github.com/.../PontoView-Telas-v3.1.0-beta1.apk",
    "sha256": "...",
    "required": false,
    "publishedAt": "2026-09-13T12:00:00Z"
  }
}
```

O workflow **só atualiza esse feed quando a APK foi gerada com a assinatura permanente**. Builds de debug continuam disponíveis como technical preview, mas não entram no feed.

## Configuração por tela

`screen_settings` possui:

- `auto_update`
- `update_channel`
- `update_request_revision`

O painel expõe:

- atualizações automáticas;
- canal Estável;
- canal Beta;
- Verificar agora;
- versão instalada;
- versão disponível;
- último erro;
- necessidade de permissão do Android.

## Segurança

A atualização exige:

- HTTPS;
- SHA-256 do arquivo;
- mesmo `applicationId`;
- mesma assinatura em builds de produção;
- versão superior à instalada.

A chave de assinatura não pertence ao código-fonte e nunca deve ser incluída no repositório.

## Limitação do Android

Em dispositivos Android comuns, a primeira instalação originada pelo próprio PontoView pode exigir a autorização **Instalar apps desconhecidos**. Alguns firmwares também podem solicitar confirmação visual da instalação.

Ambientes Device Owner / kiosk podem permitir uma experiência ainda mais automatizada, mas o Update Manager não pressupõe esse privilégio.
