# PontoView Telas Android TV 2.0.0 beta 8

Player Android com fallback de decodificação para hardware heterogêneo.

## Vídeo
- Biblioteca local persistente de arquivos completos.
- Media3/ExoPlayer continua como motor principal.
- SurfaceView substitui TextureView para reduzir problemas de composição em TV sticks.
- Decoder fallback do Media3 habilitado.
- Se o Media3 não renderizar o primeiro frame em 8 segundos, a APK troca automaticamente para LibVLC.
- LibVLC tenta aceleração por hardware e pode recorrer ao próprio pipeline de decodificação quando o firmware do stick não trabalha bem com MediaCodec.
- Nunca retorna ao <video> do WebView no aplicativo Android.

## Telemetria
- Estados Media3/VLC são enviados ao frontend nativo.
- Heartbeat inclui versão da APK e último diagnóstico nativo.
- Erros de mídia continuam sendo reportados pela lógica da playlist.

## Boot
- Inicialização automática continua controlada por tela no painel PontoView.
