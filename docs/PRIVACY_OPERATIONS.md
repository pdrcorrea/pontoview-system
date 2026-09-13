# Operação de privacidade

Este arquivo resume o fluxo operacional que acompanha a Central de Privacidade do PontoView.

## Direitos do titular

Solicitações registradas em `privacy_requests` devem ser acompanhadas pela equipe responsável.

- Acesso e confirmação: atender de forma imediata quando possível. Pedidos completos com origem, critérios e finalidade devem observar o prazo legal aplicável.
- Correção: atualizar dados inexatos ou desatualizados.
- Portabilidade: avaliar o formato e a regulamentação aplicável.
- Exclusão: verificar antes se existe obrigação legal ou regulatória de retenção.
- Revogação de consentimento: aplicar somente aos tratamentos baseados em consentimento.
- Informações de compartilhamento: informar entidades com as quais os dados foram compartilhados, quando aplicável.

## Segurança e incidentes

Incidentes envolvendo dados pessoais devem ser avaliados quanto a risco ou dano relevante. Quando houver obrigação de comunicação, o fluxo deve incluir ANPD e titulares afetados. O registro interno do incidente e das providências adotadas deve ser preservado pelo período regulamentar.

## Google Drive e biblioteca local do Player

No PontoView Telas, o Google Drive conectado pelo usuário é a origem dos arquivos de mídia selecionados.

- O arquivo original permanece na Conta Google do usuário.
- O backend PontoView mantém referências técnicas e credenciais OAuth protegidas necessárias para localizar os arquivos autorizados.
- A PontoView não precisa manter uma cópia permanente desses vídeos e imagens em armazenamento de mídia próprio para realizar a exibição.
- Cada dispositivo PontoView pareado pode baixar uma cópia local privada dos arquivos usados pela sua programação.
- Essas cópias existem para reprodução, operação offline e estabilidade do digital signage. Elas ficam no armazenamento privado do aplicativo no dispositivo e não são compartilhadas com outras contas.
- O Player pode remover automaticamente arquivos locais que deixaram de fazer parte da programação para administrar o espaço disponível.
- Ao desconectar um Player, limpar os dados do aplicativo ou desinstalar o aplicativo, as cópias locais daquele dispositivo podem ser eliminadas.
- A desconexão da Conta Google deve impedir novas sincronizações. Conteúdos previamente sincronizados nos dispositivos devem ser tratados conforme a política operacional de remoção e o vínculo da tela.
- A política pública deve explicar de forma clara a diferença entre dados armazenados no backend, arquivos originais no Google Drive e cópias locais nos Players.

## Snapshots e operação offline

O Player Core mantém localmente a última programação validada para evitar interrupções quando a internet oscila.

- Uma atualização de playlist somente deve substituir a versão ativa após todos os arquivos locais necessários estarem disponíveis.
- O snapshot anterior permanece ativo durante downloads ou falhas de sincronização.
- Dados dinâmicos podem manter a última versão local disponível quando isso for compatível com a natureza do conteúdo.
- YouTube, páginas externas e outros conteúdos intrinsecamente online continuam dependentes de conexão.
- Logs e diagnósticos devem evitar armazenar conteúdo pessoal desnecessário e priorizar códigos técnicos, versões e estados de sincronização.

## Governança

- Manter inventário das operações de tratamento, finalidades e bases legais.
- Coletar somente os dados necessários para cada finalidade.
- Definir prazos de retenção e descarte por categoria de dado.
- Revisar fornecedores que tratem dados em nome da PontoView.
- Manter um canal público de privacidade e dados de contato do encarregado quando exigível.
- Revisar periodicamente RLS, permissões de funções e configurações do Supabase Auth.

## Revisão

A interface ajuda a operacionalizar direitos do titular, mas não substitui revisão jurídica, inventário de tratamento, contratos com operadores ou procedimentos internos.


## Pendências de segurança da plataforma

A verificação do Supabase deve incluir:

- habilitar a proteção contra senhas conhecidas como vazadas no Supabase Auth;
- revisar periodicamente funções `SECURITY DEFINER` expostas a `anon` ou `authenticated`;
- manter públicas somente as funções que dependem desse acesso por desenho, como ativação e Player, sempre com validação própria de token e escopo;
- não revogar permissões em massa sem revisar os fluxos de TV, fila e dispositivos.
