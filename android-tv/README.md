# PontoView Telas Android TV 2.0.0 beta 7

Player local-first para digital signage.

## Drive
- Vídeos são baixados como arquivos completos para a área persistente privada do aplicativo.
- O download usa o stream assinado sem Range.
- O arquivo é gravado primeiro como .part, sincronizado e só depois promovido à biblioteca.
- Media3/ExoPlayer reproduz via file:// usando DefaultDataSource.
- Não há streaming durante a reprodução do vídeo.
- Arquivos são identificados por screen + media + checksum, portanto alterações no Drive geram uma nova cópia.
- Biblioteca de vídeo gerenciada por LRU com limite aproximado de 1,75 GB.

## Outros conteúdos
- Imagens do Drive permanecem otimizadas e persistentes.
- YouTube, sites e painéis continuam no WebView.
- Falha de mídia nativa é registrada e a playlist segue, sem aguardar clique em Play.

## Boot
A preferência de inicialização automática é definida no painel por tela e persistida localmente no dispositivo.
