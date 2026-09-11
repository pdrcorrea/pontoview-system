# PontoView Telas para Android TV

Player híbrido do PontoView para Android TV/TV sticks.

## Arquitetura

- WebView continua responsável por ativação da tela, programação, painéis, mensagens, sites e YouTube.
- Vídeos do Google Drive são reproduzidos nativamente com AndroidX Media3/ExoPlayer.
- O cache de vídeo é local no dispositivo, com LRU de aproximadamente 1,75 GB.
- Imagens do Drive são baixadas temporariamente, redimensionadas para a capacidade da tela, comprimidas localmente e mantidas em um cache LRU de aproximadamente 256 MB.
- Não há Cloudflare R2 e nenhuma mídia otimizada é gravada no Supabase Storage.
- O Supabase continua fornecendo metadados e o endpoint assinado temporário que encaminha o arquivo original do Google Drive.
- Se a mídia já estiver totalmente em cache, o APK consegue reutilizá-la sem solicitar um novo stream.
- TVs/navegadores sem o APK continuam usando o player Web existente.

## Build

Requer JDK 17, Gradle 9.6 e Android SDK 36.

```bash
cd android-tv
gradle :app:assembleDebug
```

APK de teste: `app/build/outputs/apk/debug/app-debug.apk`.

## Inicialização automática

O receiver de boot inicia o PontoView automaticamente por padrão. O bridge nativo também expõe a preferência `setAutoStart` para a configuração poder ser controlada pelo PontoView Telas.
