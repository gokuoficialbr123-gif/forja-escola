# Missão 01 — estabilidade das Agendas, somente Draft

Base main confirmada por GitHub e fetch: `612367c3f64cccb5a3cfd7f7cfafb286aef7533b`
(PR30 publicado). Backend main/checkout: `d1483037be294428ab1af7788311f42389790c1a`,
sem alterações. Branch `codex/agenda-stability-mission-01`. Esta missão não autoriza
merge, deploy, Preview, dados reais ou a arquitetura orientada a eventos da Missão02.

## Diagnóstico comprovado

| Comportamento | Causa e classificação | Correção |
|---|---|---|
| Tudo amarelo antes da primeira resposta | Não existe confirmação atual de todas as fontes; estado seguro necessário. Não é prova de erro Google. | Identificar explicitamente carregamento inicial, sem inventar verde. |
| Verde/vermelho desaparecem ao voltar rapidamente à aba | `visibilitychange` executava `reset()`, apagando snapshot, prazo e última consulta mesmo sem mudança de contexto. | Pausar transporte/canal; reter somente o snapshot do contexto original com sua expiração original. Retomar consulta imediatamente. |
| Conteúdo reconstruído a cada renovação idêntica | `forjaAgenda2Paint` atribuía `innerHTML` em todas as faixas/células na entrada e saída do GET. Destruía botões mesmo com dados iguais. | Comparar apresentação por host DOM em WeakMap; substituir somente conteúdo diferente. Novo host sempre recebe estado atual. |
| Movimento da linha de hora pode reconstruir os cartões | Linha de hora fazia parte do HTML da faixa. | Atualizar apenas essa linha quando só a hora mudou; cartões e ações permanecem os mesmos. |
| Erro de acesso, quota, rede, resposta parcial e vencimento pareciam iguais | Status genérico "Consulta incompleta ou vencida". | Complementos fixos e sanitizados distinguem carregamento, fontes incompletas, vencimento, HTTP401/403, HTTP429, timeout, resposta inválida e rede/serviço. Sem mostrar erro bruto ou evento privado. |

Na versão publicada, 16/16 novos casos reproduziram perda de confirmação ou
substituição desnecessária de nós (admin/professor, desktop/celular e três visões).
Outros 8/8 reproduziram ausência de distinção entre carregamento e falhas HTTP/rede.
Os mesmos 24 testes passaram após a mudança. Oito verificações adicionais passaram
para mudança de fontes, isolamento de período durante pausa e linha de hora.
Na revisão da retenção, quatro casos adicionais reproduziram o relógio monotônico
parado durante suspensão do processo. A validade agora exige simultaneamente o
prazo monotônico e o prazo de parede originais; avançar ou recuar um relógio não
estende o prazo do outro. Essa proteção é coberta permanentemente nos dois perfis
e tamanhos de tela, sem ampliar os25s.

Os vídeos não estão anexados nesta rodada. A evidência comprova os cenários
equivalentes descritos acima com interações no portal real e fontes sintéticas;
não atribui causa a uma conta escolar real sem diagnóstico autorizado.

## Limites de segurança e fontes

`GET /agenda/snapshot` continua somente leitura, com permissão backend, native
availability/aulas/bloqueios e ocupação Google pessoal/central. O backend, providers,
cache, consentimentos, scopes, locks e validação final de reserva não mudaram.
Consulta de ocupação não comprova sincronização bidirecional de eventos.

O intervalo continua 20s; validade máxima original, 25s, sem extensão na pausa,
retomada, transferência entre abas ou redesenho. A tela oculta não consulta fontes.
Troca de UID/geração, perfil, seleção, período, visão ou saída da Agenda reseta o
contexto; respostas canceladas/atrasadas não podem confirmar o contexto novo.
O canal existente é fechado ao ocultar e reaberto somente para o contexto atual.

Erro confirmado ou resposta incompleta não ganha verde por reter o último snapshot.
O timer original ainda retira confirmação no vencimento, inclusive com GET pendente.
Google dia inteiro, vários dias, cor do evento e bloqueios conservam seus cortes.
Formulários, filtros, scroll e drawer oficial não são alvos da atualização da grade.
O WeakMap compara apenas apresentação: cada pintura ainda calcula os intervalos
com o snapshot e sua validade atuais. Ele não oferece disponibilidade, não guarda
uma confirmação paralela e não impede a repintura por erro ou expiração.

Amarelo continua legítimo sem consentimento pessoal para a Secretaria, com falha
de Google central/pessoal ou dados vencidos. A idade da fonte mais antiga, o cache
compartilhado de provedores e uma renovação demorada podem reduzir a margem entre
polling de20s e TTL de25s. Esta missão não prolonga verde nem elimina essa limitação
pela força. A Missão02 permanece separada, ainda não implementada.

## Validação e evidências

Node22.23.3, Chromium/Playwright, identidades sintéticas. Integração mutável somente
Auth/Firestore `demo-forja`, com Google simulado. Nenhum teste acessa contas reais.
Regressões permanentes no arquivo existente `scripts/agenda-intelligence.test.mjs`:
36 casos novos, incluindo cinco consultas automáticas exatas nas três visões,
identidade dos botões, pausa curta e longa, isolamento e atualização de bloqueios.

Geração oficial `agenda-intelligence-build.mjs` preserva a migração posterior de
navegação e todos os hashes/guards reversíveis. Mudanças nesses manifests/pins são
artefatos da geração; não alteram funcionalmente navegação nem outras áreas.
Orçamento da CI de20 para25min: a CI anterior chegou a17,5min e há36 regressões
adicionais. Cobertura integral e gates de publicação preservados; PR fica Draft.

Resultado final: **498/498 testes frontend** e **275/275 testes de integração
pareada**, zero falhas, cancelamentos ou ignorados, com saída normal dos processos
e encerramento dos emuladores. A suíte frontend integral foi reiniciada após a
proteção final de suspensão; a integração completa foi repetida nesse artefato.
Resultados e reproduções: [validation.json](evidence/agenda-stability-m01/validation.json).
Integridade e hashes das capturas: [integrity.json](evidence/agenda-stability-m01/integrity.json).
Oito capturas comparáveis de Secretaria/Professor, desktop/celular, confirmação
e fonte desconhecida estão nesse mesmo diretório, somente com dados sintéticos.

Fonte final SHA256: `0d0cbf0cdaae8c156b01ddcbbde6d90ba6878670fe5f2d92b53062604e195689`.
Artefato preparado SHA256: `172fe6d872a3752178828f121e801377767cb4bb1889d8930223336e2465d49e`.
Leitura pública anônima confirmou o artefato publicado anterior `7a772663…`,
distinto deste candidato. Preparação local não executa deploy.

Código preparado não comprova publicação. Nenhum merge/deploy nesta missão.
