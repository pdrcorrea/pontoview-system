# PontoView Telas Android TV 3.0.0 beta 2

## Player Core v3

O Player separa sincronização de reprodução.

- Google Drive do cliente continua sendo a origem dos arquivos.
- Supabase continua como plano de controle com metadados, playlists e configurações.
- A APK mantém SQLite local com snapshot ativo e snapshot pendente.
- Uma playlist nova só entra no ar quando todas as mídias do Drive necessárias estiverem baixadas.
- A playlist anterior continua sendo reproduzida durante downloads ou falhas de sincronização.
- Vídeos e imagens são servidos do armazenamento privado do aplicativo.
- Conteúdo já sincronizado continua funcionando sem internet.
- Clima preserva o último snapshot disponível.
- YouTube e páginas externas continuam dependentes de conectividade.
- Watchdogs de vídeo e runtime continuam ativos para autorrecuperação.
- Inicialização automática permanece controlada por tela no painel.

Arquitetura detalhada: `docs/PLAYER_CORE_V3.md`.