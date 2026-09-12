# PontoView Telas Android TV 2.0.0 beta 6

Arquitetura local-first para mídia de digital signage.

- O manifesto da playlist é enviado à APK.
- A APK prepara todos os vídeos e imagens do Google Drive em segundo plano.
- Vídeos são totalmente baixados para a biblioteca persistente antes de tocar.
- A reprodução do Drive é feita pelo Media3/ExoPlayer a partir do conteúdo local.
- O Android não cai em um player web manual quando o player nativo falha; o erro é registrado e a playlist segue.
- Biblioteca de vídeo com LRU aproximado de 1,75 GB.
- Biblioteca de imagens com aproximadamente 256 MB e otimização local.
- YouTube, páginas e painéis continuam no WebView.
- A configuração de inicialização automática continua sincronizada por tela.
