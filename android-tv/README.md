# PontoView Telas Android TV 2.0.0 beta 9

Arquitetura de vídeo otimizada para sticks Android de baixo custo.

## Estratégia
- O Android baixa vídeos do Google Drive por completo para armazenamento persistente.
- O vídeo é servido internamente pela própria APK em uma origem privada HTTPS interceptada pelo WebView.
- O servidor local suporta requisições HTTP Range, evitando carregar o MP4 inteiro em memória.
- A reprodução usa o motor HTML5/WebView, que foi o caminho mais compatível observado no Pro Eletronic.
- A rede não participa da reprodução depois que o arquivo foi preparado.
- Apenas um decoder de vídeo fica ativo por vez.
- O pré-carregamento baixa arquivos, mas não cria um segundo elemento <video>.
- Se a rota local falhar, o Player ainda pode recorrer ao fluxo web tradicional.

## Conteúdo
- Drive vídeo: arquivo local + WebView.
- Drive imagem: biblioteca local otimizada.
- YouTube, sites e painéis: WebView.
- Start automático: configuração por tela persistida no Android.

## Compatibilidade
Para maior previsibilidade em hardware heterogêneo, o perfil recomendado continua sendo MP4 H.264/AAC, 1920x1080, 30 fps.
