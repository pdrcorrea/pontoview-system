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
