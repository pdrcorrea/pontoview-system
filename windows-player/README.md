# PontoView Player para Windows (beta 1)

Aplicativo desktop Electron que utiliza **o mesmo player web existente** em https://tv.pontoview.com.br/, preservando a vinculação por código, playlists, programações e mídia que o frontend já suporta. Não modifica o player web em produção.

## Instalação e execução

1. Baixe o artefato `PontoView-Player-Windows` do GitHub Actions depois que a compilação terminar.
2. Execute o instalador `PontoView-Player-Windows-1.0.0-beta.1-Setup.exe`.
3. Abra o PontoView Player. A janela inicia em tela cheia, e a tela pode ser vinculada utilizando o fluxo já conhecido.
4. Na primeira execução **instalada**, o app habilita o início automático ao entrar na conta do Windows. O usuário pode desabilitar em **Configurações do Windows > Aplicativos > Inicialização**.
5. Atalhos para administração local: **Ctrl+Shift+Q** encerra o aplicativo; **Ctrl+Shift+R** recarrega o player.

## Diagnóstico

A aplicação registra início, falhas de rede, fim do processo de renderização e eventos de recuperação no arquivo:

`%APPDATA%/pontoview-player-windows/player.log` (a pasta pode variar de acordo com o nome efetivo do app)

Os logs são rotacionados em aproximadamente 2 MB. O sinal `renderer-crash` com `reason: "oom"` indica encerramento por falta de memória do processo. Isso não mede a RAM total do equipamento.

Se o player não carregar, uma tela de reconexão é exibida e o app tenta novamente a cada 30 segundos. Quando o renderizador falha, ele é recriado após 5 segundos; após cinco falhas em dez minutos, o intervalo passa a 60 segundos para evitar reinícios contínuos.

## Escopo e limites desta beta

- **Cache**: utiliza o armazenamento persistente do Chromium, com as regras HTTP e Service Workers já entregues pelo site. **Não existe nesta beta um mecanismo nativo para baixar e reproduzir vídeos inteiros offline**.
- Para a primeira vinculação, atualização de playlists e conteúdo online, é necessária conexão à internet. A reconexão ainda não reproduz uma playlist local completa.
- Conteúdos incorporados de terceiros, especialmente YouTube, dependem de suas políticas de reprodução.
- O bloqueio de suspensão atua durante a execução do aplicativo; políticas do Windows e desligamentos forçados pelo equipamento podem prevalecer.
- O primeiro instalador é **sem assinatura de código**: o Windows SmartScreen pode exibir um aviso. Para distribuição comercial, assinar o executável.
- Inicialização automática acontece no **login do usuário Windows**, não antes da tela de login. Se o computador exigir senha após reboot, a sessão precisa ser iniciada.
- Não há mecanismo de atualização automática do próprio EXE nesta beta; atualizar o player web continua sob controle do site.
- Testar com telas reais antes de colocar em operação contínua.

## Desenvolvimento

```sh
cd windows-player
npm install
npm start
npm run build:win
```

O build de produção é feito em um runner Windows pelo workflow `build-windows-player.yml`.
