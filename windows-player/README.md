# PontoView Player Windows 1.0.0 beta 2

Aplicativo dedicado de sinalização digital baseado no Electron 45.2.1. Reutiliza o player existente de https://tv.pontoview.com.br/ sem alterar a aplicação web em produção.

## O que está implementado

- Tela cheia e reprodução pelo player web atual, incluindo vinculação por código, playlists, painéis e conteúdos compatíveis com Chromium.
- Inicialização no login do Windows após primeira execução instalada. Se o usuário desligar a inicialização nas configurações do Windows, a aplicação **não volta a ligá-la automaticamente**.
- Sandbox, isolamento de contexto e Node.js desabilitado nas páginas.
- Navegação da janela principal limitada ao domínio `tv.pontoview.com.br`, com bloqueio de pop-ups, redirects para domínios externos, downloads e esquemas de rede inseguros.
- Permissões de câmera, microfone, notificações e localização negadas. Nenhum script de uma página recebe API privilegiada do Electron.
- Cache persistente do Chromium; recuperação de falhas do renderizador e de erros de conexão, com logs locais rotacionados.
- CSP restritiva na tela **offline local**; as páginas do player web precisam ter sua própria CSP compatível no servidor.
- Testes automatizados das regras de URL, `npm audit`, hash SHA256 e rotina de compilação de instalador Windows.

## Instalação beta interna

Abra [Build Windows Player no GitHub Actions](https://github.com/pdrcorrea/pontoview-system/actions/workflows/build-windows-player.yml) e selecione o build mais recente da branch `feature/windows-player-beta`. Baixe o arquivo de `Artifacts`, extraia e execute o Setup.

**ATENÇÃO**: um artefato de CI pode ser não assinado. Ele é somente para avaliação controlada e **não deve ser divulgado a clientes externos**. Não recomende ignorar avisos de SmartScreen para instalar versões desconhecidas.

Atalhos: `Ctrl+Shift+Q` encerra o app; `Ctrl+Shift+R` recarrega a reprodução. O início automático começa após login do usuário, não antes do login Windows.

## Habilitar distribuição externa assinada

1. Adquira um certificado Authenticode válido emitido para a empresa (ou use um serviço de assinatura suportado). Consulte o [guia de assinatura para Windows do electron-builder](https://www.electron.build/docs/features/code-signing/code-signing-win/).
2. Cadastre os segredos `WINDOWS_CSC_LINK` (PFX em base64 ou localização compatível com electron-builder) e `WINDOWS_CSC_KEY_PASSWORD` nos secrets do repositório. Nunca inclua a chave privada no GitHub, no código ou nos logs.
3. Confirme que a branch passou nos testes, auditoria npm e geração do instalador. No workflow, use **Run workflow** com `publish_signed_beta=true`.
4. O pipeline recusa publicação sem credenciais de assinatura ou assinatura Windows válida. Se passar, cria uma **GitHub prerelease** com o instalador e `SHA256SUMS.txt`.
5. Em um PC Windows limpo, verifique a assinatura, a identidade do editor, a vinculação de tela, o vídeo, os painéis, a inicialização após login, uso de RAM durante 24-72h e recuperação de conexão. Só depois divulgue o link da prerelease aos testadores.

A assinatura prova a origem e integridade do instalador, mas **não garante** que ele está livre de vulnerabilidades ou de avisos do SmartScreen: reputação do editor também conta.

## Dados, privacidade e limitações

- Os dados de vinculação, cache e cookies ficam na pasta de usuário do Chromium do Electron. Não armazene senhas e tokens em arquivos de log. Os logs atuais registram eventos, códigos e origens, não URLs completas.
- A reprodução depende do conteúdo carregado pelo domínio PontoView, que precisa de revisão própria de autenticação, RLS, CSP, conteúdo embutido e permissões.
- Cache Chromium **não é download nativo de mídia para exibição offline**. Perdas prolongadas de internet podem impedir a reprodução normal.
- YouTube e páginas externas podem ter limitações de incorporação.
- A atualização do `.exe` **não é automática**. Uma versão nova requer instalador assinado novo. A atualização dos painéis web continua independente.
- A abertura de pop-ups e downloads está desativada propositalmente. Recursos do player que dependerem disso precisam ser adaptados.
- Um aplicativo Electron ainda pode usar muita RAM. É necessário monitorar memória e testar em computadores modestos.
- Esta beta não foi submetida a teste de invasão nem certificada. Segurança depende de manutenção, atualização de dependências e testes em dispositivos reais.

## Diagnósticos

O arquivo `player.log` fica em `app.getPath('userData')` do Windows (normalmente em `%APPDATA%\pontoview-player-windows` ou no nome da aplicação). O evento `renderer-crash` com `reason: "oom"` evidencia encerramento do processo por memória insuficiente.

## Desenvolvimento

```sh
cd windows-player
npm ci
npm run check
npm audit --audit-level=high
npm start
npm run build:win
```

O pipeline registra `package-lock.json` na branch na primeira execução e passa a usar `npm ci` para builds posteriores. Para releases externas, sempre valide que o workflow e os commits utilizados foram revisados.
