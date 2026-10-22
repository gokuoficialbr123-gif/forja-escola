# Evidências e QA — correção de quota da Agenda

Somente Node **22.23.3**, Chromium/Playwright 1.56.1, Google simulado e
Auth/Firestore **demo-forja emulados**. Nenhuma reserva, cancelamento, token ou
conta real foi utilizado. Não houve merge, Preview ou deploy.

## Reprodução anterior

1. `node --test --test-name-pattern="quota regression" test/google-central-freebusy.test.mjs`
   no backend: ADM consultando período amplo e Professor consultando um dia,
   três ciclos de 20s. Antes: **CENTRAL_FREEBUSY_RATE_LIMIT**. Depois: três coletas
   Google, nenhum dado de outro professor na projeção do Professor.
2. `FORJA_AGENDA_EVENT_BASELINE=1 node --test --test-name-pattern="429 Retry-After" scripts/agenda-events.test.mjs`
   usa o cliente do commit publicado `8d7c3cee`, extraído do Git. Durante um
   `Retry-After: 75`, antes enviava **3 requisições onde deveria manter 1**.
   O teste falha explicitamente nessa asserção. A versão corrigida respeita os
   75s, inclusive após Voltar à aba, atualização manual e aviso nativo.

## Resultados focados aprovados

- **326 verificações backend**: suíte `node --test test/*.test.mjs`, sem falhas,
  cancelamentos ou skips. Inclui limites preservados, cache com validade original,
  projeção por professor/período, consentimento, privacy e invalidação após o último await.
- **10 cenários novos Chromium** em `scripts/agenda-events.test.mjs`: ADM e Professor
  desktop/celular, cinco atualizações por eventos, rajadas agrupadas, formulário
  preservado, 429/Retry-After, HTTP 200 parcial com quota, offline/online,
  consentimento central, múltiplas abas e broadcast antigo rejeitado.
- **1 regressão de transporte/TTL**: antecipar a próxima renovação não prolonga os
  25s originais. Se a renovação permanecer pendente, a disponibilidade vence.
- **277 verificações na integração completa** emulada: zero falhas/skips, duração
  observada 532.560s. Inclui contratos Google pessoal/central, all-day/múltiplos
  dias, webhook simulado, reserva final, idempotência, conflito e locks.
- **3 aceitações SSE HTTP/Chromium**, em execução focada posterior: zero falhas/skips.
  Duas já pertencem à integração completa; a terceira acrescenta duas sessões
  reais de navegador com login emulado. Criação, remarcação e cancelamento são
  escritos no Firestore emulado e chegam a ADM e Professor em **menos de 10s por
  alteração**, sem F5/navegação e antes da renovação de fonte em 20s.

As suítes completas frontend e a CI pareada também devem terminar no SHA dos PRs.
Os checks do GitHub e o relatório de entrega registram o resultado final; esta
lista distingue a execução completa local das aceitações focadas adicionadas depois.
Não somar testes repetidos como se fossem cobertura diferente.

## Como reexecutar

Frontend: executar todos os `scripts/*.test.mjs` com Node 22,
`--test-concurrency=1`, `FORJA_PLAYWRIGHT_MODULE` apontando para Playwright 1.56.1
e `FORJA_CHROMIUM_PATH` para Chromium/Chrome local, quando necessário.

Backend: `node --test test/*.test.mjs`. Integração: definir `FORJA_FRONTEND_DIR`
para o checkout coordenado e executar, com Java 21 e Node 22:

```text
firebase emulators:exec --only auth,firestore --project demo-forja --config test/emulators/firebase.json "node --test --test-concurrency=1 test/integration/*.test.mjs"
```

O workflow backend deve obter o SHA frontend exato; a branch corretiva exige
frontend pareado. Não trocar por uma main variável. Fora do modo pareado, somente
a nova aceitação de navegador é explicitamente marcada como não executada;
os testes HTTP de SSE permanecem obrigatórios.

O fixture emulado transmite SSE por HTTP loopback, sem tentar finalizar um stream
contínuo com `response.text()`. A prova nova usa a origem local para evitar o
bloqueio de rede privada do domínio HTTPS virtual. Nenhuma segurança de produção
ou navegador foi desativada. O encerramento põe o contexto offline antes de retirar
interceptadores, cancela chamadas e encerra streams antes de concluir o teste.

## Evidências visuais sintéticas

- [Secretaria desktop](evidence/agenda-events-quota/agenda-events-admin-desktop.png)
- [Secretaria celular](evidence/agenda-events-quota/agenda-events-admin-mobile.png)
- [Professor desktop](evidence/agenda-events-quota/agenda-events-teacher-desktop.png)
- [Professor celular](evidence/agenda-events-quota/agenda-events-teacher-mobile.png)

Capturas revisadas: grade e ações preservadas, status discreto, formulário não
perdido nas atualizações. São fixtures, não prova de OAuth ou conectividade real.

## Riscos restantes

Ver `AGENDA_EVENTS_QUOTA_2026-10-22.md`. Ainda é necessária autorização futura para
validar transporte/reconexão no Render e conexões reais. Google não é instantâneo;
consentimento ausente e quota efetivamente esgotada continuam desconhecidos.
Múltiplas instâncias não compartilham cache/quota em memória. Não publicar com
checks pendentes/falhos nem usar dados reais como teste.
