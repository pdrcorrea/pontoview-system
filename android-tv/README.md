# PontoView Telas Android TV 2.0.0 beta 11

Versão de teste do aplicativo Android TV. Mantém o motor nativo de mídia e o cache persistente da beta 10.

## Melhorias da beta 11
- Reconstrução da WebView quando o processo de renderização é encerrado, liberando a instância inválida e o motor nativo associado
- Recuperação com espera progressiva para evitar reinícios contínuos
- Nova tentativa após falha de carregamento da página principal, sem buscar dados no Supabase a cada tentativa
- Restrição de navegação da janela principal a `https://tv.pontoview.com.br/`
- Acesso a arquivos locais desabilitado, conteúdo misto bloqueado, depuração WebView desativada e janelas automáticas bloqueadas
- Versão e User-Agent atualizados

## Características preservadas
- Instalação APK Android TV, inicialização automática quando o dispositivo permite e a preferência está ativa
- Vinculação via código e playlists atuais do PontoView
- Vídeos do Google Drive armazenados em biblioteca local, servidos com HTTP Range
- Cache persistente de imagens e vídeos; conteúdo HTML e YouTube pelo WebView
- Limite de um decoder de vídeo ativo e watchdog de reprodução

## Avisos
- **Não instalar por cima da beta 10** sem validar compatibilidade de assinatura e dados de vinculação. APK debug assinado em outro runner pode exigir desinstalação.
- **Não é uma versão comercial assinada.** Os artifacts do GitHub Actions são destinados a testes internos, sem publicação no main.
- Não existe garantia de reprodução totalmente offline de páginas externas ou do YouTube.
- Testar em Android TV de baixo custo por 24 a 72 horas antes de distribuir.
