# PontoView Telas Android TV 2.0.0 beta 5

Esta versão consolida o player Android como camada nativa de reprodução para mídias do Google Drive e sincroniza a preferência de inicialização automática por tela.

- Drive vídeo: Media3/ExoPlayer nativo.
- Drive imagem: cache e otimização local.
- WebView: painéis, páginas, mensagens e YouTube.
- Preferência "Iniciar PontoView ao ligar o dispositivo" salva em screen_settings.auto_start.
- A APK persiste a última preferência localmente para poder aplicá-la no boot antes da sincronização com a nuvem.
- Cache de mídia continua local. Nenhuma mídia é enviada ao Supabase Storage ou Cloudflare R2.
