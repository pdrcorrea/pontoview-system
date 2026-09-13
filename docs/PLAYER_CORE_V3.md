# PontoView Player Core v3

## Objetivo

Separar completamente **sincronização** de **reprodução**. O Google Drive do cliente continua sendo a origem de mídia; o Supabase continua sendo o plano de controle; o dispositivo mantém a biblioteca necessária para exibir a programação sem depender da rede durante o playout.

## Componentes

### Control plane
Supabase mantém somente dados leves: contas, organizações, telas, playlists, programação, referências dos arquivos do Drive, configurações, mensagens, revisões e telemetria.

### Origin
Google Drive mantém os arquivos originais selecionados pelo usuário. A PontoView utiliza a autorização existente para obter somente os arquivos que fazem parte da programação.

### Sync Engine
A APK consulta o manifesto da tela em segundo plano. Para cada nova revisão:

1. grava um snapshot como `pending`;
2. identifica mídias do Drive ausentes;
3. baixa cada arquivo por completo para uma área temporária;
4. valida o download;
5. promove os arquivos para a biblioteca local;
6. ativa o novo snapshot de forma atômica somente quando tudo estiver pronto.

Se qualquer etapa falhar, o snapshot anterior continua `active`.

### Playout
O frontend da TV não decide se uma playlist está pronta. Na APK ele lê somente o snapshot marcado como `active` pelo Player Core. Vídeos e imagens do Drive recebem URLs internas servidas pela própria APK.

### Offline
A última playlist ativa permanece disponível sem internet. Atualizações incompletas não aparecem na TV. Clima mantém o último snapshot local disponível; conteúdos online como YouTube e páginas externas podem ser pulados quando não houver conexão.

## Armazenamento

A biblioteca local fica no armazenamento privado do aplicativo. O limite inicial é de até 6 GB, respeitando espaço livre de segurança. Arquivos fora dos snapshots ativo e pendente podem ser removidos por LRU.

## Privacidade

O arquivo original permanece no Google Drive do usuário. O backend PontoView guarda referências e credenciais necessárias à integração. A mídia sincronizada existe localmente somente nos dispositivos pareados que precisam exibi-la.

## Princípio de operação

> A nuvem pode ficar indisponível; a programação local não pode parar por causa disso.